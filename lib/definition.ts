export interface WebSocketMessageDTO {
    type: string;
    payload?: {
        uniqueHardwareId: string;
        [key: string]: any;
    };
}

export interface UserRegisterDTO {
    username: string;
    password: string;
    email: string;
}
