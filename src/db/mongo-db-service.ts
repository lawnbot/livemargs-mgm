import dotenv from "dotenv";
import { Collection, MongoClient } from "mongodb";
import { ChatMessage, ChatMessageSchema } from "../models/chat-message.js";

dotenv.config();
const MONGODB_URI = process.env.MONGODB_URI ||
    "mongodb://localhost:27017";

const dbName: string = "livemargs";

export class MongoDBService {
    private mongoClient: MongoClient;
    private chatMessageCollection: Collection<ChatMessageSchema>;

    constructor() {
        this.mongoClient = new MongoClient(MONGODB_URI);
        this.chatMessageCollection = this.mongoClient.db(dbName).collection<
            ChatMessageSchema
        >("chatMessages");
    }

    async connect(): Promise<void> {
        try {
            await this.mongoClient.connect();
            // Ensure TTL index exists
            await this.chatMessageCollection.createIndex({ expiresAt: 1 }, {
                expireAfterSeconds: 0,
            });
            /*
            MongoDB löscht Dokumente nicht sofort, sondern in regelmäßigen Intervallen (ca. alle 60 Sekunden).
            Das Feld expiresAt muss ein Datumstyp (Date) sein.
            TTL-Index funktioniert nur auf einem Feld pro Collection.
            */
        } catch (e) {
            console.log("Could not connect to Mongo DB: " + e);
        }
    }

    async saveChatMessage(roomName: string, chatMessage: ChatMessage) {
        const now = Date.now();
        const ttlSeconds: number = 157788000; // Means 5 years
        await this.chatMessageCollection.insertOne({
            ...chatMessage,
            expiresAt: new Date(now + ttlSeconds * 1000),
            roomName,
        });
    }

    async getChatMessagesByRoom(
        roomName: string,
    ): Promise<ChatMessageSchema[]> {
        // Field timestamp must exist. 1 is ascending. -1 decending
        return await this.chatMessageCollection.find({ roomName }).sort({
            timestamp: 1,
        }).toArray();
    }
    async close() {
        await this.mongoClient.close();
    }
}
