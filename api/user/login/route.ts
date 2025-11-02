import {Router} from "express";
import {UserLoginDAO, UserLoginDTO, UserPayload} from "../../../lib/definition";
import bcrypt from "bcrypt";
import db from "../../../lib/db";
import {RowDataPacket} from "mysql2";
import {generateToken} from "../../../lib/jwt";

const UserLoginRouter = Router();

UserLoginRouter.post("/", async (req, res) => {
    const loginDTO: UserLoginDTO = req.body;
    if (!loginDTO.username || !loginDTO.password) {
        res.status(400).json({message: "Missing required fields"});
        return;
    }
    try {
        const query = `SELECT id, password_hash FROM users WHERE username = ?`;
        const [result] = await db.execute<RowDataPacket[]>(query, [loginDTO.username]) as [UserLoginDAO[] , any];
        if (result.length === 0) {
            res.status(401).json({message: "Invalid username or password"});
            return;
        }
        const user: UserLoginDAO = result[0]!;
        const isPasswordValid = await bcrypt.compare(loginDTO.password, user.password_hash);
        if (!isPasswordValid) {
            res.status(401).json({message: "Invalid username or password"});
            return;
        }
        const userPayload: UserPayload = {
            id: user.id,
            username: loginDTO.username,
        };
        const token = generateToken(userPayload);
        res.status(200).json({
            message: "Login successful",
            token: token,
        });
    } catch (error) {
        console.error("Error during user login:", error);
        res.status(500).json({message: "Internal server error"});
    }
})

export default UserLoginRouter;
