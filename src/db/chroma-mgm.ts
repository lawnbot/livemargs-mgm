import { Chroma } from "@langchain/community/vectorstores/chroma";

import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_SECRET_KEY,
});

export async function deleteChromaCollection(
    collectionName: string,
): Promise<void> {
    try {
        // Use Chroma client directly for collection deletion
        const { ChromaClient } = await import("chromadb");
        const client = new ChromaClient({
            path: process.env.CHROMA_DB,
        });

        await client.deleteCollection({ name: collectionName });
        console.log(`Successfully deleted collection: ${collectionName}`);
    } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        throw error;
    }
}

