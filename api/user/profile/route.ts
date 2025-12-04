import {Router} from "express";
import db from "../../../lib/db";
import {RowDataPacket, ResultSetHeader} from "mysql2";
import {deviceConnectionMap} from "../../../lib/socket-manager";
import {EndpointMessageDTO} from "../../../lib/definition";
import {WebSocket} from 'ws';

const UserProfileRouter = Router();

// Validate if timezone is a valid IANA timezone
function isValidIANATimezone(timezone: string): boolean {
    try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
        return true;
    } catch (error) {
        return false;
    }
}

interface UserProfileDAO {
    id: number;
    username: string;
    email: string;
    timezone: string;
    created_at: Date;
}

interface UserProfileUpdateDTO {
    timezone?: string;
}

// GET /api/user/profile - Get user profile information
UserProfileRouter.get("/", async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({message: "Unauthorized"});
        return;
    }

    try {
        const query = `SELECT id, username, email, timezone, created_at FROM users WHERE id = ?`;
        const [result] = await db.execute<RowDataPacket[]>(query, [userId]) as [UserProfileDAO[], any];
        
        if (result.length === 0) {
            res.status(404).json({message: "User not found"});
            return;
        }

        const user = result[0]!;
        res.status(200).json({
            id: user.id,
            username: user.username,
            email: user.email,
            timezone: user.timezone,
            created_at: user.created_at,
        });
    } catch (error) {
        console.error("Error fetching user profile:", error);
        res.status(500).json({message: "Internal server error"});
    }
});

// PATCH /api/user/profile - Update user profile information
UserProfileRouter.patch("/", async (req, res) => {
    const userId = req.user?.id;
    
    if (!userId) {
        res.status(401).json({message: "Unauthorized"});
        return;
    }

    const updateDTO: UserProfileUpdateDTO = req.body;
    
    // Check if timezone is provided
    if (!updateDTO.timezone) {
        res.status(400).json({message: "Timezone is required"});
        return;
    }

    // Validate timezone format
    if (!isValidIANATimezone(updateDTO.timezone)) {
        res.status(400).json({message: "Invalid IANA timezone format"});
        return;
    }

    try {
        const query = `UPDATE users SET timezone = ? WHERE id = ?`;
        const [result] = await db.execute<ResultSetHeader>(query, [updateDTO.timezone, userId]);

        if (result.affectedRows === 0) {
            res.status(404).json({message: "User not found"});
            return;
        }

        // Send set_config to all user's devices with updated timezone
        try {
            // Get all devices for this user
            const selectDevicesQuery = `SELECT unique_hardware_id FROM devices WHERE user_id = ?`;
            const [devices] = await db.execute<RowDataPacket[]>(selectDevicesQuery, [userId]) as [{unique_hardware_id: string}[], any];

            // Send set_config message to each connected device
            for (const device of devices) {
                const deviceSocket = deviceConnectionMap.get(device.unique_hardware_id);
                if (deviceSocket && (deviceSocket as any).readyState === WebSocket.OPEN) {
                    const configMessage: EndpointMessageDTO = {
                        type: "set_config",
                        payload: {
                            uniqueHardwareId: device.unique_hardware_id,
                            config: {
                                timezone: updateDTO.timezone,
                            },
                        },
                    };
                    (deviceSocket as any).send(JSON.stringify(configMessage));
                    console.log(`[UserProfile] Sent timezone update to device ${device.unique_hardware_id}`);
                }
            }
        } catch (error) {
            console.error("Error notifying devices of timezone update:", error);
            // Don't fail the request if device notification fails
        }

        res.status(200).json({
            message: "Profile updated successfully",
        });
    } catch (error) {
        console.error("Error updating user profile:", error);
        res.status(500).json({message: "Internal server error"});
    }
});

export default UserProfileRouter;
