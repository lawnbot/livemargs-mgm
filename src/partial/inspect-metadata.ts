import { getChromaManagerByServiceType } from "../db/chroma-mgm.js";
import { AIServiceType } from "../ai/ai-interface.js";

async function inspectCollection() {
    try {
        const chromaManager = await getChromaManagerByServiceType(
            AIServiceType.OLLAMA,
            "ope"
        );

        console.log("📊 Inspecting OPE collection metadata...\n");

        // Query a few documents to check their metadata
        const results = await chromaManager.similaritySearch("DTT-2100", 5);

        console.log(`Found ${results.length} documents\n`);

        results.forEach((doc, idx) => {
            console.log(`\n--- Document ${idx + 1} ---`);
            console.log(`Filename: ${doc.metadata.filename}`);
            console.log(`Model Number: ${doc.metadata.model_number || "❌ MISSING"}`);
            console.log(`Product Category: ${doc.metadata.product_category || "❌ MISSING"}`);
            console.log(`Specificity: ${doc.metadata.specificity || "❌ MISSING"}`);
            console.log(`Available metadata keys:`, Object.keys(doc.metadata));
        });

        console.log("\n\n🔍 Analysis:");
        const hasTags = results.some(doc => 
            doc.metadata.model_number && 
            doc.metadata.product_category && 
            doc.metadata.specificity
        );

        if (hasTags) {
            console.log("✅ Documents have classification metadata - filters should work");
        } else {
            console.log("❌ Documents missing classification metadata - need to re-index!");
            console.log("\nRun: node dist/partial/reindex-collection.js ope-ollama-bge-m3");
        }

    } catch (error) {
        console.error("❌ Error inspecting collection:", error);
    }
}

inspectCollection();
