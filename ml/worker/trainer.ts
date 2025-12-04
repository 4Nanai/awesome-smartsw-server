import db from '../../lib/db';
import config from '../config';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';


//1. Types
interface TempHumiRow {
    temperature: number;
    humidity: number;
    ts: number;
}

interface SwitchRow {
    state: 0 | 1;
    ts: number;
}

interface TimelinePoint {
    ts: number;
    state: 0 | 1;
    temperature: number | null;
    humidity: number | null;
}

//2. Helpers for loading data
// Load temperature and humidity for device in time window
async function loadTempHumi(id: string, start: number, end: number): Promise<TempHumiRow[]> {
    const [rows] = await db.query<any[]>(
        `
        SELECT temperature, humidity, ts
        FROM temp_humi_data
        WHERE unique_hardware_id = ?
          AND ts BETWEEN ? AND ?
        ORDER BY ts ASC
        `,
        [id, start, end]
    );
    return rows as TempHumiRow[];
}

// Load switch events for device in time window
async function loadSwitchEvents(
    id: string,
    start: number,
    end: number
): Promise<SwitchRow[]> {
    const [rows] = await db.query<any[]>(
        `
        SELECT state, ts
        FROM switch_data
        WHERE unique_hardware_id = ?
          AND ts BETWEEN ? AND ?
        ORDER BY ts ASC
        `,
        [id, start, end]
    );

    return rows as SwitchRow[];
}


//3. Helpers for preprocessing data

// fill in the starting state
function inferStartingState(events: SwitchRow[], windowStart: number): 0 | 1 {
    // Find last event before the window
    // to use this, change load switch events to include history
    // let lastBefore: SwitchRow | null = null;
    //
    // for (const ev of events) {
    //     if (ev.ts < windowStart) lastBefore = ev;
    //     else break;
    // }
    //
    // if (lastBefore) return lastBefore.state;

    // Else get first inside window and invert
    const firstInside = events.find(ev => ev.ts >= windowStart);
    if (!firstInside) return 0; // shouldn't happen

    return firstInside.state === 1 ? 0 : 1;
}

// Find nearest temp/humidity
function nearestReading(data: TempHumiRow[], ts: number): TempHumiRow | null {
    if (data.length === 0) return null;

    // Since data is sorted, binary search is possible — use simple scan for clarity first
    let best: TempHumiRow | null = null;
    let bestDiff = Infinity;

    for (const row of data) {
        const diff = Math.abs(row.ts - ts);
        if (diff < bestDiff) {
            best = row;
            bestDiff = diff;
        }
    }
    return best;
}

// Build minute by minute timeline
function buildTimeline(
    events: SwitchRow[],
    tempHumi: TempHumiRow[],
    startState: 0 | 1,
    start: number,
    end: number
): TimelinePoint[] {

    if (!events || events.length === 0) return [];

    const timeline: TimelinePoint[] = [];
    let state: 0 | 1 = startState;

    let ei = 0;

    for (let ts = start; ts <= end; ts += config.GRID_INTERVAL_MINUTES * 60 * 1000) {

        // apply switch labels up to this timestamp
        while (ei < events.length) {
            const ev = events[ei];
            if (!ev) break;

            if (ev.ts <= ts) {
                state = ev.state;
                ei++;
            } else {
                break;
            }
        }

        const th = nearestReading(tempHumi, ts);

        timeline.push({
            ts,
            state,
            temperature: th?.temperature ?? null,
            humidity: th?.humidity ?? null,
        });
    }

    return timeline;
}

//4. Helpers to run the python script

// Build csv
function buildFeatureCSV(timeline: TimelinePoint[], csvPath: string) {
    const lines: string[] = [];
    lines.push("temperature,humidity,hour,state");

    for (const p of timeline) {
        if (p.temperature === null || p.humidity === null) continue;

        const hour = new Date(p.ts).getHours();

        lines.push(`${p.temperature},${p.humidity},${hour},${p.state}`);
    }

    fs.writeFileSync(csvPath, lines.join("\n"));
}

// Spawn python trainers and save results as onnx
async function runPythonTrainer(csvPath: string, onnxPath: string): Promise<void> {
    // non-docker version
    // return new Promise((resolve, reject) => {
    //     const py = spawn("python3", [
    //         config.PYTHON_TRAINER,
    //         csvPath,
    //         onnxPath
    //     ]);
    return new Promise((resolve, reject) => {
        const py = spawn("docker", [
            "exec",
            "websocket_ml_worker",
            "python3",
            config.PYTHON_TRAINER,
            csvPath,
            onnxPath
        ]);
        py.stdout.on('data', data => {
            console.log("[PY]", data.toString());
        });

        py.stderr.on('data', data => {
            console.error("[PY-ERR]", data.toString());
        });

        py.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`Python exited with code ${code}`));
        });
    });
}

