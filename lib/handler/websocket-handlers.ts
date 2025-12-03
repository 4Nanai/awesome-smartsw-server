import {AuthenticatedWebSocket, deviceConnectionMap, userConnectionMap, startHeartbeat} from "../socket-manager";
import {BindingTokenDAO, DeviceBindingDAO, DeviceConfigDAO, DeviceInfoDAO, EndpointConfigDTO, EndpointMessageDTO, SensorDataDAO, UserMessageDTO} from "../definition";
import db from "../db";
import {ResultSetHeader, RowDataPacket} from "mysql2";
import {verifyToken} from "../jwt";
import {WebSocket} from 'ws';

/**
 * handle authentication messages
 */
async function handleAuthentication(ws: AuthenticatedWebSocket, data: EndpointMessageDTO | UserMessageDTO, authTimeout: NodeJS.Timeout) {
    switch (data.type) {
        case 'device_auth':
            await handleDeviceAuth(ws, data as EndpointMessageDTO, authTimeout);
            break;
        case 'user_auth':
            await handleUserAuth(ws, data as UserMessageDTO, authTimeout);
            break;
        case 'device_reconnect':
            await handleDeviceReconnect(ws, data as EndpointMessageDTO, authTimeout);
            break;
        default:
            console.warn('[SocketManager] Client sent non-auth data before authenticating. Closing.');
            ws.close();
    }
}

/**
 * handle device authentication
 */
async function handleDeviceAuth(ws: AuthenticatedWebSocket, data: EndpointMessageDTO, authTimeout: NodeJS.Timeout) {
    if (!data.payload?.uniqueHardwareId || !data.payload?.token) {
        console.warn('[SocketManager] Auth failed: Missing hardwareId or token');
        ws.close();
        return;
    }

    const {uniqueHardwareId: hardwareId, token} = data.payload;
    let userId: number | null = null;
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const selectBindingTokenQuery = `SELECT id, user_id FROM binding_tokens WHERE token = ? AND is_used = 0 AND expires_at > NOW()`;
        const [selectBTResult] = await connection.execute<RowDataPacket[]>(selectBindingTokenQuery, [token]) as [BindingTokenDAO[], any];
        if (selectBTResult.length !== 1) {
            throw new Error('Invalid or expired token');
        }

        const updateBindingTokenQuery = `UPDATE binding_tokens SET is_used = 1 WHERE id = ?`;
        const [updateBTResult] = await connection.execute<ResultSetHeader>(updateBindingTokenQuery, [selectBTResult[0]!.id]);
        if (updateBTResult.affectedRows !== 1) {
            throw new Error('Failed to mark token as used');
        }

        const insertDeviceQuery = `INSERT INTO devices (unique_hardware_id, user_id, alias) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE unique_hardware_id = unique_hardware_id`;
        const [insertDeviceResult] = await connection.execute<ResultSetHeader>(insertDeviceQuery, [hardwareId, selectBTResult[0]!.user_id, `New Device ${hardwareId.substring(0, 5)}`]);
        if (insertDeviceResult.affectedRows < 1) {
            throw new Error('Failed to register device');
        }

        await connection.commit();
        userId = selectBTResult[0]!.user_id;
    } catch (error) {
        console.error('[SocketManager] Database error during device authentication:', error);
        await connection.rollback();
        ws.close();
        return;
    } finally {
        connection.release();
    }

    // auth success
    console.log(`[SocketManager] Device ${hardwareId} authenticated.`);
    clearTimeout(authTimeout);

    // handle stale connection
    if (deviceConnectionMap.has(hardwareId)) {
        console.log(`[SocketManager] Found stale connection for ${hardwareId}. Terminating it.`);
        deviceConnectionMap.get(hardwareId)?.terminate();
    }

    // register new connection
    ws.hardwareId = hardwareId;
    ws.userId = userId;
    deviceConnectionMap.set(hardwareId, ws);

    // start heartbeat monitoring
    startHeartbeat(ws);

    // reply to device
    ws.send(JSON.stringify({type: 'auth_success', message: 'Authentication successful.'}));
}

