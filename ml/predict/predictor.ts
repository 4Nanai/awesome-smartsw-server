import {spawn} from "child_process";
import db from "../../lib/db";

export interface PredictionResult {
    unique_hardware_id: string;
    ml_viable: boolean;
    ml_predictedState: number | null;
    ml_probability: number | null;
}

const ORT_WARNING_PATTERNS = [
    "onnxruntime",
    "device_discovery.cc",
    "GPU device discovery failed",
    "/sys/class/drm/card0/device/vendor",
];

export async function predictDeviceState(deviceId: string): Promise<PredictionResult> {
    const base: PredictionResult = {
        unique_hardware_id: deviceId,
        ml_viable: false,
        ml_predictedState: null,
        ml_probability: null,
    };

    try {
        // 1) Load model
        const [rows]: any = await db.execute(
            "SELECT model_data, status FROM ml_models WHERE unique_hardware_id = ?",
            [deviceId]
        );

        if (rows.length === 0 || rows[0].status !== "ready") {
            console.log(`[PREDICT] No ready model for device ${deviceId}`);
            return base;
        }

        const modelBlobBase64 = rows[0].model_data.toString("base64");

        // 2) Load latest sensor data
        const [sensorRows]: any = await db.execute(
            "SELECT temperature, humidity, ts FROM temp_humi_data WHERE unique_hardware_id = ? ORDER BY ts DESC LIMIT 1",
            [deviceId]
        );

        if (sensorRows.length === 0) {
            console.log(`[PREDICT] No sensor data for device ${deviceId}`);
            return base;
        }

        const {temperature, humidity, ts} = sensorRows[0];
        const hour = new Date(Number(ts)).getHours();

        const payload = {
            temperature: Number(temperature),
            humidity: Number(humidity),
            hour,
            model_data: modelBlobBase64,
        };

        // 3) Call python via docker exec in ml_worker
        return await new Promise<PredictionResult>((resolve) => {
            const py = spawn("docker", [
                "exec",
                "-i",
                "websocket_ml_worker",
                "python3",
                "/app/ml/ml/predict_lightgbm.py",
            ]);

            let stdout = "";
            let realStderr = ""; // only real errors go here

            py.stdout.on("data", (d) => {
                stdout += d.toString();
            });

            py.stderr.on("data", (d) => {
                const text = d.toString();

                // If this chunk looks like an ORT "no GPU" warning, ignore it
                if (ORT_WARNING_PATTERNS.some((p) => text.includes(p))) {
                    console.log("[PY-WARN ignored]", text.trim());
                    return; // ⬅️ do NOT add to realStderr
                }

                console.error("[PY-STDERR]", text.trim());
                realStderr += text; // ⬅️ only non-warning stderr is treated as error
            });

            py.on("error", (err) => {
                console.error("[PY-SPAWN-ERR]", err);
                resolve(base);
            });

            py.on("close", () => {
                if (realStderr.length > 0) {
                    console.error("[PYTHON-ERROR]", realStderr.trim());
                    resolve(base);
                    return;
                }

                if (!stdout.trim()) {
                    console.error("[PYTHON-EMPTY] No output from Python script");
                    resolve(base);
                    return;
                }

                try {
                    const parsed = JSON.parse(stdout);
                    resolve({
                        unique_hardware_id: deviceId,
                        ml_viable: true,
                        ml_predictedState: parsed.predicted_label ?? null,
                        ml_probability: parsed.probability ?? null,
                    });
                } catch (err) {
                    console.error("[PYTHON-JSON-PARSE-ERR]", err, "RAW:", stdout);
                    resolve(base);
                }
            });

            py.stdin.write(JSON.stringify(payload));
            py.stdin.end();
        });
    } catch (err) {
        console.error("[PREDICT] Exception in predictor:", err);
        return base;
    }
}


if (require.main === module) {
    const id = process.argv[2];
    if (!id) {
        console.log("[PREDICT] Manual Usage: ts-node predictor.ts <deviceId>");
        process.exit(1);
    }

    predictDeviceState(id).then(res => {
        console.log("[PREDICT] Result:", JSON.stringify(res, null, 2));
    });
}
