import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { ChromaClient } from "chromadb";
import { Document } from "@langchain/core/documents";
import dotenv from "dotenv";
// Initialize dotenv to load environment variables from .env file
dotenv.config();

console.log("=".repeat(80));
console.log("🧪 CHROMADB CONNECTION TEST");
console.log("=".repeat(80));
console.log();

// Test 1: Direct ChromaClient connection
console.log("Test 1: ChromaClient Direct Connection");
console.log("-".repeat(80));

const client = new ChromaClient({
    path: "http://192.168.0.223:8102"
});

try {
    const heartbeat = await client.heartbeat();
    console.log("✅ ChromaDB connected:", heartbeat);

    const collections = await client.listCollections();
    console.log(`📚 Collections found: ${collections.length}`);
    collections.forEach(col => {
        console.log(`   - ${col.name} (${col.metadata?.description || 'no description'})`);
    });
} catch (error) {
    console.error("❌ Connection failed:", error);
    process.exit(1);
}

console.log();
console.log("Test 2: Chroma VectorStore with host/port");
console.log("-".repeat(80));

// Test 2: Chroma VectorStore with host/port parameters
const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-small",
      apiKey: process.env.OPENAI_SECRET_KEY,
});


const vectorStore = new Chroma(embeddings, {
    collectionName: "test-collection",
    url: process.env.CHROMA_URL ?? "",  // ✅ Recommended: Use url parameter
});

try {
    console.log("Creating test collection...");
    
    // Add test documents
    const testDocs: Document[] = [
        {
            pageContent: "The TM-850 is a robotic lawn mower with advanced navigation.",
            metadata: { 
                source: "test",
                model_number: "TM-850",
                product_category: "robot",
                power_type: "battery"
            }
        },
        {
            pageContent: "The DCS-5000 is a battery-powered chainsaw.",
            metadata: { 
                source: "test",
                model_number: "DCS-5000",
                product_category: "ope",
                power_type: "battery"
            }
        },
        {
            pageContent: "General safety guidelines for all power equipment.",
            metadata: { 
                source: "test",
                specificity: "general"
            }
        }
    ];
    
    await vectorStore.addDocuments(testDocs);
    console.log("✅ Test documents added successfully");
    
    // Test similarity search
    console.log("\nTest 3: Similarity Search");
    console.log("-".repeat(80));
    
    const searchResults = await vectorStore.similaritySearch("robot mower", 2);
    console.log(`✅ Found ${searchResults.length} results:`);
    searchResults.forEach((doc, idx) => {
        console.log(`\n   ${idx + 1}. ${doc.metadata.model_number || 'General'}`);
        console.log(`      Preview: ${doc.pageContent.substring(0, 60)}...`);
        console.log(`      Metadata:`, doc.metadata);
    });
    
    // Test filtered search
    console.log("\nTest 4: Filtered Search (battery-powered only)");
    console.log("-".repeat(80));
    
    const filteredResults = await vectorStore.similaritySearch(
        "power equipment",
        3,
        { power_type: "battery" }  // Filter for battery-powered only
    );
    
    console.log(`✅ Found ${filteredResults.length} battery-powered results:`);
    filteredResults.forEach((doc, idx) => {
        console.log(`   ${idx + 1}. ${doc.metadata.model_number || 'N/A'} - ${doc.metadata.product_category}`);
    });
    
    // Test search with scores
    console.log("\nTest 5: Search with Similarity Scores");
    console.log("-".repeat(80));
    
    const resultsWithScores = await vectorStore.similaritySearchWithScore("chainsaw", 2);
    console.log(`✅ Found ${resultsWithScores.length} results with scores:`);
    resultsWithScores.forEach(([doc, score], idx) => {
        console.log(`   ${idx + 1}. Score: ${score.toFixed(4)} - ${doc.metadata.model_number || 'General'}`);
        console.log(`      ${doc.pageContent.substring(0, 60)}...`);
    });
    
    // Cleanup
    console.log("\nTest 6: Collection Cleanup");
    console.log("-".repeat(80));
    
    await client.deleteCollection({ name: "test-collection" });
    console.log("✅ Test collection deleted");
    
    console.log();
    console.log("=".repeat(80));
    console.log("🎉 ALL TESTS PASSED");
    console.log("=".repeat(80));
    
} catch (error) {
    console.error("❌ VectorStore test failed:", error);
    
    // Cleanup on error
    try {
        await client.deleteCollection({ name: "test-collection" });
        console.log("🧹 Cleaned up test collection");
    } catch (cleanupError) {
        console.error("Failed to cleanup:", cleanupError);
    }
    
    process.exit(1);
}

console.log();
console.log("Test 7: Alternative Connection Methods");
console.log("-".repeat(80));

// Show different ways to connect
console.log("\n✅ Successful connection methods:");
console.log("   1. ChromaClient with path:");
console.log('      new ChromaClient({ path: "http://192.168.0.223:8102" })');
console.log();
console.log("   2. Chroma VectorStore with url:");
console.log('      new Chroma(embeddings, { url: "http://192.168.0.223:8102" })');
console.log();
console.log("   3. Chroma VectorStore with clientParams:");
console.log('      new Chroma(embeddings, { ');
console.log('        clientParams: { path: "http://192.168.0.223:8102" }');
console.log('      })');

console.log();
console.log("=".repeat(80));
console.log("✅ CONNECTION TEST COMPLETE");
console.log("=".repeat(80));