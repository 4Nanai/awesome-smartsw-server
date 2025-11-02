import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import http from 'http';
import { initWebSocketServer } from './lib/socket-manager';
import WSStatusRouter from "./api/ws-status/route";
import UserRegisterRouter from "./api/user/register/route";
import UserLoginRouter from "./api/user/login/route";

// import env variables
const PORT = process.env.PORT || 3000;

const app = express();
app.use(express.json());
app.get('/', (req, res) => {
    res.send('Express Server is running. WebSocket is active on the same port.');
});

app.use("/api/ws-status", WSStatusRouter);
app.use("/api/user/register", UserRegisterRouter);
app.use("/api/user/login", UserLoginRouter);

// Create an http server
const server = http.createServer(app);
initWebSocketServer(server);
server.listen(PORT, () => {
    console.log(`[MainServer] HTTP and WebSocket server running on http://localhost:${PORT}`);
});
