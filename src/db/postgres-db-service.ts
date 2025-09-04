import dotenv from "dotenv";
import { Pool, PoolClient } from "pg";
import { ChatMessage, ChatMessageSchema } from "../models/chat-message.js";
import { RoomDetails, RoomDetailsSchema } from "../models/room-details.js";

// Initialize dotenv to load environment variables from .env file
dotenv.config();

const POSTGRES_CONNECTION = {
    host: process.env.POSTGRES_HOST || "localhost",
    port: parseInt(process.env.POSTGRES_PORT || "5432"),
    database: process.env.POSTGRES_DB || "livemargs",
    user: process.env.POSTGRES_USER || "postgres",
    password: process.env.POSTGRES_PASSWORD || "password",
    max: 20, // Maximum number of clients in the pool
    idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
    connectionTimeoutMillis: 2000, // Return error after 2 seconds if connection could not be established
};

export class PostgresDBService {
    private pool: Pool;

    constructor() {
        this.pool = new Pool(POSTGRES_CONNECTION);
    }

    async connect(): Promise<void> {
        try {
            const client = await this.pool.connect();
            
            // Create tables if they don't exist
            await this.createTables(client);
            
            client.release();
            console.log("Connected to PostgreSQL database");
        } catch (e) {
            console.log("Could not connect to PostgreSQL DB: " + e);
            throw e;
        }
    }

    private async createTables(client: PoolClient): Promise<void> {
        // Create chat_messages table
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_messages (
                id SERIAL PRIMARY KEY,
                message_id VARCHAR(255) NOT NULL,
                participant_id VARCHAR(255) NOT NULL,
                text TEXT NOT NULL,
                ai_query_context TEXT NOT NULL,
                media_uri TEXT,
                file_name TEXT,
                file_size BIGINT,
                type VARCHAR(50) NOT NULL,
                timestamp BIGINT NOT NULL,
                edit_timestamp BIGINT,
                room_name VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(room_name),
                INDEX(expires_at)
            )
        `);

        // Create chat_rooms table
        await client.query(`
            CREATE TABLE IF NOT EXISTS chat_rooms (
                id SERIAL PRIMARY KEY,
                room_name VARCHAR(255) NOT NULL,
                channel INTEGER NOT NULL,
                department VARCHAR(100),
                product_category VARCHAR(255) NOT NULL,
                requesting_help INTEGER DEFAULT 0,
                requesting_help_since TIMESTAMP,
                room_title TEXT DEFAULT '',
                ticket_status INTEGER NOT NULL,
                belonging_user_identity VARCHAR(255) DEFAULT '',
                private_room BOOLEAN DEFAULT false,
                expires_at TIMESTAMP NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX(belonging_user_identity),
                INDEX(private_room),
                INDEX(expires_at)
            )
        `);

        // Create indexes for automatic cleanup (similar to MongoDB TTL)
        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_messages_expires_at 
            ON chat_messages(expires_at)
        `);

        await client.query(`
            CREATE INDEX IF NOT EXISTS idx_chat_rooms_expires_at 
            ON chat_rooms(expires_at)
        `);

