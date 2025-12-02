export interface EndpointMessageDTO {
    type: "device_auth" | "device_reconnect" | "device_unbound" | "data_report" | "endpoint_state" | "query_endpoint_state" | "set_endpoint_state" | "auth_success" | "set_config",
    payload?: {
        uniqueHardwareId: string,
        token?: string,
        state?: "on" | "off" | "error",
        command?: {
            type: "toggle" | string,
            state?: boolean
            data?: string,
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
            type: "toggle" | string,
            state?: boolean,
            data?: string,
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

export interface EndpointConfigDTO {
    automation_mode?: "off" | "presence" | "sound" | "timer" | "ml",
    presence_mode?: "pir_only" | "radar_only" | "fusion_or" | "fusion_and",
    sound_mode?: "noise" | "clap",
    mqtt_config?: MQTTConfigDTO,
}

export interface UserRegisterDTO {
    username: string,
    password: string,
    email: string,
}

export interface UserLoginDTO {
    username: string,
    password: string,
}

export interface UserLoginDAO {
    id: number,
    password_hash: string,
}

export interface UserPayload {
    id: number,
    username: string,
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

export interface SetSoundModeDTO {
    unique_hardware_id: string,
    mode: "noise" | "clap",
}


export interface MQTTConfigDTO {
    device_name: string;
    broker_url: string;
    port: number;
    topic_prefix: string;
    username?: string;
    password?: string;
    client_id?: string;
}

export interface DeviceConfigDAO {
    id: number,
    unique_hardware_id: string,
    automation_mode: "off" | "presence" | "sound" | "timer" | "ml",
    presence_mode: "pir_only" | "radar_only" | "fusion_or" | "fusion_and",
    sound_mode: "noise" | "clap",
    mqtt_device_name?: string,
    mqtt_broker_url?: string,
    mqtt_port?: number,
    mqtt_username?: string,
    mqtt_password?: string,
    mqtt_client_id?: string,
    mqtt_topic_prefix?: string,
    created_at: Date,
    updated_at: Date,
}
