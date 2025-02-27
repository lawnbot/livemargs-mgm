import { Document } from "@langchain/core/documents";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { SRTLoader } from "@langchain/community/document_loaders/fs/srt";
import { OpenAIWhisperAudio } from "@langchain/community/document_loaders/fs/openai_whisper_audio";

/* // Single File
const nike10kPdfPath = "../../../../data/nke-10k-2023.pdf";

const loader = new PDFLoader(nike10kPdfPath);
const docs = await loader.load();

console.log(docs[0]);
 */

const traingDataPath = "./training_data";

/* Load all PDFs within the specified directory */
const directoryLoader = new DirectoryLoader(traingDataPath, {
    ".txt": (path: string) => new TextLoader(path),
    ".pdf": (path: string) => new PDFLoader(path),
    ".docx": (path: string) => new DocxLoader(path),
    ".pptx": (path: string) => new PPTXLoader(path),
    ".json": (path: string) => new JSONLoader(path),
    ".srt": (path: string) => new SRTLoader(path),
    //".mp3": (path: string) => new OpenAIWhisperAudio(path, ),
});

const directoryDocs = await directoryLoader.load();

// console.log(directoryDocs[100]);

/* Additional steps : Split text into chunks with any TextSplitter. You can then use it as context or save it to memory afterwards. */
const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

const splitDocs = await textSplitter.splitDocuments(directoryDocs);

// console.log(splitDocs[40]);

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_SECRET_KEY,
});

const vectorStore = new Chroma(embeddings, {
    collectionName: "robot-collection",
    url: "http://192.168.0.223:8102",
    collectionMetadata: { "hnsw:space": "cosine" },
});

await vectorStore.addDocuments(splitDocs);

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
