export interface WebSocketMessageDTO {
    type: string,
    payload?: {
        uniqueHardwareId: string,
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
