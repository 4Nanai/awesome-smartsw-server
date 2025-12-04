import db from "../..//lib/db";
import * as ort from "onnxruntime-node";
import {getModelFromBlob} from "./modelCache";

export interface PredictionResult {
    unique_hardware_id: string;
    ml_viable: boolean;
    ml_predictedState: number | null;
    ml_probability: number | null;
}

export async function predictDeviceState(deviceId: string): Promise<PredictionResult> {
    const base: PredictionResult = {
        unique_hardware_id: deviceId,
        ml_viable: false,
        ml_predictedState: null,
        ml_probability: null
    };

    try {
        // Load model entry
        const [rows]: any = await db.execute(
            "SELECT model_data, status FROM ml_models WHERE unique_hardware_id = ?",
            [deviceId]
        );

        if (rows.length === 0) {
            console.log(`[PREDICT] No model row for ${deviceId}`);
            return base;
        }

        const {model_data, status} = rows[0];

        if (status !== "ready") {
            console.log(`[PREDICT] Model for ${deviceId} not ready (status=${status})`);
            return base;
        }

        // Load ONNX from DB blob
        const session = await getModelFromBlob(deviceId, model_data);

        // Latest sensor reading
        const [sensorRows]: any = await db.execute(
            "SELECT temperature, humidity, ts FROM temp_humi_data WHERE unique_hardware_id = ? ORDER BY ts DESC LIMIT 1",
            [deviceId]
        );

        if (sensorRows.length === 0) {
            console.log(`[PREDICT] No sensor data for ${deviceId}`);
            return base;
        }

        const {temperature, humidity, ts} = sensorRows[0];
        const hour = new Date(Number(ts)).getHours();

        // Build input tensor
        const features = Float32Array.from([
            Number(temperature),
            Number(humidity),
            hour
        ]);

        const input = new ort.Tensor("float32", features, [1, 3]);

        // Run ONNX inference
        const output = await session.run({input});

        // Safely extract tensors from output map
        const outputLabelTensor = output["output_label"];
        const outputProbTensor = output["output_probability"];

        // Extract values with fallback defaults
        const predictedLabel =
            outputLabelTensor && outputLabelTensor.data.length > 0
                ? Number(outputLabelTensor.data[0])
                : null;

        const probClass1 =
            outputProbTensor && outputProbTensor.data.length > 1
                ? Number(outputProbTensor.data[1])
                : null;

        // If either prediction is null, ML is not viable this time (appease ts)
        if (predictedLabel === null || probClass1 === null) {
            return {
                unique_hardware_id: deviceId,
                ml_viable: false,
                ml_predictedState: null,
                ml_probability: null
            };
        }

        return {
            unique_hardware_id: deviceId,
            ml_viable: true,
            ml_predictedState: predictedLabel,
            ml_probability: probClass1
        };

    } catch (err) {
        console.error(`[PREDICT] Error during prediction for ${deviceId}:`, err);
        return base;
    }
}

// manual entrypoint for tesing
if (require.main === module) {
    const deviceId = process.argv[2];

    if (!deviceId) {
        console.error("[PREDICTOR] Manual Usage: ts-node predictor.ts <unique_hardware_id>");
        process.exit(1);
    }

    console.log(`[PREDICT] Manually triggered. Predicting state for device ${deviceId}...`);

    predictDeviceState(deviceId)
        .then(result => {
            console.log("[PREDICT] Result:");
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(err => {
            console.error("[PREDICT] Error");
            console.error(err);
        })
        .finally(() => process.exit(0));
}
