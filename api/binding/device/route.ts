import { Router } from "express";
import { v4 as uuid } from "uuid";
import db from "../../../lib/db";

const bindingDeviceRouter = Router();

bindingDeviceRouter.get("/", async (req, res) => {
    try {
        const token = uuid();
        const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
        const userId = req.user!.id;
        await db.query(
            "INSERT INTO binding_tokens (token, user_id, expires_at) VALUES (?, ?, ?)",
            [token, userId, expiry]
        );
        res.status(200).json({
            message: "Token generated successfully",
            token: token,
            expiresAt: expiry,
        });
    } catch (error) {
        console.error("Error generating token:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

export default bindingDeviceRouter;
