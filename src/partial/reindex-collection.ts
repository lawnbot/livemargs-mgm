import { ChromaClient } from "chromadb";
import { startFolderBasedRAGTraining } from "../controllers/ai.js";

/**
 * Delete and re-index a collection with proper metadata
 */
async function reindexCollection(collectionName: string) {
    try {
        console.log(`🗑️  Deleting old collection: ${collectionName}...`);
        
        const client = new ChromaClient({
            path: process.env.CHROMA_URL || "http://localhost:8000",
        });

        // Try to delete the collection (will error if it doesn't exist, that's ok)
        try {
            await client.deleteCollection({ name: collectionName });
            console.log(`✅ Deleted old collection: ${collectionName}`);
        } catch (deleteError) {
            console.log(`ℹ️  Collection ${collectionName} didn't exist or couldn't be deleted`);
        }

        console.log(`\n📚 Re-indexing collection: ${collectionName}...`);
        
        // Map collection names to folder names
        const folderMap: Record<string, string> = {
            "ope-ollama-bge-m3": "ope-collection",
            "robot-ollama-bge-m3": "robot-collection",
        };

        const folderName = folderMap[collectionName] || collectionName.replace(/-ollama-bge-m3$/, '-collection');
        
        // Re-train with new metadata
        await startFolderBasedRAGTraining(folderName, undefined);
        
        console.log(`\n✅ Successfully re-indexed ${collectionName} with proper metadata!`);
        
    } catch (error) {
        console.error(`❌ Error re-indexing collection:`, error);
        throw error;
    }
}

// Run re-indexing
const collectionToReindex = process.argv[2] || "ope-ollama-bge-m3";

console.log(`🔄 Starting re-indexing for collection: ${collectionToReindex}`);
console.log(`This will delete and rebuild the collection with proper metadata.\n`);

reindexCollection(collectionToReindex)
    .then(() => {
        console.log(`\n✨ Re-indexing complete!`);
        process.exit(0);
    })
    .catch((error) => {
        console.error(`\n💥 Re-indexing failed:`, error);
        process.exit(1);
    });
