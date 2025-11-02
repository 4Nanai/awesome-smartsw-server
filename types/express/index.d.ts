import {UserPayload} from "../../lib/definition";

declare module "express-serve-static-core" {
    interface Request {
        user?: UserPayload;
    }
}
