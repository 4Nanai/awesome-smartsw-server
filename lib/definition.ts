export interface EndpointMessageDTO {
    type: "device_auth" | "device_reconnect" | "device_unbound" | "data_report" | "endpoint_state" | "query_endpoint_state" | "set_endpoint_state" | "auth_success" | "set_config",
    payload?: {
        uniqueHardwareId: string,
        token?: string,
        state?: "on" | "off" | "error",
        from?: "manual_or_user" | "presence_sensor" | "sound_sensor" | "timer" | "ml",
        command?: {
            state?: boolean,
            from?: "user" | "ml",
        },
        sensor?: SensorDataDAO,
        config?: EndpointConfigDTO,
    },
    message?: string,
}

export interface UserMessageDTO {
    type: "user_auth" | "set_endpoint_state" | "auth_success" | "auth_failure" | "query_endpoint_state" | "endpoint_state",
    payload?: {
        uniqueHardwareId?: string,
        token?: string,
        state?: "on" | "off" | "error",
        command?: {
            state?: boolean,
            from?: "user" | "ml",
        },
        [key: string]: any,
    },
    message?: string,
}

export interface SensorDataDAO {
    temp_humi?: {
        temperature: number,
        humidity: number,
        ts: number,
    },
    pir?: {
        state: boolean,
        ts: number,
    },
    radar?: {
        state: boolean,
        ts: number,
    },
    sound?: {
        ts: number,
    },
}

export interface TimerEntry {
    h: number,    // hour (0-23)
    m: number,    // minute (0-59)
    s: number,    // second (0-59)
    a: boolean,   // action (true: turn on, false: turn off)
}

export interface TimerSchedule {
    [day: string]: TimerEntry[],  // day: 0-6 (Sunday-Saturday), max 20 entries per day
}

export interface EndpointConfigDTO {
    automation_mode?: "off" | "presence" | "sound" | "timer" | "ml",
    presence_mode?: "pir_only" | "radar_only" | "fusion_or" | "fusion_and",
    sensor_off_delay?: number,
    timer?: TimerSchedule,
    mqtt_config?: MQTTConfigDTO,
    timezone?: string,
}

export interface UserRegisterDTO {
    username: string,
    password: string,
    email: string,
    timezone: string,
}

export interface UserLoginDTO {
    username: string,
    password: string,
}

export interface UserLoginDAO {
    id: number,
    password_hash: string,
    timezone: string,
}

export interface UserPayload {
    id: number,
    username: string,
    timezone: string,
}

export interface BindingTokenDAO {
    id: number,
    user_id: number
}

export interface DeviceInfoDAO {
    unique_hardware_id: string,
    alias: string | null,
}

export interface DeviceBindingDAO {
    user_id: number,
    unique_hardware_id: string,
}

export interface DeviceDTO {
    unique_hardware_id: string,
    alias: string | null,
    status: "unknown",
}

export interface DeviceUpdateAliasDTO {
    unique_hardware_id: string,
    alias: string,
}

export interface SetAutomationModeDTO {
    unique_hardware_id: string,
    mode: "off" | "presence" | "sound" | "timer" | "ml",
}

export interface SetPresenceModeDTO {
    unique_hardware_id: string,
    mode: "pir_only" | "radar_only" | "fusion_or" | "fusion_and",
}

export interface SetSensorOffDelayDTO {
    unique_hardware_id: string,
    delay: number,
}

export interface SetTimerDTO {
    unique_hardware_id: string,
    timer: TimerSchedule,
}

export interface DeviceTimerDAO {
    id: number,
    unique_hardware_id: string,
    day_of_week: number,
    hour: number,
    minute: number,
    second: number,
    action: boolean,
    created_at: Date,
    updated_at: Date,
}

export interface MQTTConfigDTO {
    enable: boolean;
    device_name?: string;
    broker_url?: string;
    port?: number;
    topic_prefix?: string;
    username?: string;
    password?: string;
    client_id?: string;
    ha_discovery_enabled?: boolean;
    ha_discovery_prefix?: string;
}

export interface DeviceConfigDAO {
    id: number,
    unique_hardware_id: string,
    automation_mode: "off" | "presence" | "sound" | "timer" | "ml",
    presence_mode: "pir_only" | "radar_only" | "fusion_or" | "fusion_and",
    sensor_off_delay: number,
    mqtt_device_name?: string,
    mqtt_broker_url?: string,
    mqtt_port?: number,
    mqtt_username?: string,
    mqtt_password?: string,
    mqtt_client_id?: string,
    mqtt_topic_prefix?: string,
    mqtt_ha_discovery_enabled?: boolean,
    mqtt_ha_discovery_prefix?: string,
    created_at: Date,
    updated_at: Date,
}
