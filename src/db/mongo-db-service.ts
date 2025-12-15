import dotenv from "dotenv";
import { Collection, MongoClient } from "mongodb";
import { ChatMessage, ChatMessageSchema } from "../models/chat-message.js";
import { RoomDetails, RoomDetailsSchema } from "../models/room-details.js";
import { WhatsAppMessage, WhatsAppMessageSchema } from "../models/whatsapp-message.js";

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI ||
    "mongodb://localhost:27017";

const dbName: string = "livemargs";

export class MongoDBService {
    private mongoClient: MongoClient;
    private chatMessageCollection: Collection<ChatMessageSchema>;
    private chatRoomsCollection: Collection<RoomDetailsSchema>;
    private whatsappMessageCollection: Collection<WhatsAppMessageSchema>;

    constructor() {
        this.mongoClient = new MongoClient(MONGODB_URI);
        this.chatMessageCollection = this.mongoClient.db(dbName).collection<
            ChatMessageSchema
        >("chatMessages");

        this.chatRoomsCollection = this.mongoClient.db(dbName).collection<
            RoomDetailsSchema
        >("chatRooms");

        this.whatsappMessageCollection = this.mongoClient.db(dbName).collection<
            WhatsAppMessageSchema
        >("whatsappMessages");
    }

    async connect(): Promise<void> {
        try {
            await this.mongoClient.connect();

            // Create indexes for better query performance
            await this.chatMessageCollection.createIndex({
                roomName: 1,
                timestamp: 1,
            });
            // Ensure TTL index exists
            await this.chatMessageCollection.createIndex({ expiresAt: 1 }, {
                expireAfterSeconds: 0,
            });
                        /*
            MongoDB löscht Dokumente nicht sofort, sondern in regelmäßigen Intervallen (ca. alle 60 Sekunden).
            Das Feld expiresAt muss ein Datumstyp (Date) sein.
            TTL-Index funktioniert nur auf einem Feld pro Collection.
            */
            // Index for RAG sources queries (flat format)
            await this.chatMessageCollection.createIndex({
                "ragSources.collectionName": 1,
            });

            // Index for RAG source filenames
            await this.chatMessageCollection.createIndex({
                "ragSources.sources.filename": 1,
            });

            // Create indexes for WhatsApp messages
            await this.whatsappMessageCollection.createIndex({
                phoneNumber: 1,
                timestamp: 1,
            });

            await this.whatsappMessageCollection.createIndex({
                roomName: 1,
            });

            await this.whatsappMessageCollection.createIndex({
                whatsappMessageId: 1,
            });

            // Ensure TTL index for WhatsApp messages
            await this.whatsappMessageCollection.createIndex({ expiresAt: 1 }, {
                expireAfterSeconds: 0,
            });

        } catch (e) {
            console.log("Could not connect to Mongo DB: " + e);
        }
    }

    async saveChatMessage(roomName: string, chatMessage: ChatMessage) {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // Means 5 years

        // Typescript Interfaces but also classes have no lifetime safety as they are removed from the code at lifetime.
        // Somone could send a lifetime wrong data. To be safe it is better santize.
        const sanitizedChatMessage = ChatMessage.sanitize(chatMessage);
        if (!ChatMessage.isValid(sanitizedChatMessage)) {
            throw new Error("Invalid ChatMessage format");
        }

        await this.chatMessageCollection.insertOne({
            ...sanitizedChatMessage,
            expiresAt: new Date(now + ttlSeconds * 1000),
            roomName,
        });
    }

    async getChatMessagesByRoom(
        roomName: string,
    ): Promise<ChatMessageSchema[]> {
        // Field timestamp must exist. 1 is ascending. -1 decending
        return await this.chatMessageCollection.find({
            roomName,
            expiresAt: { $gt: new Date() }, // Filter expired messages
        }).sort({
            timestamp: 1,
        }).toArray();
    }

    async savePrivateRoom(roomName: string, roomDetails: RoomDetails) {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // Means 5 years
        await this.chatRoomsCollection.insertOne({
            ...roomDetails,
            expiresAt: new Date(now + ttlSeconds * 1000),
            roomName,
        });
    }

    async getPrivateRoomsByUserIdentity(
        userIdentity: string,
    ): Promise<RoomDetailsSchema[]> {
        // Field timestamp must exist. 1 is ascending. -1 decending
        return await this.chatRoomsCollection.find({
            belongingUserIdentity: userIdentity,
            privateRoom: true,
        }).sort({
            timestamp: 1,
        }).toArray();
    }

    // WhatsApp message methods
    async saveWhatsAppMessage(message: WhatsAppMessage): Promise<void> {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // 5 years

        const sanitizedMessage = WhatsAppMessage.sanitize(message);
        if (!WhatsAppMessage.isValid(sanitizedMessage)) {
            throw new Error("Invalid WhatsAppMessage format");
        }

        await this.whatsappMessageCollection.insertOne({
            ...sanitizedMessage,
            expiresAt: new Date(now + ttlSeconds * 1000),
        });
    }

    async getWhatsAppMessagesByPhoneNumber(
        phoneNumber: string,
    ): Promise<WhatsAppMessageSchema[]> {
        return await this.whatsappMessageCollection.find({
            phoneNumber,
            expiresAt: { $gt: new Date() },
        }).sort({
            timestamp: 1,
        }).toArray();
    }

    async updateWhatsAppMessageStatus(
        whatsappMessageId: string,
        updateFields: Partial<WhatsAppMessage>,
    ): Promise<void> {
        const updateDoc: any = {};

        if (updateFields.status !== undefined) {
            updateDoc.status = updateFields.status;
        }
        if (updateFields.deliveredAt !== undefined) {
            updateDoc.deliveredAt = updateFields.deliveredAt;
        }
        if (updateFields.readAt !== undefined) {
            updateDoc.readAt = updateFields.readAt;
        }
        if (updateFields.failedReason !== undefined) {
            updateDoc.failedReason = updateFields.failedReason;
        }

        if (Object.keys(updateDoc).length === 0) {
            return;
        }

        await this.whatsappMessageCollection.updateOne(
            { whatsappMessageId },
            { $set: updateDoc }
        );
    }

    async close() {
        await this.mongoClient.close();
    }
}
