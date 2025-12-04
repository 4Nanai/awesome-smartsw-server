import * as ort from "onnxruntime-node";

const modelCache: Record<string, ort.InferenceSession> = {};

export async function getModelFromBlob(deviceId: string, blob: Buffer): Promise<ort.InferenceSession> {
    if (modelCache[deviceId]) {
        return modelCache[deviceId];
    }

    console.log(`[PREDICT] Loading ONNX model for ${deviceId} from DB blob...`);

    const session = await ort.InferenceSession.create(blob, {
        executionProviders: ["cpuExecutionProvider"]
    });

    modelCache[deviceId] = session;
    return session;
}
