import {Router} from "express";
import db from "../../../lib/db";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {DeviceInfoDAO, DeviceDTO, DeviceUpdateAliasDTO, SetAutomationModeDTO, SetPresenceModeDTO, SetSensorOffDelayDTO, EndpointMessageDTO, DeviceConfigDAO, MQTTConfigDTO, SetTimerDTO, TimerEntry} from "../../../lib/definition";
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

DeviceManageRouter.post("/config/sensor-off-delay", async (req, res) => {
    try {
        const userId = req.user!.id;
        const configDTO: SetSensorOffDelayDTO = req.body;
        
        if (!configDTO.unique_hardware_id || !configDTO.delay) {
            res.status(400).json({
                error: "unique_hardware_id and delay are required"
            });
            return;
        }
        
        if (typeof configDTO.delay !== "number" || configDTO.delay < 15 || configDTO.delay > 300) {
            res.status(400).json({
                error: "Invalid delay. Must be a number between 15 and 300 seconds"
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
            INSERT INTO device_configs (unique_hardware_id, sensor_off_delay)
            VALUES (?, ?)
            ON DUPLICATE KEY UPDATE sensor_off_delay = ?, updated_at = CURRENT_TIMESTAMP
        `;
        await db.execute<ResultSetHeader>(upsertConfigQuery, [
            configDTO.unique_hardware_id,
            configDTO.delay,
            configDTO.delay
        ]);
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: configDTO.unique_hardware_id,
                config: {
                    sensor_off_delay: configDTO.delay
                }
            }
        };
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "Sensor off delay configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring sensor off delay:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.post("/:uniqueHardwareId/mqtt-config", async (req, res) => {
    try {
        const userId = req.user!.id;
        const uniqueHardwareId = req.params.uniqueHardwareId;
        const configDTO: MQTTConfigDTO = req.body;
        
        if (!uniqueHardwareId || configDTO.enable === undefined) {
            res.status(400).json({
                error: "uniqueHardwareId and enabled are required"
            });
            return;
        }
        
        if (configDTO.enable && (!configDTO.broker_url || !configDTO.port || !configDTO.topic_prefix)) {
            res.status(400).json({
                error: "broker_url, port, and topic_prefix are required when enabled is true"
            });
            return;
        }
        
        const verifyOwnershipQuery = `SELECT user_id FROM devices WHERE unique_hardware_id = ?`;
        const [rows] = await db.execute<RowDataPacket[]>(verifyOwnershipQuery, [uniqueHardwareId]);
        
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
        
        const ws = deviceConnectionMap.get(uniqueHardwareId);
        if (!ws || ws.readyState !== 1) {
            res.status(503).json({
                error: "Device is not online"
            });
            return;
        }
        
        if (configDTO.enable) {
            // Enable MQTT: save configuration
            const upsertConfigQuery = `
                INSERT INTO device_configs (unique_hardware_id, mqtt_device_name, mqtt_broker_url, mqtt_port, mqtt_username, mqtt_password, mqtt_client_id, mqtt_topic_prefix, mqtt_ha_discovery_enabled, mqtt_ha_discovery_prefix)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE mqtt_device_name = ?, mqtt_broker_url = ?, mqtt_port = ?, mqtt_username = ?, mqtt_password = ?, mqtt_client_id = ?, mqtt_topic_prefix = ?, mqtt_ha_discovery_enabled = ?, mqtt_ha_discovery_prefix = ?, updated_at = CURRENT_TIMESTAMP
            `;
            await db.execute<ResultSetHeader>(upsertConfigQuery, [
                uniqueHardwareId,
                configDTO.device_name || null,
                configDTO.broker_url,
                configDTO.port,
                configDTO.username || null,
                configDTO.password || null,
                configDTO.client_id || null,
                configDTO.topic_prefix,
                configDTO.ha_discovery_enabled !== undefined ? configDTO.ha_discovery_enabled : null,
                configDTO.ha_discovery_prefix || null,
                configDTO.device_name || null,
                configDTO.broker_url,
                configDTO.port,
                configDTO.username || null,
                configDTO.password || null,
                configDTO.client_id || null,
                configDTO.topic_prefix,
                configDTO.ha_discovery_enabled !== undefined ? configDTO.ha_discovery_enabled : null,
                configDTO.ha_discovery_prefix || null
            ]);
        } else {
            // Disable MQTT: set all MQTT fields to null
            const disableConfigQuery = `
                UPDATE device_configs
                SET mqtt_device_name = NULL, mqtt_broker_url = NULL, mqtt_port = NULL, mqtt_username = NULL, mqtt_password = NULL, mqtt_client_id = NULL, mqtt_topic_prefix = NULL, mqtt_ha_discovery_enabled = NULL, mqtt_ha_discovery_prefix = NULL, updated_at = CURRENT_TIMESTAMP
                WHERE unique_hardware_id = ?
            `;
            await db.execute<ResultSetHeader>(disableConfigQuery, [uniqueHardwareId]);
        }
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: uniqueHardwareId,
                config: {
                    mqtt_config: configDTO
                }
            }
        };
        console.log("Sending MQTT configuration to device:", configDTO);
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "MQTT configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring MQTT:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

DeviceManageRouter.post("/config/timer", async (req, res) => {
    try {
        const userId = req.user!.id;
        const configDTO: SetTimerDTO = req.body;
        
        if (!configDTO.unique_hardware_id || !configDTO.timer) {
            res.status(400).json({
                error: "unique_hardware_id and timer are required"
            });
            return;
        }
        
        // Verify ownership
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
        
        // Check if device is online
        const ws = deviceConnectionMap.get(configDTO.unique_hardware_id);
        if (!ws || ws.readyState !== 1) {
            res.status(503).json({
                error: "Device is not online"
            });
            return;
        }
        
        // Validate timer data
        const days = Object.keys(configDTO.timer);
        for (const day of days) {
            const dayNum = parseInt(day);
            if (isNaN(dayNum) || dayNum < 0 || dayNum > 6) {
                res.status(400).json({
                    error: `Invalid day of week: ${day}. Must be 0-6 (Sunday-Saturday)`
                });
                return;
            }
            
            const entries = configDTO.timer[day];
            if (!Array.isArray(entries)) {
                res.status(400).json({
                    error: `Timer entries for day ${day} must be an array`
                });
                return;
            }
            
            if (entries.length > 20) {
                res.status(400).json({
                    error: `Maximum 20 timer entries per day. Day ${day} has ${entries.length} entries`
                });
                return;
            }
            
            for (const entry of entries) {
                if (typeof entry.h !== 'number' || entry.h < 0 || entry.h > 23) {
                    res.status(400).json({
                        error: `Invalid hour in timer entry. Must be 0-23`
                    });
                    return;
                }
                if (typeof entry.m !== 'number' || entry.m < 0 || entry.m > 59) {
                    res.status(400).json({
                        error: `Invalid minute in timer entry. Must be 0-59`
                    });
                    return;
                }
                if (typeof entry.s !== 'number' || entry.s < 0 || entry.s > 59) {
                    res.status(400).json({
                        error: `Invalid second in timer entry. Must be 0-59`
                    });
                    return;
                }
                if (typeof entry.a !== 'boolean') {
                    res.status(400).json({
                        error: `Invalid action in timer entry. Must be boolean`
                    });
                    return;
                }
            }
        }
        
        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();
            
            // Delete existing timers for this device
            const deleteTimersQuery = `DELETE FROM device_timers WHERE unique_hardware_id = ?`;
            await connection.execute<ResultSetHeader>(deleteTimersQuery, [configDTO.unique_hardware_id]);
            
            // Insert new timers
            const insertTimerQuery = `INSERT INTO device_timers (unique_hardware_id, day_of_week, hour, minute, second, action) VALUES (?, ?, ?, ?, ?, ?)`;
            for (const day of days) {
                const entries = configDTO.timer[day];
                for (const entry of entries!) {
                    await connection.execute<ResultSetHeader>(insertTimerQuery, [
                        configDTO.unique_hardware_id,
                        parseInt(day),
                        entry.h,
                        entry.m,
                        entry.s,
                        entry.a
                    ]);
                }
            }
            
            await connection.commit();
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
        
        // Notify endpoint to update its configuration
        const message: EndpointMessageDTO = {
            type: "set_config",
            payload: {
                uniqueHardwareId: configDTO.unique_hardware_id,
                config: {
                    timer: configDTO.timer
                }
            }
        };
        
        ws.send(JSON.stringify(message));
        
        res.status(200).json({
            message: "Timer configuration sent successfully"
        });
    } catch (error) {
        console.error("Error configuring timer:", error);
        res.status(500).json({
            error: "Internal Server Error"
        });
    }
});

export default DeviceManageRouter;
