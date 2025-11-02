import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import {BindingTokenDAO, WebSocketMessageDTO} from "./definition";
import db from "./db";
import {ResultSetHeader, RowDataPacket} from "mysql2";

// extend WebSocket to include hardwareId
interface AuthenticatedWebSocket extends WebSocket {
    hardwareId?: string;
}

// connection map to track active connections
export const connectionMap = new Map<string, AuthenticatedWebSocket>();

// authentication timeout
const AUTH_TIMEOUT_MS = 10000;

/**
 * Initializes the WebSocket server and sets up connection handling.
 * @param httpServer The HTTP server to attach the WebSocket server to.
 */
export function initWebSocketServer(httpServer: HttpServer) {
    const wss = new WebSocketServer({ server: httpServer });

    wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        console.log(`[SocketManager] Client connected from ${req.socket.remoteAddress}`);

        // If the client does not authenticate within the timeout, close the connection
        const authTimeout = setTimeout(() => {
            if (!ws.hardwareId) {
                console.log('[SocketManager] Client failed to authenticate in time. Closing.');
                ws.terminate();
            }
        }, AUTH_TIMEOUT_MS);

        // handle incoming messages
        ws.on('message', async (message: Buffer) => {
            let data: WebSocketMessageDTO;
            try {
                data = JSON.parse(message.toString());
                if (typeof data !== 'object' || data === null || !data.type) {
                    throw new Error('Invalid JSON format');
                }
            } catch (error) {
                console.warn('[SocketManager] Received invalid message format: ', error);
                ws.close();
                return;
            }

            // authenticate device
            if (data.type === 'device_auth' && data.payload?.uniqueHardwareId) {
                const hardwareId = data.payload.uniqueHardwareId;
                const token = data.payload.token;
                if (!token) {
                    console.warn('[SocketManager] Auth failed: Missing token');
                    ws.close();
                    return;
                }
                // TODO: query database to verify hardwareId
                let isAuthenticated = false;
                try {
                    // Start transaction
                    await db.beginTransaction();

                    const selectBindingTokenQuery = `SELECT id, user_id FROM binding_tokens WHERE token = ? AND is_used = 0 AND expires_at > NOW()`;
                    const [selectBTResult] = await db.execute<RowDataPacket[]>(selectBindingTokenQuery, [token]) as [BindingTokenDAO[], any];
                    if (selectBTResult.length !== 1) {
                        throw new Error('Invalid or expired token');
                    }
                    const updateBindingTokenQuery = `UPDATE binding_tokens SET is_used = 1 WHERE id = ?`;
                    const [updateBTResult] = await db.execute<ResultSetHeader>(updateBindingTokenQuery, [selectBTResult[0]!.id]);
                    if (updateBTResult.affectedRows !== 1) {
                        throw new Error('Failed to mark token as used');
                    }
                    const insertDeviceQuery = `INSERT INTO devices (unique_hardware_id, user_id) VALUES (?, ?) ON DUPLICATE KEY UPDATE unique_hardware_id = unique_hardware_id`;
                    const [insertDeviceResult] = await db.execute<ResultSetHeader>(insertDeviceQuery, [hardwareId, selectBTResult[0]!.user_id]);
                    if (insertDeviceResult.affectedRows < 1) {
                        throw new Error('Failed to register device');
                    }
                    db.commit();
                    isAuthenticated = true;
                } catch (error) {
                    console.error('[SocketManager] Database error during authentication:', error);
                    db.rollback();
                    ws.close();
                    return;
                }

                if (!isAuthenticated) {
                    console.warn(`[SocketManager] Auth failed: Unknown hardwareId ${hardwareId}`);
                    ws.close();
                    return;
                }

                // Authentication successful
                console.log(`[SocketManager] Device ${hardwareId} authenticated.`);
                clearTimeout(authTimeout); // clear the auth timeout

                // handle stale connections
                if (connectionMap.has(hardwareId)) {
                    console.log(`[SocketManager] Found stale connection for ${hardwareId}. Terminating it.`);
                    const oldSocket = connectionMap.get(hardwareId);
                    oldSocket?.terminate();
                }

                // register the new connection
                ws.hardwareId = hardwareId;
                connectionMap.set(hardwareId, ws);

                ws.send(JSON.stringify({ type: 'auth_success', message: 'Authentication successful.' }));
                return;
            }

            // handle other message types
            if (ws.hardwareId) {
                // handle data report
                if (data.type === 'data_report') {
                    console.log(`[SocketManager] Received data from ${ws.hardwareId}:`, data.payload);
                    // TODO: handle data report
                }
                // handle other message types...
            } else {
                // unauthenticated client sent other messages
                console.warn('[SocketManager] Client sent data before authenticating. Closing.');
                ws.close();
            }
        });

        // handle connection close
        ws.on('close', (code, reason) => {
            clearTimeout(authTimeout);
            if (ws.hardwareId) {
                if (connectionMap.get(ws.hardwareId) === ws) {
                    connectionMap.delete(ws.hardwareId);
                    console.log(`[SocketManager] Device ${ws.hardwareId} disconnected. (Code: ${code}, Reason: ${reason})`);
                } else {
                    console.log(`[SocketManager] Stale connection for ${ws.hardwareId} closed.`);
                }
            } else {
                console.log('[SocketManager] Unauthenticated client disconnected.');
            }
        });

        // handle errors
        ws.on('error', (error) => {
            console.error('[SocketManager] WebSocket error:', error);
        });
    });

    console.log('[SocketManager] WebSocket server initialized and attached to HTTP server.');
}