// Helper to save ml model to db
async function saveModel(deviceId: string, modelData: Buffer, trainedUntil: number) {
    await db.query(
        `
        INSERT INTO ml_models (unique_hardware_id, model_type, model_data, trained_until, training_days, status)
        VALUES (?, 'lightgbm_onnx', ?, ?, ?, 'ready')
        ON DUPLICATE KEY UPDATE
            model_type = VALUES(model_type),
            model_data = VALUES(model_data),
            trained_until = VALUES(trained_until),
            training_days = VALUES(training_days),
            status = 'ready',
            updated_at = CURRENT_TIMESTAMP
        `,
        [deviceId, modelData, trainedUntil, config.TRAIN_WINDOW_DAYS]
    );
}


//5. Scafold Stuff
// Main Training Function
export async function trainDeviceModel(
    device: { unique_hardware_id: string; created_at: string },
    windowStart: number,
    windowEnd: number
) {
    const id = device.unique_hardware_id;

    // 1) Load data
    const tempHumi = await loadTempHumi(id, windowStart, windowEnd);
    const switchEvents = await loadSwitchEvents(id, windowStart, windowEnd);

    if (tempHumi.length === 0 || switchEvents.length === 0) {
        await markModelStatus(id, 'no_activity');
        return;
    }

    // 2) Change here if wish to filter out certain switching events
    const cleanedEvents = switchEvents;

    // 3) Determine starting state
    const startState = inferStartingState(cleanedEvents, windowStart);

    // 4) Build timeline
    const timeline = buildTimeline(cleanedEvents, tempHumi, startState, windowStart, windowEnd);

    if (timeline.length < config.MIN_SAMPLES_FOR_TRAINING) {
        await markModelStatus(id, 'insufficient_data');
        return;
    }

    // 5) Write CSV
    const csvPath = path.join(config.TEMP_DIR, `${id}_train.csv`);
    buildFeatureCSV(timeline, csvPath);

    // 6) Train LightGBM
    const onnxPath = path.join(config.TEMP_DIR, `${id}.onnx`);
    await runPythonTrainer(csvPath, onnxPath);

    // 7) Store model
    const modelBuffer = fs.readFileSync(onnxPath);
    await saveModel(id, modelBuffer, windowEnd);

    console.log(`[TRAIN] Model for ${id} saved successfully.`);
}


// Scafold function that runs training on eligible devices
export async function runTrainingCycle() {
    console.log("[TRAINER] Loading eligible devices...");

    const windowEnd = Date.now();
    const windowStart = windowEnd - config.TRAIN_WINDOW_DAYS * 24 * 3600 * 1000;

    const devices = await loadEligibleDevices(windowStart, windowEnd);

    console.log(`[TRAINER] Found ${devices.length} eligible device(s).`);

    for (const dev of devices) {
        console.log(`[TRAINER] Training device: ${dev.unique_hardware_id}`);

        try {
            await trainDeviceModel(dev, windowStart, windowEnd);
            console.log(`[TRAINER] ✓ Model ready for ${dev.unique_hardware_id}`);
        } catch (err) {
            console.error(`[TRAINER] ✗ Error training ${dev.unique_hardware_id}:`, err);
            await markModelStatus(dev.unique_hardware_id, 'error');
        }
    }
}

// helper function for finding eligible devices
// that are created before windowStart and has activity between windowStart and windowEnd
async function loadEligibleDevices(windowStart: number, windowEnd: number) {
    const [rows] = await db.query<any[]>(
        `
        SELECT unique_hardware_id, created_at
        FROM devices
        WHERE created_at <= FROM_UNIXTIME(? / 1000)
          AND unique_hardware_id IN (
              SELECT DISTINCT unique_hardware_id
              FROM switch_data
              WHERE ts BETWEEN ? AND ?
          )
        `,
        [windowStart, windowStart, windowEnd]
    );

    return rows as Array<{
        unique_hardware_id: string;
        created_at: string;
    }>;
}

async function markModelStatus(deviceId: string, status: string) {
    await db.query(
        `
        INSERT INTO ml_models (unique_hardware_id, model_type, model_data, trained_until, training_days, status)
        VALUES (?, 'lightgbm_onnx', '', 0, ?, ?)
        ON DUPLICATE KEY UPDATE
            status = VALUES(status),
            updated_at = CURRENT_TIMESTAMP
        `,
        [deviceId, config.TRAIN_WINDOW_DAYS, status]
    );
}