async function handleDeviceReconnect(ws: AuthenticatedWebSocket, data: EndpointMessageDTO, authTimeout: NodeJS.Timeout) {
    if (!data.payload?.uniqueHardwareId) {
        console.warn('[SocketManager] Device reconnect failed: Missing hardwareId');
        ws.close();
        return;
    }

    const hardwareId = data.payload.uniqueHardwareId;

    // auth device
    let user_id: number;
    try {
        const selectDeviceQuery = `SELECT user_id, unique_hardware_id FROM devices WHERE unique_hardware_id = ?`;
        const [result] = await db.execute(selectDeviceQuery, [hardwareId]) as [DeviceBindingDAO[], any];
        if (result.length !== 1) {
            console.warn(`[SocketManager] Device reconnect failed: Device ${hardwareId} not registered`);
            ws.send(JSON.stringify({type: 'device_unbound', message: 'Device not registered.'}));
            return;
        }
        user_id = result[0]!.user_id;
    } catch (error) {
        console.error('[SocketManager] Database error during device reconnection:', error);
        ws.close();
        return;
    }

    console.log(`[SocketManager] Device ${hardwareId} reconnected.`);
    clearTimeout(authTimeout);

    // handle stale connection
    if (deviceConnectionMap.has(hardwareId)) {
        console.log(`[SocketManager] Found stale connection for ${hardwareId}. Terminating it.`);
        deviceConnectionMap.get(hardwareId)?.terminate();
    }

    // register new connection
    ws.hardwareId = hardwareId;
    ws.userId = user_id;
    deviceConnectionMap.set(hardwareId, ws);

    // start heartbeat monitoring
    startHeartbeat(ws);

    // send configuration to device (if any)
    let configDTO: EndpointConfigDTO | undefined = undefined;
    try {
        const selectDeviceConfigQuery = `SELECT automation_mode, presence_mode, sound_mode FROM device_configs WHERE unique_hardware_id = ?`;
        const [configResult] = await db.execute<RowDataPacket[]>(selectDeviceConfigQuery, [hardwareId]) as [DeviceConfigDAO[], any];
        if (configResult.length === 1) {
            const config = configResult[0]!;
            configDTO = {
                automation_mode: config.automation_mode,
                presence_mode: config.presence_mode,
                sound_mode: config.sound_mode,
            }
        }
        else {
            console.log(`[SocketManager] No existing configuration found for device ${hardwareId} during reconnection.`);
        }
    } catch (error) {
        console.error('[SocketManager] Database error fetching device configuration during reconnection:', error);
    }

    // reply to device
    const response: EndpointMessageDTO = {
        type: "auth_success",
        payload: {
            uniqueHardwareId: hardwareId,
        }
    };
    if (configDTO) {
        response.payload!.config = configDTO;
    }
    ws.send(JSON.stringify(response));
}

/**
 * handle user authentication
 */
async function handleUserAuth(ws: AuthenticatedWebSocket, data: UserMessageDTO, authTimeout: NodeJS.Timeout) {
    if (!data.payload?.token) {
        console.warn('[SocketManager] User auth failed: Missing token');
        ws.close();
        return;
    }

    const token = data.payload.token;
    const userPayload = verifyToken(token);
    if (!userPayload) {
        console.warn('[SocketManager] User auth failed: Invalid token');
        ws.send(JSON.stringify({type: 'auth_failure', message: 'Invalid or expired token.'}));
        ws.close();
        return;
    }

    const userId = userPayload.id;
    console.log(`[SocketManager] User ${userId} authenticated.`);
    clearTimeout(authTimeout);

    // handle stale connection
    if (userConnectionMap.has(userId.toString())) {
        console.log(`[SocketManager] Found stale connection for user ${userId}. Terminating it.`);
        userConnectionMap.get(userId.toString())?.terminate();
    }

    // register new connection
    ws.userId = userId;
    userConnectionMap.set(userId.toString(), ws);

    // start heartbeat monitoring
    startHeartbeat(ws);

    // reply to user
    ws.send(JSON.stringify({type: 'auth_success', message: 'User authentication successful.'}));
}


/**
 * handle messages from authenticated devices
 */
