import {Router} from "express";
import db from "../../../lib/db";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {DeviceDAO, DeviceDTO, DeviceUpdateAliasDTO} from "../../../lib/definition";
import {deviceConnectionMap} from "../../../lib/socket-manager";

const DeviceManageRouter = Router();

DeviceManageRouter.get("/", async (req, res) => {
    try {
        const userId = req.user!.id;
        const selectDevicesQuery = `SELECT unique_hardware_id, alias FROM devices WHERE user_id = ?`;
        const [devices] = await db.execute<RowDataPacket[]>(selectDevicesQuery, [userId]) as [DeviceDAO[], any];
        const deviceDTO: DeviceDTO[] = devices.map((device) => {
            const status = deviceConnectionMap.has(device.unique_hardware_id);
            return {
                ...device,
                status,
            }
        });
        res.status(200).json(deviceDTO);
    } catch (error) {
        console.error("Error fetching devices:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.post("/", async (req, res) => {
    try {
        const userId = req.user!.id;
        const updateDTO: DeviceUpdateAliasDTO = req.body;
        if (!updateDTO.unique_hardware_id || !updateDTO.alias) {
            res.status(400).json({
                error: "uniqueHardwareId and alias are required"
            });
            return;
        }
        const updateDeviceAliasQuery = `UPDATE devices SET alias = ? WHERE unique_hardware_id = ? AND user_id = ?`;
        const [result] = await db.execute<ResultSetHeader>(updateDeviceAliasQuery, [updateDTO.alias, updateDTO.unique_hardware_id, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({
                error: "Device not found or not owned by user"
            });
            return;
        }
        res.status(200).json({
            message: "Device alias updated successfully"
        });
    } catch (error) {
        console.error("Error updating device alias:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.delete("/", async (req, res) => {
    try {
        const userId = req.user!.id;
        const uniqueHardwareId: string = req.body.uniqueHardwareId;
        if (!uniqueHardwareId) {
            res.status(400).json({
                error: "uniqueHardwareId is required"
            });
            return;
        }
        const deleteDeviceQuery = `DELETE FROM devices WHERE unique_hardware_id = ? AND user_id = ?`;
        const [result] = await db.execute<ResultSetHeader>(deleteDeviceQuery, [uniqueHardwareId, userId]);
        if (result.affectedRows === 0) {
            res.status(404).json({
                error: "Device not found or not owned by user"
            });
            return;
        }
        res.status(200).json({
            message: "Device unbound successfully"
        });
    } catch (error) {
        console.error("Error unbinding device:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
})

export default DeviceManageRouter;
