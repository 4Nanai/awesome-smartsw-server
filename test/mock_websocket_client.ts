import WebSocket from 'ws';
import {EndpointMessageDTO} from "../lib/definition";

const SERVER_ADDRESS = 'ws://localhost:3000';

console.log(`Try connecting to: ${SERVER_ADDRESS}`);

const client = new WebSocket(SERVER_ADDRESS);

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

// listen to WebSocket events
client.on('open', () => {
    console.log('Connected to the WebSocket server.');

    // After connection is open, we can send messages
    const authMessage: EndpointMessageDTO = {
        type: "device_auth",
        payload: {
            uniqueHardwareId: uniqueHardwareId,
            token: "7ca852e3-2dc6-471b-a9c3-78b4826bb7bc",
        }
    }
    client.send(JSON.stringify(authMessage));
    console.log(`Sent authentication message: ${JSON.stringify(authMessage)}`);
});

// listen for messages from the server
client.on('message', (data: Buffer) => {
    const receivedMessage = data.toString();
    console.log(`Receive message from Server: ${receivedMessage}`);
    const message: EndpointMessageDTO = JSON.parse(receivedMessage);
    if (message.type === "query_endpoint_state") {
        handleQueryEndpointState();
    }
    if (message.type === "user_command") {
        handleUserCommand(message);
    }
});

// handle connection close event
client.on('close', (code: number, reason: Buffer) => {
    const reasonString = reason.toString();
    console.log(`Connection closed: ${code}: ${reasonString}`);
});

// handle errors
client.on('error', (error: Error) => {
    console.error('Error occurred', error.message);
    if (error.message.includes('ECONNREFUSED')) {
        console.error('Cannot connect to ws://localhost:3000');
    }
});

const handleQueryEndpointState = () => {
    const response: EndpointMessageDTO = {
        type: "endpoint_state",
        payload: {
            uniqueHardwareId: uniqueHardwareId,
            state: state,
        }
    };
    client.send(JSON.stringify(response));
}

const handleUserCommand = (message: EndpointMessageDTO) => {
    if (message.payload && message.payload.command) {
        const command = message.payload.command.type;
        if (command === "toggle") {
            state = message.payload.command.state ? "on" : "off";
            console.log(`Toggled state to: ${state}`);
            const response: EndpointMessageDTO = {
                type: "endpoint_state",
                payload: {
                    uniqueHardwareId: uniqueHardwareId,
                    state: state,
                }
            };
            client.send(JSON.stringify(response));
        }
    }
}
