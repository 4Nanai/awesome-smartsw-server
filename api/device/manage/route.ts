import {Router} from "express";
import db from "../../../lib/db";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {DeviceInfoDAO, DeviceDTO, DeviceUpdateAliasDTO, SetAutomationModeDTO, SetPresenceModeDTO, SetSoundModeDTO, EndpointMessageDTO, DeviceConfigDAO} from "../../../lib/definition";
import {deviceConnectionMap} from "../../../lib/socket-manager";

const DeviceManageRouter = Router();

DeviceManageRouter.get("/", async (req, res) => {
    try {
        const userId = req.user!.id;
        const selectDevicesQuery = `SELECT unique_hardware_id, alias
                                    FROM devices
                                    WHERE user_id = ?`;
        const [devices] = await db.execute<RowDataPacket[]>(selectDevicesQuery, [userId]) as [DeviceInfoDAO[], any];
        const deviceDTO: DeviceDTO[] = devices.map((device) => {
            return {
                ...device,
                status: "unknown",
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

DeviceManageRouter.get("/stats", async (req, res) => {
    try {
        const userId = req.user!.id;
        const selectDevicesQuery = `SELECT unique_hardware_id
                                    FROM devices
                                    WHERE user_id = ?`;
        const [devices] = await db.execute<RowDataPacket[]>(selectDevicesQuery, [userId]) as [DeviceInfoDAO[], any];
        
        const totalCount = devices.length;
        let onlineCount = 0;
        
        devices.forEach((device) => {
            const deviceSocket = deviceConnectionMap.get(device.unique_hardware_id);
            if (deviceSocket && deviceSocket.readyState === 1) {
                onlineCount++;
            }
        });
        
        res.status(200).json({
            total: totalCount,
            online: onlineCount
        });
    } catch (error) {
        console.error("Error fetching device stats:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.put("/", async (req, res) => {
    try {
        const userId = req.user!.id;
        const updateDTO: DeviceUpdateAliasDTO = req.body;
        if (!updateDTO.unique_hardware_id || !updateDTO.alias) {
            res.status(400).json({
                error: "uniqueHardwareId and alias are required"
            });
            return;
        }
        const updateDeviceAliasQuery = `UPDATE devices
                                        SET alias = ?
                                        WHERE unique_hardware_id = ?
                                          AND user_id = ?`;
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

DeviceManageRouter.delete("/:uniqueHardwareId", async (req, res) => {
    try {
        const userId = req.user!.id;
        const uniqueHardwareId = req.params.uniqueHardwareId;
        if (!uniqueHardwareId) {
            res.status(400).json({
                error: "uniqueHardwareId is required"
            });
            return;
        }
        const deleteDeviceQuery = `DELETE
                                   FROM devices
                                   WHERE unique_hardware_id = ?
                                     AND user_id = ?`;
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
        const ws = deviceConnectionMap.get(uniqueHardwareId);
        if (ws) {
            if (ws.readyState === 1) {
                ws.send(JSON.stringify({
                    type: "device_unbound",
                    message: "This device has been unbound from the user account and will disconnect."
                }));
                ws.close();
            }
            deviceConnectionMap.delete(uniqueHardwareId);
        }
    } catch (error) {
        console.error("Error unbinding device:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
})

DeviceManageRouter.post("/config/automation-mode", async (req, res) => {
    try {
        const userId = req.user!.id;
        const configDTO: SetAutomationModeDTO = req.body;
        
        if (!configDTO.unique_hardware_id || !configDTO.mode) {
            res.status(400).json({
                error: "unique_hardware_id and mode are required"
            });
            return;
        }
        
        const validModes = ["off", "presence", "sound", "timer", "ml"];
        if (!validModes.includes(configDTO.mode)) {
            res.status(400).json({
                error: "Invalid mode. Must be one of: off, presence, sound, timer, ml"
            });
            return;
        }
        
        const verifyOwnershipQuery = `SELECT user_id FROM devices WHERE unique_hardware_id = ?`;
        const [rows] = await db.execute<RowDataPacket[]>(verifyOwnershipQuery, [configDTO.unique_hardware_id]);
        
        if (rows.length === 0 || !rows[0]) {
            res.status(404).json({
                error: "Device not found"
            });
            return;
        }
        
        if (rows[0].user_id !== userId) {
            res.status(403).json({
                error: "You do not have permission to configure this device"
            });
            return;
        }
        
        const ws = deviceConnectionMap.get(configDTO.unique_hardware_id);
        if (!ws || ws.readyState !== 1) {
            res.status(503).json({
                error: "Device is not online"
            });
            return;
        }
        
        const upsertConfigQuery = `
            INSERT INTO device_configs (unique_hardware_id, automation_mode)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE automation_mode = ?, updated_at = CURRENT_TIMESTAMP
        `;
        await db.execute<ResultSetHeader>(upsertConfigQuery, [
            configDTO.unique_hardware_id,
            configDTO.mode,
            configDTO.mode
        ]);
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: configDTO.unique_hardware_id,
                config: {
                    automation_mode: configDTO.mode
                }
            }
        };
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "Automation mode configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring automation mode:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.post("/config/presence-mode", async (req, res) => {
    try {
        const userId = req.user!.id;
        const configDTO: SetPresenceModeDTO = req.body;
        
        if (!configDTO.unique_hardware_id || !configDTO.mode) {
            res.status(400).json({
                error: "unique_hardware_id and mode are required"
            });
            return;
        }
        
        const validModes = ["pir_only", "radar_only", "fusion_or", "fusion_and"];
        if (!validModes.includes(configDTO.mode)) {
            res.status(400).json({
                error: "Invalid mode. Must be one of: pir_only, radar_only, fusion_or, fusion_and"
            });
            return;
        }
        
        const verifyOwnershipQuery = `SELECT user_id FROM devices WHERE unique_hardware_id = ?`;
        const [rows] = await db.execute<RowDataPacket[]>(verifyOwnershipQuery, [configDTO.unique_hardware_id]);
        
        if (rows.length === 0 || !rows[0]) {
            res.status(404).json({
                error: "Device not found"
            });
            return;
        }
        
        if (rows[0].user_id !== userId) {
            res.status(403).json({
                error: "You do not have permission to configure this device"
            });
            return;
        }
        
        const ws = deviceConnectionMap.get(configDTO.unique_hardware_id);
        if (!ws || ws.readyState !== 1) {
            res.status(503).json({
                error: "Device is not online"
            });
            return;
        }
        
        const upsertConfigQuery = `
            INSERT INTO device_configs (unique_hardware_id, presence_mode)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE presence_mode = ?, updated_at = CURRENT_TIMESTAMP
        `;
        await db.execute<ResultSetHeader>(upsertConfigQuery, [
            configDTO.unique_hardware_id,
            configDTO.mode,
            configDTO.mode
        ]);
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: configDTO.unique_hardware_id,
                config: {
                    presence_mode: configDTO.mode
                }
            }
        };
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "Presence mode configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring presence mode:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.post("/config/sound-mode", async (req, res) => {
    try {
        const userId = req.user!.id;
        const configDTO: SetSoundModeDTO = req.body;
        
        if (!configDTO.unique_hardware_id || !configDTO.mode) {
            res.status(400).json({
                error: "unique_hardware_id and mode are required"
            });
            return;
        }
        
        const validModes = ["noise", "clap"];
        if (!validModes.includes(configDTO.mode)) {
            res.status(400).json({
                error: "Invalid mode. Must be one of: noise, clap"
            });
            return;
        }
        
        const verifyOwnershipQuery = `SELECT user_id FROM devices WHERE unique_hardware_id = ?`;
        const [rows] = await db.execute<RowDataPacket[]>(verifyOwnershipQuery, [configDTO.unique_hardware_id]);
        
        if (rows.length === 0 || !rows[0]) {
            res.status(404).json({
                error: "Device not found"
            });
            return;
        }
        
        if (rows[0].user_id !== userId) {
            res.status(403).json({
                error: "You do not have permission to configure this device"
            });
            return;
        }
        
        const ws = deviceConnectionMap.get(configDTO.unique_hardware_id);
        if (!ws || ws.readyState !== 1) {
            res.status(503).json({
                error: "Device is not online"
            });
            return;
        }
        
        const upsertConfigQuery = `
            INSERT INTO device_configs (unique_hardware_id, sound_mode)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE sound_mode = ?, updated_at = CURRENT_TIMESTAMP
        `;
        await db.execute<ResultSetHeader>(upsertConfigQuery, [
            configDTO.unique_hardware_id,
            configDTO.mode,
            configDTO.mode
        ]);
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: configDTO.unique_hardware_id,
                config: {
                    sound_mode: configDTO.mode
                }
            }
        };
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "Sound mode configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring sound mode:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

export default DeviceManageRouter;