        // Set up automatic cleanup job (PostgreSQL equivalent of MongoDB TTL)
        // This would typically be handled by a separate cron job or scheduled task
        // For now, we'll add a helper method to clean expired records
    }

    async saveChatMessage(roomName: string, chatMessage: ChatMessage): Promise<void> {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // 5 years
        const expiresAt = new Date(now + ttlSeconds * 1000);

        const query = `
            INSERT INTO chat_messages (
                message_id, participant_id, text, ai_query_context, 
                media_uri, file_name, file_size, type, timestamp, 
                edit_timestamp, room_name, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        `;

        const values = [
            chatMessage.messageId,
            chatMessage.participantId,
            chatMessage.text,
            chatMessage.aiQueryContext,
            chatMessage.mediaUri || null,
            chatMessage.fileName || null,
            chatMessage.fileSize || null,
            chatMessage.type,
            chatMessage.timestamp,
            chatMessage.editTimestamp || null,
            roomName,
            expiresAt
        ];

        try {
            await this.pool.query(query, values);
        } catch (error) {
            console.error("Error saving chat message:", error);
            throw error;
        }
    }

    async getChatMessagesByRoom(roomName: string): Promise<ChatMessageSchema[]> {
        const query = `
            SELECT 
                message_id, participant_id, text, ai_query_context,
                media_uri, file_name, file_size, type, timestamp,
                edit_timestamp, room_name, expires_at
            FROM chat_messages 
            WHERE room_name = $1 AND expires_at > NOW()
            ORDER BY timestamp ASC
        `;

        try {
            const result = await this.pool.query(query, [roomName]);
            
            return result.rows.map(row => ({
                messageId: row.message_id,
                participantId: row.participant_id,
                text: row.text,
                aiQueryContext: row.ai_query_context,
                mediaUri: row.media_uri,
                fileName: row.file_name,
                fileSize: row.file_size,
                type: row.type,
                timestamp: row.timestamp,
                editTimestamp: row.edit_timestamp,
                roomName: row.room_name,
                expiresAt: row.expires_at
            }));
        } catch (error) {
            console.error("Error getting chat messages:", error);
            throw error;
        }
    }

    async savePrivateRoom(roomName: string, roomDetails: RoomDetails): Promise<void> {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // 5 years
        const expiresAt = new Date(now + ttlSeconds * 1000);

        const query = `
            INSERT INTO chat_rooms (
                room_name, channel, department, product_category,
                requesting_help, requesting_help_since, room_title,
                ticket_status, belonging_user_identity, private_room, expires_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;

        const values = [
            roomName,
            roomDetails.channel,
            roomDetails.department || null,
            roomDetails.productCategory,
            roomDetails.requestingHelp,
            roomDetails.requestingHelpSince || null,
            roomDetails.roomTitle,
            roomDetails.ticketStatus,
            roomDetails.belongingUserIdentity,
            roomDetails.privateRoom,
            expiresAt
        ];

        try {
            await this.pool.query(query, values);
        } catch (error) {
            console.error("Error saving private room:", error);
            throw error;
        }
    }

    async getPrivateRoomsByUserIdentity(userIdentity: string): Promise<RoomDetailsSchema[]> {
        const query = `
            SELECT 
                room_name, channel, department, product_category,
                requesting_help, requesting_help_since, room_title,
                ticket_status, belonging_user_identity, private_room, expires_at
            FROM chat_rooms 
            WHERE belonging_user_identity = $1 
                AND private_room = true 
                AND expires_at > NOW()
            ORDER BY created_at ASC
        `;

        try {
            const result = await this.pool.query(query, [userIdentity]);
            
            return result.rows.map(row => ({
                channel: row.channel,
                department: row.department,
                productCategory: row.product_category,
                requestingHelp: row.requesting_help,
                requestingHelpSince: row.requesting_help_since,
                roomName: row.room_name,
                roomTitle: row.room_title,
                ticketStatus: row.ticket_status,
                belongingUserIdentity: row.belonging_user_identity,
                privateRoom: row.private_room,
                expiresAt: row.expires_at
            }));
        } catch (error) {
            console.error("Error getting private rooms:", error);
            throw error;
        }
    }

    /**
     * Clean up expired records (equivalent to MongoDB TTL functionality)
     * This should be called periodically by a cron job or scheduled task
     */
    async cleanupExpiredRecords(): Promise<void> {
        try {
            // Clean up expired chat messages
            const chatMessagesResult = await this.pool.query(
                "DELETE FROM chat_messages WHERE expires_at <= NOW()"
            );
            
            // Clean up expired chat rooms
            const chatRoomsResult = await this.pool.query(
                "DELETE FROM chat_rooms WHERE expires_at <= NOW()"
            );

            console.log(`Cleaned up ${chatMessagesResult.rowCount} expired chat messages`);
            console.log(`Cleaned up ${chatRoomsResult.rowCount} expired chat rooms`);
        } catch (error) {
            console.error("Error cleaning up expired records:", error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
        console.log("PostgreSQL connection pool closed");
    }

    /**
     * Get pool statistics for monitoring
     */
    getPoolStats() {
        return {
            totalCount: this.pool.totalCount,
            idleCount: this.pool.idleCount,
            waitingCount: this.pool.waitingCount
        };
    }
}