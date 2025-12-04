const config = {
    TRAIN_WINDOW_DAYS: 1,
    MIN_REQUIRED_HOURS: 6,
    GRID_INTERVAL_MINUTES: 1,
    PREDICTION_HORIZON_MIN: 5,
    DUPLICATE_DEDUP_SECONDS: 10,
    MIN_SAMPLES_FOR_TRAINING: 100,

    PYTHON_TRAINER: `${__dirname}/ml/train_lightgbm.py`,
    TEMP_DIR: `${__dirname}/tmp/`,
};

export default config;
