#!/usr/bin/env python3

import sys
import traceback
import lightgbm as lgb
import onnxmltools
import pandas as pd
from skl2onnx.common.data_types import FloatTensorType

# ---------------------------
# 1. Parse arguments
# ---------------------------
if len(sys.argv) != 3:
    print("Usage: train_lightgbm.py <input_csv> <output_onnx>", file=sys.stderr)
    sys.exit(1)

csv_path = sys.argv[1]
onnx_path = sys.argv[2]

print(f"[PY] Loading dataset from: {csv_path}")

try:
    # ---------------------------
    # 2. Load CSV using pandas
    # ---------------------------
    df = pd.read_csv(csv_path)

    # Expecting columns:
    # temperature, humidity, hour, state
    feature_cols = ["temperature", "humidity", "hour"]
    label_col = "state"

    if not all(col in df.columns for col in feature_cols + [label_col]):
        raise Exception(f"CSV missing required columns: {feature_cols + [label_col]}")

    X = df[feature_cols]
    y = df[label_col]

    print(f"[PY] Loaded {len(df)} samples.")

    # ---------------------------
    # 3. Train LightGBM model
    # ---------------------------
    lgb_dataset = lgb.Dataset(X, label=y)

    params = {
        "objective": "binary",
        "boosting_type": "gbdt",
        "learning_rate": 0.05,
        "num_leaves": 31,
        "verbose": -1
    }

    print("[PY] Training LightGBM...")
    model = lgb.train(params, lgb_dataset, num_boost_round=50)

    print("[PY] LightGBM training completed.")

    # ---------------------------
    # 4. Convert to ONNX
    # ---------------------------
    print("[PY] Converting model to ONNX...")

    # Define input type for ONNX conversion
    initial_type = [('input', FloatTensorType([None, len(feature_cols)]))]

    onnx_model = onnxmltools.convert_lightgbm(model, initial_types=initial_type)

    # ---------------------------
    # 5. Save ONNX model
    # ---------------------------
    with open(onnx_path, "wb") as f:
        f.write(onnx_model.SerializeToString())

    print(f"[PY] ONNX model saved to: {onnx_path}")
    print("[PY] DONE")

except Exception as e:
    print("[PY-ERROR] Exception occurred:", file=sys.stderr)
    traceback.print_exc()
    sys.exit(1)
