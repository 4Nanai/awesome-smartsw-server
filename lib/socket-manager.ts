import { WebSocketServer, WebSocket } from 'ws';
import type { Server as HttpServer } from 'http';
import type { IncomingMessage } from 'http';
import {WebSocketMessageDTO} from "./definition";

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

                // TODO: query database to verify hardwareId
                const isAuthenticated = true; // assume success

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
                // 客户端在认证前发送了非 'device_auth' 消息
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
