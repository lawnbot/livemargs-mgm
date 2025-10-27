import { nanoid } from "nanoid";
import { DatabaseFactory } from "../db/db-factory.js";
import { ChatMessage, MessageType, ChatMessageSchema } from "../models/chat-message.js";
import { RoomDetails, TicketStatus, Department, RoomChannel } from "../models/room-details.js";
import { RagSources } from "../models/rag-sources.js";
import { PostgresDBService } from "../db/postgres-db-service.js";

console.log("=== Starting PostgreSQL DB Service Tests ===\n");

const dbService = DatabaseFactory.createDatabaseService();

// Connect to database
await dbService.connect();
console.log("✓ Database connected\n");

// Test room and user identifiers
const testRoomName = `test-room-${nanoid(6)}`;
const testUserIdentity = `test-user-${nanoid(6)}`;

try {
// =============================================================================
// Test 1: Save Chat Message (Basic)
// =============================================================================
console.log("Test 1: Save basic chat message");
const basicMessageId = nanoid(9);
await dbService.saveChatMessage(testRoomName, {
    messageId: basicMessageId,
    participantId: "user-123",
    text: "This is a basic test message",
    type: MessageType.Text,
    timestamp: Date.now(),
    aiQueryContext: "test context",
});
console.log(`✓ Saved basic message with ID: ${basicMessageId}\n`);

// =============================================================================
// Test 2: Save Chat Message with RAG Sources
// =============================================================================
console.log("Test 2: Save chat message with RAG sources");
const ragMessageId = nanoid(9);
const ragSources: RagSources = {
    metadataType: "rag-sources",
    query: "test query for RAG",
    collectionName: "ope-collection",
    sources: [
        {
            id: 1,
            filename: "document1.pdf",
            page: 5,
            collection: "ope-collection",
            relevanceScore: 0.95,
            preview: "This is an excerpt from the document",
            wordCount: 250,
            fileType: "pdf",
            chunkId: 101,
        },
        {
            id: 2,
            filename: "document2.pdf",
            page: 12,
            collection: "ope-collection",
            relevanceScore: 0.88,
            preview: "Another relevant excerpt",
            wordCount: 180,
            fileType: "pdf",
            chunkId: 102,
        },
    ],
};

await dbService.saveChatMessage(testRoomName, {
    messageId: ragMessageId,
    participantId: "ai-assistant",
    text: "Response based on RAG sources",
    type: MessageType.Text,
    timestamp: Date.now(),
    aiQueryContext: "rag query context",
    ragSources: ragSources,
});
console.log(`✓ Saved RAG message with ID: ${ragMessageId}\n`);

// =============================================================================
// Test 3: Save Chat Message with Media
// =============================================================================
console.log("Test 3: Save chat message with media");
const mediaMessageId = nanoid(9);
await dbService.saveChatMessage(testRoomName, {
    messageId: mediaMessageId,
    participantId: "user-456",
    text: "Check out this file",
    type: MessageType.File,
    timestamp: Date.now(),
    aiQueryContext: "",
    mediaUri: "https://example.com/files/document.pdf",
    fileName: "document.pdf",
    fileSize: 1024000,
});
console.log(`✓ Saved media message with ID: ${mediaMessageId}\n`);

// =============================================================================
// Test 4: Save Multiple Messages with Different RAG Collections
// =============================================================================
console.log("Test 4: Save messages with different RAG collections");
const collections = ["ope-collection", "erco-collection", "robot-collection"];
for (const collection of collections) {
    const msgId = nanoid(9);
    await dbService.saveChatMessage(testRoomName, {
        messageId: msgId,
        participantId: "ai-assistant",
        text: `Message from ${collection}`,
        type: MessageType.Text,
        timestamp: Date.now(),
        aiQueryContext: `query for ${collection}`,
        ragSources: {
            metadataType: "rag-sources",
            query: `test query for ${collection}`,
            collectionName: collection,
            sources: [
                {
                    id: 1,
                    filename: `${collection}-doc.pdf`,
                    page: 1,
                    collection: collection,
                    relevanceScore: 0.9,
                    preview: `Content from ${collection}`,
                    wordCount: 200,
                    fileType: "pdf",
                },
            ],
        },
    });
    console.log(`  ✓ Saved message for collection: ${collection}`);
}
console.log();

// =============================================================================
// Test 5: Get All Chat Messages by Room
// =============================================================================
console.log("Test 5: Get all chat messages by room");
const allMessages = await dbService.getChatMessagesByRoom(testRoomName);
console.log(`✓ Retrieved ${allMessages.length} messages from room: ${testRoomName}`);
console.log(`  Message IDs: ${allMessages.map(m => m.messageId).join(", ")}\n`);

// =============================================================================
// Test 6: Get Messages by RAG Collection (PostgreSQL only)
// =============================================================================
if (dbService instanceof PostgresDBService) {
    console.log("Test 6: Get messages by RAG collection");
    const opeMessages = await dbService.getMessagesByRagCollection(
        testRoomName,
        "ope-collection"
    );
    console.log(`✓ Retrieved ${opeMessages.length} messages from 'ope-collection'`);
    opeMessages.forEach((msg: ChatMessageSchema) => {
        console.log(`  - ${msg.messageId}: ${msg.text}`);
    });
    console.log();
} else {
    console.log("Test 6: Skipped (getMessagesByRagCollection is PostgreSQL-specific)\n");
}

// =============================================================================
// Test 7: Get RAG Statistics (PostgreSQL only)
// =============================================================================
if (dbService instanceof PostgresDBService) {
    console.log("Test 7: Get RAG statistics for room");
    const ragStats = await dbService.getRagStatistics(testRoomName);
    console.log("✓ RAG Statistics:");
    console.log(`  - Total messages with RAG: ${ragStats.totalMessagesWithRag}`);
    console.log(`  - Unique collections: ${ragStats.uniqueCollections.join(", ")}`);
    console.log(`  - Unique source files: ${ragStats.uniqueSourceFiles.join(", ")}\n`);
} else {
    console.log("Test 7: Skipped (getRagStatistics is PostgreSQL-specific)\n");
}

// =============================================================================
// Test 8: Save Private Room
// =============================================================================
console.log("Test 8: Save private room");
const privateRoomName = `private-${testUserIdentity}-${nanoid(6)}`;
const roomDetails: RoomDetails = {
    channel: RoomChannel.Customer,
    department: Department.CustomerService,
    productCategory: "Software",
    requestingHelp: 0,
    requestingHelpSince: undefined,
    roomName: privateRoomName,
    roomTitle: "My Private Room",
    ticketStatus: TicketStatus.open,
    belongingUserIdentity: testUserIdentity,
    privateRoom: true,
};

await dbService.savePrivateRoom(privateRoomName, roomDetails);
console.log(`✓ Saved private room: ${privateRoomName}\n`);

// =============================================================================
// Test 9: Save Multiple Private Rooms for Same User
// =============================================================================
console.log("Test 9: Save multiple private rooms for same user");
for (let i = 1; i <= 3; i++) {
    const roomName = `private-${testUserIdentity}-room-${i}`;
    await dbService.savePrivateRoom(roomName, {
        ...roomDetails,
        roomName: roomName,
        roomTitle: `Private Room ${i}`,
        ticketStatus: i === 1 ? TicketStatus.open : TicketStatus.closed,
    });
    console.log(`  ✓ Saved room: ${roomName}`);
}
console.log();

// =============================================================================
// Test 10: Get Private Rooms by User Identity
// =============================================================================
console.log("Test 10: Get private rooms by user identity");
const userRooms = await dbService.getPrivateRoomsByUserIdentity(testUserIdentity);
console.log(`✓ Retrieved ${userRooms.length} private rooms for user: ${testUserIdentity}`);
userRooms.forEach((room) => {
    console.log(`  - ${room.roomName}: ${room.roomTitle} (Status: ${room.ticketStatus})`);
});
console.log();

// =============================================================================
// Test 11: Get Pool Statistics (PostgreSQL only)
// =============================================================================
if (dbService instanceof PostgresDBService) {
    console.log("Test 11: Get database pool statistics");
    const poolStats = dbService.getPoolStats();
    console.log("✓ Pool Statistics:");
    console.log(`  - Total connections: ${poolStats.totalCount}`);
    console.log(`  - Idle connections: ${poolStats.idleCount}`);
    console.log(`  - Waiting connections: ${poolStats.waitingCount}\n`);
} else {
    console.log("Test 11: Skipped (getPoolStats is PostgreSQL-specific)\n");
}

// =============================================================================
// Test 12: Message Sanitization
// =============================================================================
console.log("Test 12: Test message sanitization");
const unsanitizedMessage = {
    messageId: nanoid(9),
    participantId: "user-789",
    text: "Message with undefined fields",
    type: MessageType.Text,
    timestamp: Date.now(),
    aiQueryContext: "",
    // These will be undefined
    mediaUri: undefined,
    fileName: undefined,
    fileSize: undefined,
    editTimestamp: undefined,
};

await dbService.saveChatMessage(testRoomName, unsanitizedMessage);
const retrievedMessages = await dbService.getChatMessagesByRoom(testRoomName);
const lastMessage = retrievedMessages[retrievedMessages.length - 1];
console.log("✓ Message sanitization test:");
console.log(`  - mediaUri is undefined: ${lastMessage.mediaUri === undefined}`);
console.log(`  - fileName is undefined: ${lastMessage.fileName === undefined}\n`);

// =============================================================================
// Test 13: Cleanup Expired Records (Optional - commented out by default)
// =============================================================================
console.log("Test 13: Cleanup expired records");
console.log("⚠ Skipping cleanup test (would require manipulating expires_at)");
console.log("  To test manually: UPDATE chat_messages SET expires_at = NOW() - INTERVAL '1 day'");
console.log("  Then call: await dbService.cleanupExpiredRecords();\n");

} catch (error) {
    console.error("\n❌ Test failed with error:");
    console.error(error);
    console.log("\n⚠ Proceeding with cleanup despite error...\n");
} finally {
    // =============================================================================
    // Test 14: Cleanup Test Data (Always runs, even if tests fail)
    // =============================================================================
    console.log("Test 14: Cleanup test data");

    try {
        if (dbService instanceof PostgresDBService) {
            // For PostgreSQL, we need to manually delete test records
            const pool = (dbService as any).pool;
            
            // Delete test messages
            const deletedMessages = await pool.query(
                'DELETE FROM chat_messages WHERE room_name LIKE $1',
                [`%${testRoomName}%`]
            );
            console.log(`✓ Deleted ${deletedMessages.rowCount} test messages`);
            
            // Delete test rooms
            const deletedRooms = await pool.query(
                'DELETE FROM chat_rooms WHERE belonging_user_identity = $1',
                [testUserIdentity]
            );
            console.log(`✓ Deleted ${deletedRooms.rowCount} test rooms`);
        } else {
            // For MongoDB, delete collections
            const chatMessageCollection = (dbService as any).chatMessageCollection;
            const chatRoomsCollection = (dbService as any).chatRoomsCollection;
            
            const deletedMessages = await chatMessageCollection.deleteMany({
                roomName: { $regex: testRoomName }
            });
            console.log(`✓ Deleted ${deletedMessages.deletedCount} test messages`);
            
            const deletedRooms = await chatRoomsCollection.deleteMany({
                belongingUserIdentity: testUserIdentity
            });
            console.log(`✓ Deleted ${deletedRooms.deletedCount} test rooms`);
        }

        console.log("✓ All test data cleaned up\n");
    } catch (cleanupError) {
        console.error("❌ Cleanup failed:");
        console.error(cleanupError);
    }

    // =============================================================================
    // Summary
    // =============================================================================
    console.log("=== Test Summary ===");
    console.log(`✓ Test room: ${testRoomName}`);
    console.log(`✓ Test user: ${testUserIdentity}`);
    console.log(`✓ Test data cleanup completed`);

    // Close database connection
    try {
        await dbService.close();
        console.log("\n✓ Database connection closed");
    } catch (closeError) {
        console.error("❌ Failed to close database connection:");
        console.error(closeError);
    }

    console.log("\n=== Tests Finished ===");
}
