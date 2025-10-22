import { AIServiceType } from "../ai/ai-interface.js";
import { startLangChainStream } from "../controllers/ai.js";
import { getChromaManagerByServiceType } from "../db/chroma-mgm.js";

const testResults = async () => {
    const chunks = [];
    try {
        console.log(`🧪 Test starting with AI Service: ${AIServiceType.OLLAMA}`);
        console.log(`🧪 Expected collection should be: robot-ollama-bge-m3`);
        console.log(`🧪 Environment OLLAMA_EMBEDDING_MODEL: ${process.env.OLLAMA_EMBEDDING_MODEL}`);
        
        // Debug: Test ChromaManager directly
        console.log(`🧪 Testing ChromaManager directly...`);
        const chromaManager = await getChromaManagerByServiceType(AIServiceType.OLLAMA, 'robot');
        const collectionInfo = chromaManager.getCollectionInfo();
        console.log(`🧪 ChromaManager collection info:`, collectionInfo);
        
        const stream = await startLangChainStream(
            //"Wie update ich die RTK-Basis?",
            //"Wie update ich die Akku-Firmware?",
            //"robot-collection", // Explicitly specify collection
            "Vorteile der DTT-2100",
            "ope-collection",
            AIServiceType.OLLAMA // Explicitly specify Ollama
        );
        for await (const chunk of stream) {

            if (typeof chunk === "string") {
                chunks.push(chunk);
                console.log(chunk);
            } else {
                console.log("Non-string chunk:", chunk);
            }
        }

        console.log("final: " + chunks.join(""));
    } catch (e) {
        console.log('error', e);
    }
};
testResults();

// (async () => {
//     const chunks = [];
//     try {
//         const stream = await startLangChainStream(
//             "Roboter mit höchster Flächenleistung?",
//         );
//         for await (const chunk of stream) {
//             chunks.push(chunk);
//         }
//     } catch (e) {
//     }
// });
