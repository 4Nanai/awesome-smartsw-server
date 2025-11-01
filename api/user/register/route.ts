import {Router} from "express";
import {UserRegisterDTO} from "../../../lib/definition";
import bcrypt from 'bcrypt';
import db from "../../../lib/db";
import {ResultSetHeader} from "mysql2";

const UserRegisterRouter = Router();

UserRegisterRouter.post("/", async (req, res) => {
    const userInfo: UserRegisterDTO = req.body;
    if (!userInfo.email || !userInfo.username || !userInfo.password) {
        res.status(400).json({message: "Missing required fields"});
        return;
    }
    // user password encryption
    try {
        const saltRound = 10;
        const passwordHash = await bcrypt.hash(userInfo.password, saltRound);
        const query = `INSERT INTO users (username, password_hash, email, created_at) VALUES (?, ?, ?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(query, [userInfo.username, passwordHash, userInfo.email, new Date()]);
        res.status(201).json({
            message: "User registered successfully",
            userId: result.insertId,
        });
    } catch (error) {
        console.error("Error during user registration:", error);
        res.status(500).json({message: "Internal server error"});
    }
});

export default UserRegisterRouter;
