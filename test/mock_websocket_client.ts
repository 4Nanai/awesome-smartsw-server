import WebSocket from 'ws';
import {EndpointMessageDTO, SensorDataDAO, UserMessageDTO} from "../lib/definition";
import * as readline from 'readline';

const SERVER_ADDRESS = 'ws://localhost:3000';

console.log(`Try connecting to: ${SERVER_ADDRESS}`);

const client = new WebSocket(SERVER_ADDRESS);
const IS_RECONNECT = false;
const TOKEN = "TOKEN";
const UNIQUE_HARDWARE_ID = "ID";

const DATA_REPORT_ENABLE = true;

const generateRandomMacAddress = () => {
    const hexDigits = "0123456789ABCDEF";
    const mac = [];
    for (let i = 0; i < 6; i++) {
        mac.push(
            hexDigits[Math.floor(Math.random() * 16)]! +
            hexDigits[Math.floor(Math.random() * 16)]!
        );
    }
    return mac.join(":");
}

const uniqueHardwareId = generateRandomMacAddress();
let state: "on" | "off" = "off";
let dataReportInterval: NodeJS.Timeout | null = null;

/**
 * Generate sensor data
 */
const generateSensorData = (): SensorDataDAO => {
    const now = Date.now();
    const sensorData: SensorDataDAO = {};

    // Randomly include 1-4 types of sensor data
    const includeTemp = Math.random() > 0.3;
    const includePir = Math.random() > 0.7;
    const includeRadar = Math.random() > 0.7;
    const includeSound = Math.random() > 0.8;

    if (includeTemp) {
        // Temperature: 15-35°C, Humidity: 30-80%
        sensorData.temp_humi = {
            temperature: Math.round((Math.random() * 20 + 15) * 10) / 10, // 15-35°C
            humidity: Math.round(Math.random() * 50 + 30), // 30-80%
            ts: now
        };
    }

    if (includePir) {
        // PIR sensor state (human infrared detection)
        sensorData.pir = {
            state: Math.random() > 0.6,
            ts: now
        };
    }

    if (includeRadar) {
        // Radar sensor state
        sensorData.radar = {
            state: Math.random() > 0.7,
            ts: now
        };
    }

    if (includeSound) {
        // Sound detection
        sensorData.sound = {
            ts: now
        };
    }

    return sensorData;
};

/**
 * Report sensor data
 */
const reportSensorData = () => {
    if (client.readyState !== WebSocket.OPEN) {
        console.log('WebSocket not connected, skip data report');
        return;
    }

    if (!DATA_REPORT_ENABLE) {
        console.log('Data reporting disabled, skip data report');
        return;
    }

    const sensorData = generateSensorData();
    const dataReportMessage: EndpointMessageDTO = {
        type: "data_report",
        payload: {
            uniqueHardwareId: uniqueHardwareId,
            sensor: sensorData
        }
    };

    client.send(JSON.stringify(dataReportMessage));
    console.log(`Sent sensor data report:`, JSON.stringify(sensorData, null, 2));

    // Schedule next report, interval 20s ± 5s
    const nextInterval = (20 + (Math.random() * 10 - 5)) * 1000;
    dataReportInterval = setTimeout(reportSensorData, nextInterval);
    console.log(`Next data report scheduled in ${Math.round(nextInterval / 1000)}s`);
};

/**
 * Start data reporting
 */
const startDataReporting = () => {
    if (dataReportInterval) {
        clearTimeout(dataReportInterval);
    }
    dataReportInterval = setTimeout(reportSensorData, 3000);
    console.log('Data reporting started, first report in 3s');
};

/**
 * Stop data reporting
 */
const stopDataReporting = () => {
    if (dataReportInterval) {
        clearTimeout(dataReportInterval);
        dataReportInterval = null;
        console.log('Data reporting stopped');
    }
};

