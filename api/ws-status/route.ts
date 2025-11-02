import { Router } from "express";
import {connectionMap} from "../../lib/socket-manager";

const WSStatusRouter = Router();

WSStatusRouter.get("/", (req, res) => {
    const connectedHardwareIds = Array.from(connectionMap.keys());
    const userInfo = req.user!;
    res.json({
        activeConnections: connectionMap.size,
        connectedDevices: connectedHardwareIds,
        userInfo: userInfo
    });
});

export default WSStatusRouter;
