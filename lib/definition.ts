export interface EndpointMessageDTO {
    type: "device_auth" | "device_reconnect" | "device_unbound" | "data_report" | "endpoint_state" | "query_endpoint_state" | "user_command" | "auth_success",
    payload?: {
        uniqueHardwareId: string,
        token?: string,
        state?: "on" | "off" | "online" | "offline" | "error",
        command?: {
            type: "toggle" | string,
            state?: boolean
            data?: string,
        },
        sensor?: {
            type: string,
            data: any,
        }
        [key: string]: any,
    },
    message?: string,
}

export interface UserMessageDTO {
    type: "user_auth" | "user_command" | "auth_success" | "auth_failure" | "new_device_connected" | "query_endpoint_state" | "endpoint_state",
    payload?: {
        uniqueHardwareId?: string,
        token?: string,
        state?: "on" | "off" | "online" | "offline" | "error",
        command?: {
            type: "toggle" | string,
            state?: boolean,
            data?: string,
        },
        [key: string]: any,
    },
    message?: string,
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
    status: "online" | "offline",
}

export interface DeviceUpdateAliasDTO {
    unique_hardware_id: string,
    alias: string,
}
