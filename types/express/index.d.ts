import {UserPayload} from "../../lib/definition";

declare global {
    namespace Express {
        interface Request {
            user?: UserPayload;
        }
    }
}

declare module "express-serve-static-core" {
    interface Request {
        user?: UserPayload;
    }
}
