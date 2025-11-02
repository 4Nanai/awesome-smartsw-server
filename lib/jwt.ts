import jwt, {Secret} from "jsonwebtoken";
import {UserPayload} from "./definition";

const SECRET_KEY: Secret = process.env.JWT_SECRET || "your-very-secure-secret-jwt-key";
const EXPIRES_IN = Number(process.env.JWT_EXPIRES_IN) || 3600;

const generateToken = (payload: UserPayload) => {
    return jwt.sign(payload, SECRET_KEY, {expiresIn: EXPIRES_IN});
}

const verifyToken = (token: string) => {
    try {
        return jwt.verify(token, SECRET_KEY) as UserPayload;
    } catch (error) {
        return null;
    }
}

export {generateToken, verifyToken};
