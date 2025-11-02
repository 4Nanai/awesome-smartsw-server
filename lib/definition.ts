export interface WebSocketMessageDTO {
    type: string,
    payload?: {
        uniqueHardwareId: string,
        token?: string,
        [key: string]: any,
    },
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

export interface DeviceDAO {
    unique_hardware_id: string,
    alias: string | null,
}

export interface DeviceUpdateAliasDTO {
    uniqueHardwareId: string,
    alias: string,
}
