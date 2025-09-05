import { ChatOpenAI, OpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { Chroma } from "@langchain/community/vectorstores/chroma";
import { Request, Response } from "express";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { DirectoryLoader } from "langchain/document_loaders/fs/directory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { DocxLoader } from "@langchain/community/document_loaders/fs/docx";
import { JSONLoader } from "langchain/document_loaders/fs/json";
import { PPTXLoader } from "@langchain/community/document_loaders/fs/pptx";
import { TextLoader } from "langchain/document_loaders/fs/text";
import { SRTLoader } from "@langchain/community/document_loaders/fs/srt";
import * as path from "path";
import * as fs from "fs";

export const getAIResult = async (req: Request, res: Response) => {
    const { query } = req.body as { query: string };

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    res.end(await llmSearch(query));
};

export async function* startLangChainStream(
    query: string,
    collectionName: string = "robot-collection",
): AsyncIterable<string> {
    const currentVectorStore = new Chroma(embeddings, {
        collectionName: collectionName,
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });

    // Search relevant documents
    const retrievedDocs = await currentVectorStore.similaritySearch(query);

    // Pass only plain text (avoid embedding vectors/metadata)
    const contextTexts = retrievedDocs.map((d) => d.pageContent ?? String(d));
    // const contextTexts = retrievedDocs.map((d) => ({
    //     content: d.pageContent ?? String(d),
    //     metadata: d.metadata || {},
    // }));
    // Add finally context: contextTexts[0],

    // Start LangChain-Stream
    const eventStream = await ragChain.streamEvents(
        {
            question: query,
            context: contextTexts,
        },
        {
            version: "v2",
            // encoding: "text/event-stream", // Remove enconding to properly get it as event stream!!!!
        },
    );

    // Iterate over events and return only text chunks
    for await (const event of eventStream) {
        // Plain string events
        if (typeof event === "string") {
            yield event;
            continue;
        }

        // Structured events
        if (event && typeof event === "object") {
            const e: any = event;
            // Prefer chat model token events
            if (
                e.event === "on_chat_model_stream" &&
                typeof e.data?.chunk?.content === "string"
            ) {
                yield e.data.chunk.content;
                continue;
            }
            // Some implementations wrap data as string JSON
            if (typeof e.data === "string") {
                try {
                    const parsed = JSON.parse(e.data);
                    if (typeof parsed?.chunk?.content === "string") {
                        yield parsed.chunk.content;
                        continue;
                    }
                } catch {
                    // If it's plain text (not a JSON/array dump), yield
                    const s = e.data.trim();
                    const looksLikeArray = s.startsWith("[") && s.endsWith("]");
                    const looksLikeJSON = s.startsWith("{") && s.endsWith("}");
                    if (!looksLikeArray && !looksLikeJSON) {
                        yield s;
                    }
                    continue;
                }
            }
        }
        // Skip all other non-text events (do not stringify objects to avoid vectors)
    }
}
// https://www.robinwieruch.de/langchain-javascript-stream-structured/
export const streamAIResult = async (req: Request, res: Response) => {
    const { query } = req.body as { query: string };
    let headers = new Map<string, string>();
    headers.set("Connection", "keep-alive");
    headers.set("Content-Encoding", "none");
    headers.set("Cache-Control", "no-cache, no-transform");
    headers.set("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeaders(headers);

    // // Set the response headers for streaming
    // res.setHeader("Content-Type", "text/plain");
    // res.setHeader("Transfer-Encoding", "chunked");
    const currentVectorStore = new Chroma(embeddings, {
        collectionName: "robot-collection",
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });

    const retrievedDocs = await currentVectorStore.similaritySearch(query);

    let eventStream = await ragChain.streamEvents({
        question: query,
        context: retrievedDocs,
    }, {
        version: "v2",
        // encoding: "text/event-stream", // Remove enconding to properly get it as event stream!!!!
    });

    // for await (const { event, data } of eventStream) {
    //     if (event === "on_chat_model_stream") {
    //         await this.handleChatModelStream(data, res, model, metrics);
    //         if (typeof data.chunk.content === "string") {
    //             result += data.chunk.content;
    //         }
    //     }
    // }
    // Pipe the stream to the response
    //  stream.pipe(res);

    //  // Handle stream end
    //  stream.on('end', () => {
    //    res.end();
    //  });

    //  // Handle stream errors
    //  stream.on('error', (err) => {
    //    console.error('Stream error:', err);
    //    res.status(500).send('Internal Server Error');
    //  });

    const chunks = [];
    for await (const chunk of eventStream) {
        chunks.push(chunk);
        console.log(`${chunk}|`);
        res.write(chunk);
    }

    //res.send(stream);
    res.end();

    //     const stream = await ragChain.stream({
    //         question: query,
    //         context: retrievedDocs,
    //     });
    //     const chunks = [];

    //   for await (const chunk of stream) {
    //   chunks.push(chunk);
    //   //console.log(`${chunk.content}|`);
    //   res.send(chunk);
};

const llm = new ChatOpenAI({
    //configuration: ClientOptions(),
    openAIApiKey: process.env.OPENAI_SECRET_KEY,
    model: "gpt-5-nano", //"gpt-4",
    //zero temperature means no extra creativity
    temperature: 0,
});

const embeddings = new OpenAIEmbeddings({
    model: "text-embedding-3-large",
    apiKey: process.env.OPENAI_SECRET_KEY,
});

// const vectorStore = new Chroma(embeddings, {
//     collectionName: "robot-collection",
//     url: process.env.CHROMA_DB, //"http://192.168.0.223:8102"
//     collectionMetadata: { "hnsw:space": "cosine" },
// });

// Retrieve and generate using the relevant snippets of the blog.
//const retriever = vectorStore.asRetriever();
//const prompt = await pull<ChatPromptTemplate>("rlm/rag-prompt"); // Is a predefined one.

// const systemTemplate = "Translate the following into {language}:";
// const prompt = ChatPromptTemplate.fromMessages([
//     ["system", systemTemplate],
//     ["user", "{text}"],
// ]);
// Retrieve relevant documents

const prompt = ChatPromptTemplate.fromTemplate(
    `Answer the following question based on the provided context in the language of the Question: 
    {context}
    Question: {question}`,
);

const ragChain = await createStuffDocumentsChain({
    llm,
    prompt,
    outputParser: new StringOutputParser(),
});

async function llmSearch(query: string): Promise<string> {
    //const retrievedDocs = await retriever.invoke(query);
    const currentVectorStore = new Chroma(embeddings, {
        collectionName: "robot-collection",
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });

    const retrievedDocs = await currentVectorStore.similaritySearch(query);

    const result = await ragChain.invoke({
        question: query,
        context: retrievedDocs,
    });

    console.log("Generated response:", result);
    return result;
}
async function llmSearchWStreamResp(query: string): Promise<string> {
    //const retrievedDocs = await retriever.invoke(query);
    const currentVectorStore = new Chroma(embeddings, {
        collectionName: "robot-collection",
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });
    const retrievedDocs = await currentVectorStore.similaritySearch(query);

    const result = await ragChain.invoke({
        question: query,
        context: retrievedDocs,
    });

    console.log("Generated response:", result);
    return result;
}

// Helper function to extract detailed metadata
function extractDocumentMetadata(
    doc: Document,
    index: number,
    collectionName: string,
) {
    const filePath = doc.metadata.source || "";
    const filename = path.basename(filePath);
    const fileExtension = path.extname(filename).toLowerCase();
    const fileNameWithoutExt = path.basename(filename, fileExtension);

    // Extract page information if available from PDF metadata
    const pageNumber = doc.metadata.page || doc.metadata.loc?.pageNumber ||
        null;

    return {
        ...doc.metadata,
        filename: filename,
        file_path: filePath,
        file_extension: fileExtension.replace(".", ""),
        file_name_without_ext: fileNameWithoutExt,
        document_id: index,
        page_number: pageNumber,
        collection_name: collectionName,
        load_timestamp: new Date().toISOString(),
        file_size_chars: doc.pageContent.length,
        content_hash: doc.pageContent.slice(0, 100), // First 100 chars as identifier
    };
}

// Train all collections
// await startFolderBasedRAGTraining(undefined, undefined);

// Train sepcific collection
// await startFolderBasedRAGTraining("erco-collection", undefined);

// Train spezific file in a collection
// await startFolderBasedRAGTraining("robot-collection", "manual.pdf");

export async function startFolderBasedRAGTraining(
    specificCollectionToTrain: string | undefined,
    specificFileToTrain: string | undefined,
): Promise<void> {
    try {
        const uploadsRagBasePath = path.resolve(
            process.env.UPLOAD_DIR || "uploads",
            "rag",
        );

        // Check if base rag directory exists
        if (!fs.existsSync(uploadsRagBasePath)) {
            console.log(
                "No RAG upload directory found at:",
                uploadsRagBasePath,
            );
            return;
        }

        // Get all collection folders or specific one
        let collectionsToProcess: string[] = [];

        if (specificCollectionToTrain) {
            const collectionPath = path.join(
                uploadsRagBasePath,
                specificCollectionToTrain,
            );
            if (fs.existsSync(collectionPath)) {
                collectionsToProcess = [specificCollectionToTrain];
            } else {
                console.error(
                    `Collection folder not found: ${specificCollectionToTrain}`,
                );
                return;
            }
        } else {
            // Get all subdirectories in the rag folder
            const entries = await fs.promises.readdir(uploadsRagBasePath, {
                withFileTypes: true,
            });
            collectionsToProcess = entries
                .filter((entry) => entry.isDirectory())
                .map((entry) => entry.name);
        }

        console.log(
            `Processing collections: ${collectionsToProcess.join(", ")}`,
        );

        // Process each collection
        for (const collectionFolder of collectionsToProcess) {
            await processCollection(
                uploadsRagBasePath,
                collectionFolder,
                specificFileToTrain,
            );
        }

        console.log("RAG training completed successfully");
    } catch (error) {
        console.error("Error during RAG training:", error);
        throw error;
    }
}

async function processCollection(
    basePath: string,
    collectionFolder: string,
    specificFile?: string,
): Promise<void> {
    try {
        const collectionPath = path.join(basePath, collectionFolder);
        console.log(
            `Processing collection: ${collectionFolder} at ${collectionPath}`,
        );

        // Set up document loaders for different file types
        const loaderMap = {
            ".txt": (path: string) => new TextLoader(path),
            ".pdf": (path: string) => new PDFLoader(path),
            ".docx": (path: string) => new DocxLoader(path),
            ".pptx": (path: string) => new PPTXLoader(path),
            ".json": (path: string) => new JSONLoader(path),
            ".srt": (path: string) => new SRTLoader(path),
        };

        let docs: Document[] = [];

        if (specificFile) {
            // Load specific file
            const filePath = path.join(collectionPath, specificFile);
            if (!fs.existsSync(filePath)) {
                console.error(`Specific file not found: ${filePath}`);
                return;
            }

            const fileExtension = path.extname(specificFile).toLowerCase();
            const loaderFactory =
                loaderMap[fileExtension as keyof typeof loaderMap];

            if (!loaderFactory) {
                console.error(`Unsupported file type: ${fileExtension}`);
                return;
            }

            const loader = loaderFactory(filePath);
            docs = await loader.load();
            console.log(
                `Loaded specific file: ${specificFile} (${docs.length} documents)`,
            );
        } else {
            // Load all supported files in the collection directory
            const directoryLoader = new DirectoryLoader(
                collectionPath,
                loaderMap,
            );
            docs = await directoryLoader.load();
            console.log(
                `Loaded ${docs.length} documents from collection: ${collectionFolder}`,
            );
        }

        if (docs.length === 0) {
            console.log(
                `No documents found in collection: ${collectionFolder}`,
            );
            return;
        }

        // Add enhanced metadata to each document
        const docsWithMetadata = docs.map((doc, index) => {
            const enhancedMetadata = extractDocumentMetadata(
                doc,
                index,
                collectionFolder,
            );

            return new Document({
                pageContent: doc.pageContent,
                metadata: enhancedMetadata,
            });
        });

        // Split documents into chunks
        const textSplitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });

        const splitDocs = await textSplitter.splitDocuments(docsWithMetadata);

        // Add chunk-specific metadata
        const enhancedSplitDocs = splitDocs.map((doc, chunkIndex) => {
            return new Document({
                pageContent: doc.pageContent,
                metadata: {
                    ...doc.metadata,
                    chunk_id: chunkIndex,
                    chunk_length: doc.pageContent.length,
                    chunk_word_count: doc.pageContent.split(" ").length,
                    processing_timestamp: new Date().toISOString(),
                },
            });
        });

        console.log(
            `Created ${enhancedSplitDocs.length} chunks for collection: ${collectionFolder}`,
        );

        // Create vector store for this collection
        const collectionVectorStore = new Chroma(embeddings, {
            collectionName: collectionFolder, // Use folder name as collection name
            url: process.env.CHROMA_DB,
            collectionMetadata: { "hnsw:space": "cosine" },
        });

        // Add documents to vector store
        await collectionVectorStore.addDocuments(enhancedSplitDocs);

        console.log(
            `Successfully added ${enhancedSplitDocs.length} document chunks to collection: ${collectionFolder}`,
        );

        // Log sample metadata for debugging
        if (enhancedSplitDocs.length > 0) {
            console.log(
                "Sample document metadata for collection",
                collectionFolder,
                ":",
                enhancedSplitDocs[0].metadata,
            );
        }
    } catch (error) {
        console.error(
            `Error processing collection ${collectionFolder}:`,
            error,
        );
        throw error;
    }
}

// Add collection management
export async function listAvailableCollections(): Promise<string[]> {
    const uploadsRagBasePath = path.resolve(
        process.env.UPLOAD_DIR || "uploads",
        "rag",
    );

    if (!fs.existsSync(uploadsRagBasePath)) {
        return [];
    }

    const entries = await fs.promises.readdir(uploadsRagBasePath, {
        withFileTypes: true,
    });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name);
}

/* export async function getCollectionStats(collectionName: string): Promise<{
    documentCount: number;
    totalChunks: number;
    lastUpdated: Date;
    fileTypes: Record<string, number>;
}> {
    const vectorStore = new Chroma(embeddings, {
        collectionName,
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });

    // Implementation would depend on Chroma's API for collection statistics
    // This is a placeholder structure
    return {
        documentCount: 0,
        totalChunks: 0,
        lastUpdated: new Date(),
        fileTypes: {},
    };
} */
