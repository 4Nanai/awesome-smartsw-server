import {Request, Response, NextFunction} from "express";
import {verifyToken} from "./jwt";

const loginUserInterceptor = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.token as string | undefined;
    if (!token) {
        res.status(401).json({message: "Unauthorized: No token provided"});
        return;
    }
    try {
        const userPayload = verifyToken(token);
        if (!userPayload) {
            res.status(401).json({message: "Login exired, please log in again"});
            return;
        }
        req.user = userPayload;
        next();
    } catch (error) {
        res.status(401).json({message: "Unauthorized: Invalid token"});
    }
}

export {loginUserInterceptor};