// listen to WebSocket events
client.on('open', () => {
    console.log('Connected to the WebSocket server.');

    // Set up readline for user input
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'Enter command (on/off): '
    });

    rl.prompt();

    rl.on('line', (input) => {
        const command = input.trim().toLowerCase();
        const now = Date.now();
        if (command === 'on') {
            const sensorData: SensorDataDAO = {
                temp_humi: {
                    temperature: Math.round((Math.random() * 20 + 15) * 10) / 10, // 15-35°C
                    humidity: Math.round(Math.random() * 50 + 30), // 30-80%
                    ts: now
                },
                pir: {
                    state: Math.random() > 0.6,
                    ts: now
                },
                radar: {
                    state: Math.random() > 0.7,
                    ts: now
                },
                sound: {
                    ts: now
                }
            };
            const setStateMessage: EndpointMessageDTO = {
                type: "endpoint_state",
                payload: {
                    uniqueHardwareId: uniqueHardwareId,
                    state: "on",
                    from: "manual_or_user",
                    sensor: sensorData,
                }
            };
            client.send(JSON.stringify(setStateMessage));
            console.log(`Sent endpoint_state: on with sensor data:`, JSON.stringify(sensorData, null, 2));
            state = "on";
        } else if (command === 'off') {
            const sensorData: SensorDataDAO = {
                temp_humi: {
                    temperature: Math.round((Math.random() * 20 + 15) * 10) / 10, // 15-35°C
                    humidity: Math.round(Math.random() * 50 + 30), // 30-80%
                    ts: now
                },
                pir: {
                    state: Math.random() > 0.6,
                    ts: now
                },
                radar: {
                    state: Math.random() > 0.7,
                    ts: now
                },
                sound: {
                    ts: now
                }
            };
            const setStateMessage: EndpointMessageDTO = {
                type: "endpoint_state",
                payload: {
                    uniqueHardwareId: uniqueHardwareId,
                    state: "off",
                    from: "manual_or_user",
                    sensor: sensorData,
                }
            };
            client.send(JSON.stringify(setStateMessage));
            console.log(`Sent endpoint_state: off with sensor data:`, JSON.stringify(sensorData, null, 2));
            state = "off";
        } else {
            console.log('Invalid command. Please enter "on" or "off".');
        }
        rl.prompt();
    });

    rl.on('close', () => {
        console.log('Readline closed.');
        client.close();
    });

    if (!IS_RECONNECT) {
        // After connection is open, we can send messages
        const authMessage: EndpointMessageDTO = {
            type: "device_auth",
            payload: {
                uniqueHardwareId: uniqueHardwareId,
                token: TOKEN,
            }
        }
        client.send(JSON.stringify(authMessage));
        console.log(`Sent authentication message: ${JSON.stringify(authMessage)}`);
    } else {
        const reconnectMessage: EndpointMessageDTO = {
            type: "device_reconnect",
            payload: {
                uniqueHardwareId: UNIQUE_HARDWARE_ID,
            }
        }
        client.send(JSON.stringify(reconnectMessage));
        console.log(`Sent reconnection message: ${JSON.stringify(reconnectMessage)}`);
    }
});

// listen for messages from the server
client.on('message', (data: Buffer) => {
    const receivedMessage = data.toString();
    console.log(`Receive message from Server: ${receivedMessage}`);
    const message: EndpointMessageDTO = JSON.parse(receivedMessage);
    
    if (message.type === "auth_success") {
        console.log('Authentication successful');
        if (DATA_REPORT_ENABLE) {
            console.log('Starting data reporting...');
            startDataReporting();
        } else {
            console.log('Data reporting disabled.');
        }
        handleQueryEndpointState();
    }
    if (message.type === "query_endpoint_state") {
        handleQueryEndpointState();
    }
    if (message.type === "set_endpoint_state") {
        handleSetEndpointState(message);
    }
    if (message.type === "device_unbound") {
        handleDeviceUnbound(message);
    }
});

// handle connection close event
client.on('close', (code: number, reason: Buffer) => {
    const reasonString = reason.toString();
    console.log(`Connection closed: ${code}: ${reasonString}`);
    stopDataReporting();
});

// handle errors
client.on('error', (error: Error) => {
    console.error('Error occurred', error.message);
    if (error.message.includes('ECONNREFUSED')) {
        console.error('Cannot connect to ws://localhost:3000');
    }
    stopDataReporting();
});

const handleQueryEndpointState = () => {
    const now = Date.now();
    const sensorData: SensorDataDAO = {
        temp_humi: {
            temperature: Math.round((Math.random() * 20 + 15) * 10) / 10, // 15-35°C
            humidity: Math.round(Math.random() * 50 + 30), // 30-80%
            ts: now
        },
        pir: {
            state: Math.random() > 0.6,
            ts: now
        },
        radar: {
            state: Math.random() > 0.7,
            ts: now
        },
        sound: {
            ts: now
        }
    };
    const response: EndpointMessageDTO = {
        type: "endpoint_state",
        payload: {
            uniqueHardwareId: uniqueHardwareId,
            state: state,
            from: "manual_or_user",
            sensor: sensorData,
        }
    };
    client.send(JSON.stringify(response));
    console.log(`Sent endpoint state with sensor data:`, JSON.stringify(sensorData, null, 2));
}

const handleSetEndpointState = (message: EndpointMessageDTO) => {
    if (message.payload && message.payload.command) {
        const command = message.payload.command;
        if (command) {
            state = command.state ? "on" : "off";
            const now = Date.now();
            const sensorData: SensorDataDAO = {
                temp_humi: {
                    temperature: Math.round((Math.random() * 20 + 15) * 10) / 10, // 15-35°C
                    humidity: Math.round(Math.random() * 50 + 30), // 30-80%
                    ts: now
                },
                pir: {
                    state: Math.random() > 0.6,
                    ts: now
                },
                radar: {
                    state: Math.random() > 0.7,
                    ts: now
                },
                sound: {
                    ts: now
                }
            };
            const response: EndpointMessageDTO = {
                type: "endpoint_state",
                payload: {
                    uniqueHardwareId: uniqueHardwareId,
                    state: state,
                    from: command.from === 'ml' ? 'ml' : 'manual_or_user',
                    sensor: sensorData,
                }
            };
            client.send(JSON.stringify(response));
            console.log(`Toggled state to: ${state} (from: ${command.from || 'unknown'}) with sensor data:`, JSON.stringify(sensorData, null, 2));
        }
    }
}

const handleDeviceUnbound = (message: EndpointMessageDTO) => {
    console.log("Device has been unbound by the server.", message.message);
}
