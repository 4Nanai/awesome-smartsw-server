import { Router } from "express";
import {connectionMap} from "../../lib/socket-manager";

const WSStatusRouter = Router();

WSStatusRouter.get("/", (req, res) => {
    const connectedHardwareIds = Array.from(connectionMap.keys());
    res.json({
        activeConnections: connectionMap.size,
        connectedDevices: connectedHardwareIds
    });
});

export default WSStatusRouter;
