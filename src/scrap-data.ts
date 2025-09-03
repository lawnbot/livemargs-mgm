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
import * as path from 'path';

// Helper function to extract detailed metadata
function extractDocumentMetadata(doc: Document, index: number) {
    const filePath = doc.metadata.source || '';
    const filename = path.basename(filePath);
    const fileExtension = path.extname(filename).toLowerCase();
    const fileNameWithoutExt = path.basename(filename, fileExtension);
    
    // Extract page information if available from PDF metadata
    const pageNumber = doc.metadata.page || doc.metadata.loc?.pageNumber || null;
    
    return {
        ...doc.metadata,
        filename: filename,
        file_path: filePath,
        file_extension: fileExtension.replace('.', ''),
        file_name_without_ext: fileNameWithoutExt,
        document_id: index,
        page_number: pageNumber,
        load_timestamp: new Date().toISOString(),
        file_size_chars: doc.pageContent.length,
        content_hash: doc.pageContent.slice(0, 100), // First 100 chars as identifier
    };
}

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

// Add filename metadata to each document
const docsWithMetadata = directoryDocs.map((doc, index) => {
    const enhancedMetadata = extractDocumentMetadata(doc, index);
    
    return new Document({
        pageContent: doc.pageContent,
        metadata: enhancedMetadata
    });
});

// console.log(directoryDocs[100]);

/* Additional steps : Split text into chunks with any TextSplitter. You can then use it as context or save it to memory afterwards. */
const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
});

const splitDocs = await textSplitter.splitDocuments(docsWithMetadata);

// Add chunk-specific metadata including page numbers
const enhancedSplitDocs = splitDocs.map((doc, chunkIndex) => {
    const estimatedPageNumber = Math.floor(chunkIndex / 3) + 1; // Rough estimation: 3 chunks per page
    
    return new Document({
        pageContent: doc.pageContent,
        metadata: {
            ...doc.metadata,
            chunk_id: chunkIndex,
            estimated_page: estimatedPageNumber,
            chunk_length: doc.pageContent.length,
            chunk_word_count: doc.pageContent.split(' ').length,
            processing_timestamp: new Date().toISOString()
        }
    });
});

// console.log(splitDocs[40]);

// Debug: Show metadata for a few documents
console.log("Sample document metadata:");
console.log("Enhanced docs count:", enhancedSplitDocs.length);
if (enhancedSplitDocs.length > 0) {
    console.log("First document metadata:", enhancedSplitDocs[0].metadata);
    if (enhancedSplitDocs.length > 5) {
        console.log("Fifth document metadata:", enhancedSplitDocs[4].metadata);
    }
}

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_SECRET_KEY,
});

const vectorStore = new Chroma(embeddings, {
    collectionName: "robot-collection",
    url: "http://192.168.0.223:8102",
    collectionMetadata: { "hnsw:space": "cosine" },
});

await vectorStore.addDocuments(enhancedSplitDocs);

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
