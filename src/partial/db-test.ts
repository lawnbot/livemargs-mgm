import { nanoid } from "nanoid";
import { DatabaseFactory } from "../db/db-factory.js";
import { MessageType } from "../models/chat-message.js";

const dbService = DatabaseFactory.createDatabaseService();
await dbService.saveChatMessage("test", {
    messageId: nanoid(9),
    participantId: "",
    text: "test message",
    type: MessageType.Text,
    timestamp: Date.now(),
    aiQueryContext: "",
});
