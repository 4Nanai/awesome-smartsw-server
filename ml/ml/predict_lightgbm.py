import sys
import json
import base64
import numpy as np
import onnxruntime as ort

def out(obj):
    sys.stdout.write(json.dumps(obj))
    sys.stdout.flush()

def err(msg):
    sys.stderr.write(json.dumps({"error": msg}))
    sys.stderr.flush()
    sys.exit(1)

try:
    data = json.loads(sys.stdin.read())
except Exception as e:
    err(f"invalid_json:{e}")

required = ["temperature", "humidity", "hour", "model_data"]
for f in required:
    if f not in data:
        err(f"missing_field:{f}")

try:
    model_bytes = base64.b64decode(data["model_data"])

    # Force CPU only to suppress GPU warnings
    session = ort.InferenceSession(
        model_bytes,
        providers=["CPUExecutionProvider"]
    )

    X = np.array(
        [[data["temperature"], data["humidity"], data["hour"]]],
        dtype=np.float32
    )

    output = session.run(None, {"input": X})

    label_output = output[0]
    prob_output = output[1]

    label = int(label_output[0])

    prob1 = 0.0

    # Case 1: list containing a dict with integer keys (our case in test)
    if isinstance(prob_output, list) and len(prob_output) > 0:
        first = prob_output[0]
        if isinstance(first, dict):
            # integer key 1 means class "on"
            prob1 = float(first.get(1, 0.0))

    # Case 2: dict directly
    elif isinstance(prob_output, dict):
        prob1 = float(prob_output.get(1, 0.0)) or float(prob_output.get("1", 0.0))

    # Case 3: numpy array
    elif hasattr(prob_output, "__getitem__"):
        try:
            prob1 = float(prob_output[0][1])
        except:
            pass

    out({
        "predicted_label": label,
        "probability": prob1
    })

except Exception as e:
    err(f"inference_error:{str(e)}")
