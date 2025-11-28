import {WebSocketServer, WebSocket} from 'ws';
import type {Server as HttpServer} from 'http';
import type {IncomingMessage} from 'http';
import {EndpointMessageDTO, UserMessageDTO} from "./definition";
import {
    handleAuthentication,
    handleDeviceDisconnection,
    handleDeviceMessage,
    handleUserMessage
} from "./handler/websocket-handlers";

// extend WebSocket to include hardwareId
export interface AuthenticatedWebSocket extends WebSocket {
    hardwareId?: string;
    userId?: number;
    isAlive?: boolean;
    heartbeatTimer?: NodeJS.Timeout;
}

// connection map to track active connections
export const deviceConnectionMap = new Map<string, AuthenticatedWebSocket>();
export const userConnectionMap = new Map<string, AuthenticatedWebSocket>();

// authentication timeout
const AUTH_TIMEOUT_MS = 10000;

// heartbeat configuration
const HEARTBEAT_INTERVAL = 10000; // 10 seconds

/**
 * Starts heartbeat monitoring for an authenticated WebSocket connection
 * @param ws The authenticated WebSocket connection
 */
export function startHeartbeat(ws: AuthenticatedWebSocket) {
    // clear any existing heartbeat timer
    if (ws.heartbeatTimer) {
        clearInterval(ws.heartbeatTimer);
    }

    ws.heartbeatTimer = setInterval(() => {
        if (ws.isAlive === false) {
            console.log(`[SocketManager] Heartbeat timeout for ${ws.hardwareId || `user ${ws.userId}` || 'unknown'}. Terminating.`);
            clearInterval(ws.heartbeatTimer);
            ws.terminate();
            return;
        }

        ws.isAlive = false;
        ws.ping();
    }, HEARTBEAT_INTERVAL);
}

/**
 * Initializes the WebSocket server and sets up connection handling.
 * @param httpServer The HTTP server to attach the WebSocket server to.
 */
export function initWebSocketServer(httpServer: HttpServer) {
    const wss = new WebSocketServer({server: httpServer});

    wss.on('connection', (ws: AuthenticatedWebSocket, req: IncomingMessage) => {
        console.log(`[SocketManager] Client connected from ${req.socket.remoteAddress}`);

        // initialize heartbeat state
        ws.isAlive = true;

        const authTimeout = setTimeout(() => {
            // close connection if not authenticated in time
            if (!ws.hardwareId && !ws.userId) {
                console.log('[SocketManager] Client failed to authenticate in time. Closing.');
                ws.terminate();
            }
        }, AUTH_TIMEOUT_MS);

        // handle pong responses
        ws.on('pong', () => {
            ws.isAlive = true;
        });

        // handle incoming messages
        ws.on('message', async (message: Buffer) => {
            let data: EndpointMessageDTO | UserMessageDTO;
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

            try {
                if (ws.hardwareId) {
                    await handleDeviceMessage(ws, data as EndpointMessageDTO);
                } else if (ws.userId) {
                    await handleUserMessage(ws, data as UserMessageDTO);
                } else {
                    await handleAuthentication(ws, data, authTimeout);
                }
            } catch (error) {
                console.error(`[SocketManager] Error handling message type ${data.type}:`, error);
                // ws.send(JSON.stringify({ type: 'error', message: 'Internal server error' }));
            }
        });

        // handle connection close
        ws.on('close', (code, reason) => {
            clearTimeout(authTimeout);
            if (ws.heartbeatTimer) {
                clearInterval(ws.heartbeatTimer);
            }
            if (ws.hardwareId) {
                if (deviceConnectionMap.get(ws.hardwareId) === ws) {
                    deviceConnectionMap.delete(ws.hardwareId);
                    console.log(`[SocketManager] Device ${ws.hardwareId} disconnected. (Code: ${code}, Reason: ${reason})`);
                    handleDeviceDisconnection(ws);
                } else {
                    console.log(`[SocketManager] Stale connection for ${ws.hardwareId} closed.`);
                }
            } else if (ws.userId) {
                if (userConnectionMap.get(ws.userId.toString()) === ws) {
                    userConnectionMap.delete(ws.userId.toString());
                    console.log(`[SocketManager] User ${ws.userId} disconnected. (Code: ${code}, Reason: ${reason.toString()})`);
                } else {
                    console.log(`[SocketManager] Stale connection for user ${ws.userId} closed.`);
                }
            } else {
                console.log('[SocketManager] Unauthenticated client disconnected.');
            }
        });

        // handle errors
        ws.on('error', (error) => {
            if (ws.hardwareId) {
                console.error(`[SocketManager] WebSocket error for device ${ws.hardwareId}:`, error);
                if (ws.userId) {
                    const message: UserMessageDTO = {
                        type: 'endpoint_state',
                        payload: {
                            uniqueHardwareId: ws.hardwareId,
                            state: 'error'
                        }
                    }
                    const userWs = userConnectionMap.get(ws.userId.toString());
                    if (userWs && userWs.readyState === WebSocket.OPEN) {
                        userWs.send(JSON.stringify(message));
                    }
                }
            } else if (ws.userId) {
                console.error(`[SocketManager] WebSocket error for user ${ws.userId}:`, error);
            } else {
                console.error('[SocketManager] WebSocket error for unauthenticated client:', error);
            }
        });
    });

    console.log('[SocketManager] WebSocket server initialized and attached to HTTP server.');
}