async function handleDeviceMessage(ws: AuthenticatedWebSocket, data: EndpointMessageDTO) {
    switch (data.type) {
        case 'data_report':
            console.log(`[SocketManager] Received sensor data from ${ws.hardwareId}:`, data.payload);
            // TODO: handle data report
            if (data.payload?.sensor) {
                await handleSensorData(ws.hardwareId!, data.payload.sensor);
            }
            else {
                console.error('[SocketManager] No sensor data found in data report');
            }
            break;

        case 'endpoint_state':
            if (data.payload?.state && ws.hardwareId) {
                console.log(`[SocketManager] Received state from ${ws.hardwareId}:`, data.payload);
                try {
                    const selectUserIdQuery = `SELECT user_id FROM devices WHERE unique_hardware_id = ?`;
                    const [rows] = await db.execute<RowDataPacket[]>(selectUserIdQuery, [ws.hardwareId]) as [{ user_id: number }[], any];

                    if (rows.length !== 1) {
                        throw new Error('Device not registered');
                    }

                    const userSocket = userConnectionMap.get(rows[0]!.user_id.toString());
                    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
                        const response: UserMessageDTO = {
                            type: 'endpoint_state',
                            payload: {
                                uniqueHardwareId: ws.hardwareId,
                                state: data.payload.state,
                            },
                        };
                        userSocket.send(JSON.stringify(response));
                    } else {
                        console.warn(`[SocketManager] User ${rows[0]!.user_id} not connected. Cannot forward state.`);
                    }
                } catch (error) {
                    console.error('[SocketManager] Error forwarding endpoint state to user:', error);
                }
            }
            break;

        default:
            console.warn(`[SocketManager] Received unhandled message type '${data.type}' from device ${ws.hardwareId}`);
            break;
    }
}

/**
 * handle messages from authenticated users
 */
async function handleUserMessage(ws: AuthenticatedWebSocket, data: UserMessageDTO) {
    switch (data.type) {
        case 'set_endpoint_state':
            if (data.payload?.command && data.payload.uniqueHardwareId) {
                console.log(`[SocketManager] User ${ws.userId} sent command:`, data.payload.command);
                const targetId = data.payload.uniqueHardwareId;
                const deviceSocket = deviceConnectionMap.get(targetId);

                if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
                    const commandMessage: EndpointMessageDTO = {
                        type: 'set_endpoint_state',
                        payload: {
                            uniqueHardwareId: targetId,
                            command: data.payload.command,
                        },
                    };
                    deviceSocket.send(JSON.stringify(commandMessage));
                    const insertSwitchDataQuery = `INSERT INTO switch_data (unique_hardware_id, state, ts) VALUES (?, ?, ?)`;
                    const [result] = await db.execute<ResultSetHeader>(insertSwitchDataQuery, [
                        targetId,
                        data.payload.command.state ?? null,
                        Date.now(),
                    ]);
                    if (result.affectedRows !== 1) {
                        console.error('[SocketManager] Failed to insert switch command data into database');
                    }
                } else {
                    console.warn(`[SocketManager] Device ${targetId} not connected. Cannot forward command.`);
                    // reply to user that device is offline
                }
            }
            break;

        case 'query_endpoint_state':
            const queryAll = !data.payload?.uniqueHardwareId;
            if (queryAll) {
                console.log(`[SocketManager] User ${ws.userId} querying all endpoint states.`);
                try {
                    const selectDeviceQuery = `SELECT unique_hardware_id, alias
                                               FROM devices
                                               WHERE user_id = ?`;
                    const [devices] = await db.execute<RowDataPacket[]>(selectDeviceQuery, [ws.userId]) as [DeviceInfoDAO[], any];

                    for (const device of devices) {
                        const deviceSocket = deviceConnectionMap.get(device.unique_hardware_id);
                        if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
                            // device online, send query message
                            const message: EndpointMessageDTO = {
                                type: 'query_endpoint_state',
                                payload: {uniqueHardwareId: device.unique_hardware_id},
                            };
                            deviceSocket.send(JSON.stringify(message));
                        } else {
                            // device offline, reply error state
                            const message: UserMessageDTO = {
                                type: 'endpoint_state',
                                payload: {
                                    uniqueHardwareId: device.unique_hardware_id,
                                    state: "error",
                                },
                            };
                            ws.send(JSON.stringify(message));
                        }
                    }
                } catch (error) {
                    console.error('[SocketManager] Error querying endpoint states:', error);
                }
            } else {
                console.log(`[SocketManager] User ${ws.userId} querying endpoint state for ${data.payload?.uniqueHardwareId}.`);
                const targetId = data.payload!.uniqueHardwareId!;
                const deviceSocket = deviceConnectionMap.get(targetId);
                if (deviceSocket && deviceSocket.readyState === WebSocket.OPEN) {
                    // device online, send query message
                    const message: EndpointMessageDTO = {
                        type: 'query_endpoint_state',
                        payload: {uniqueHardwareId: targetId},
                    };
                    deviceSocket.send(JSON.stringify(message));
                } else {
                    // device offline, reply offline state
                    const message: UserMessageDTO = {
                        type: 'endpoint_state',
                        payload: {
                            uniqueHardwareId: targetId,
                            state: "error",
                        },
                    };
                    ws.send(JSON.stringify(message));
                }
            }
            break;

        default:
            console.warn(`[SocketManager] Received unhandled message type '${data.type}' from user ${ws.userId}`);
            break;
    }
}

