import { Router } from "express";
import {deviceConnectionMap} from "../../lib/socket-manager";

const WSStatusRouter = Router();

WSStatusRouter.get("/", (req, res) => {
    const connectedHardwareIds = Array.from(deviceConnectionMap.keys());
    const userInfo = req.user!;
    res.json({
        activeConnections: deviceConnectionMap.size,
        connectedDevices: connectedHardwareIds,
        userInfo: userInfo
    });
});

export default WSStatusRouter;
