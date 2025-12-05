import {Router} from "express";
import {UserRegisterDTO} from "../../../lib/definition";
import bcrypt from 'bcrypt';
import db from "../../../lib/db";
import {ResultSetHeader} from "mysql2";

const UserRegisterRouter = Router();

// Validate if timezone is a valid IANA timezone
function isValidIANATimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
}

UserRegisterRouter.post("/", async (req, res) => {
    const registerDTO: UserRegisterDTO = req.body;
    if (!registerDTO.email || !registerDTO.username || !registerDTO.password || !registerDTO.timezone) {
        res.status(400).json({message: "Missing required fields"});
        return;
    }
    // Validate timezone format
    if (!isValidIANATimezone(registerDTO.timezone)) {
        res.status(400).json({message: "Invalid IANA timezone format"});
        return;
    }
    // user password encryption
    try {
        const saltRound = 10;
        const passwordHash = await bcrypt.hash(registerDTO.password, saltRound);
        const query = `INSERT INTO users (username, password_hash, email, timezone, created_at) VALUES (?, ?, ?, ?, ?)`;
        const [result] = await db.execute<ResultSetHeader>(query, [registerDTO.username, passwordHash, registerDTO.email, registerDTO.timezone, new Date()]);
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