function handleDeviceDisconnection(ws: AuthenticatedWebSocket) {
    if (!ws.hardwareId || !ws.userId) return;

    const hardwareId = ws.hardwareId;
    const userId = ws.userId;

    const userSocket = userConnectionMap.get(userId.toString());
    if (userSocket && userSocket.readyState === WebSocket.OPEN) {
        const message: UserMessageDTO = {
            type: 'endpoint_state',
            payload: {
                uniqueHardwareId: hardwareId,
                state: "error",
            },
        };
        userSocket.send(JSON.stringify(message));
    } else {
        console.log(`[SocketManager] User ${userId} not connected. Cannot notify about device disconnection.`);
    }
}

async function handleSensorData(hardwareId: string, data: SensorDataDAO) {
    const serverTimestamp = Date.now();
    
    if (data.temp_humi) {
        console.log(`[SocketManager] Received temperature: ${data.temp_humi.temperature}, humidity: ${data.temp_humi.humidity}`);
        const insertTempHumiQuary = `INSERT INTO temp_humi_data (unique_hardware_id, temperature, humidity, ts) VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(insertTempHumiQuary, [hardwareId, data.temp_humi.temperature, data.temp_humi.humidity, serverTimestamp]);
        if (result.affectedRows !== 1) {
            console.error('[SocketManager] Failed to insert temperature and humidity data into database');
        }
    }
    if (data.pir) {
        console.log(`[SocketManager] Received PIR state: ${data.pir.state}`);
        const insertPirQuary = `INSERT INTO pir_data (unique_hardware_id, state, ts) VALUES (?, ?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(insertPirQuary, [hardwareId, data.pir.state, serverTimestamp]);
        if (result.affectedRows !== 1) {
            console.error('[SocketManager] Failed to insert PIR data into database');
        }
    }
    if (data.radar) {
        console.log(`[SocketManager] Received radar state: ${data.radar.state}`);
        const insertRadarQuary = `INSERT INTO radar_data (unique_hardware_id, state, ts) VALUES (?, ?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(insertRadarQuary, [hardwareId, data.radar.state, serverTimestamp]);
        if (result.affectedRows !== 1) {
            console.error('[SocketManager] Failed to insert radar data into database');
        }
    }
    if (data.sound) {
        console.log(`[SocketManager] Received sound event`);
        const insertSoundQuary = `INSERT INTO sound_data (unique_hardware_id, ts) VALUES (?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(insertSoundQuary, [hardwareId, serverTimestamp]);
        if (result.affectedRows !== 1) {
            console.error('[SocketManager] Failed to insert sound data into database');
        }
    }
}

export {
    handleAuthentication,
    handleDeviceAuth,
    handleUserAuth,
    handleDeviceMessage,
    handleUserMessage,
    handleDeviceDisconnection
};
