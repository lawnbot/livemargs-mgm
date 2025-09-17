import { AIServiceType } from "../ai/ai-interface.js";
import { startFolderBasedRAGTraining } from "../controllers/ai.js";
import { deleteChromaCollection, getChromaManagerByServiceType } from "../db/chroma-mgm.js";

console.log("Start Training");

const chromaManager = await getChromaManagerByServiceType(
    AIServiceType.OLLAMA,
    "robot",
);
const collectionInfo = chromaManager.getCollectionInfo();
await chromaManager.deleteCollection();
await startFolderBasedRAGTraining(undefined, undefined);

// const documents: Document[] = [{
//     pageContent: "The powerhouse of the cell is the mitochondria",
//     metadata: { source: "https://example.com" },
// }, {
//     pageContent: "Buildings are made out of brick",
//     metadata: { source: "https://example.com" },
// }, {
//     pageContent: "Mitochondria are made out of lipids",
//     metadata: { source: "https://example.com" },
// }, {
//     pageContent: "The 2024 Olympics are in Paris",
//     metadata: { source: "https://example.com" },
// }];

//await vectorStore.addDocuments(documents, { ids: ["1", "2", "3", "4"] });
