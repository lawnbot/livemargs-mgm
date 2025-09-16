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
import { RagSources } from "../models/rag-sources.js";
import { getChromaManagerByServiceType } from "../db/chroma-mgm.js";
import { AIServiceType } from "../ai/ai-interface.js";
import { createSafePreview } from "../ai/base-ai-service.js";

export const getAIResult = async (req: Request, res: Response) => {
    const { query } = req.body as { query: string };

    res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });

    res.end(await llmSearch(query));
};

export async function* startLangChainStream(
    query: string,
    collectionName: string = "robot-collection",
): AsyncIterable<string | RagSources> {
    const currentVectorStore = new Chroma(embeddings, {
        collectionName: collectionName,
        url: process.env.CHROMA_DB,
        collectionMetadata: { "hnsw:space": "cosine" },
    });

    // Search relevant documents
    const retrievedDocsWithScores = await currentVectorStore
        .similaritySearchWithScore(query, 4);
    const retrievedDocs = retrievedDocsWithScores.map(([doc, score]) => doc);

    // Debug: Log retrieved documents
    // console.log(
    //     `🔍 Retrieved ${retrievedDocs.length} documents from collection ${collectionName}`,
    // );
    // if (retrievedDocs.length > 0) {
    //     console.log(
    //         "📄 Sample document content:",
    //         retrievedDocs[0].pageContent.substring(0, 200) + "...",
    //     );
    // }

    // const contextTexts = retrievedDocs.map((d) => ({
    //     content: d.pageContent ?? String(d),
    //     metadata: d.metadata || {},
    // }));
    // Add finally context: contextTexts[0],

    // Start LangChain-Stream
    const eventStream = await ragChain.streamEvents(
        {
            question: query,
            context: retrievedDocs,
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
    // Send sources as typed JSON object
    if (retrievedDocsWithScores.length > 0) {
        const sourcesEvent: RagSources = {
            metadataType: "rag-sources",

            sources: retrievedDocsWithScores.map(([doc, score], index) => ({
                id: index + 1,
                filename: doc.metadata?.filename ||
                    path.basename(doc.metadata?.source) ||
                    "",
                page: doc.metadata?.page || doc.metadata?.page_number,
                collection: doc.metadata?.collection_name || collectionName,
                relevanceScore: Math.round(score * 1000) / 1000,
                preview: createSafePreview(doc.pageContent, 150),
                wordCount: doc.pageContent.split(" ").length,
                fileType: doc.metadata?.file_extension || "",
                chunkId: doc.metadata?.chunk_id || index,
            })),
            query: query,
            collectionName: collectionName,
        };

        yield sourcesEvent;
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
    // Debug: Log retrieved documents
    console.log(
        `🔍 Retrieved ${retrievedDocs.length} documents for query: ${query}`,
    );

    let eventStream = await ragChain.streamEvents({
        question: query,
        context: retrievedDocs, // Document-Objects, nicht Strings!
    }, {
        version: "v2",
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
    model: "gpt-5-chat-latest", //"gpt-4", //"gpt-5-chat-latest", //"gpt-5-nano", //"gpt-4.1-mini", //"gpt-5-nano", //"gpt-4",
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
            `🔄 Processing collection: ${collectionFolder} at ${collectionPath}`,
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
                console.error(`❌ Specific file not found: ${filePath}`);
                return;
            }

            const fileExtension = path.extname(specificFile).toLowerCase();
            const loaderFactory =
                loaderMap[fileExtension as keyof typeof loaderMap];

            if (!loaderFactory) {
                console.error(`❌ Unsupported file type: ${fileExtension}`);
                return;
            }

            const loader = loaderFactory(filePath);
            docs = await loader.load();
            console.log(
                `📄 Loaded specific file: ${specificFile} (${docs.length} documents)`,
            );
        } else {
            // Load all supported files in the collection directory
            const directoryLoader = new DirectoryLoader(
                collectionPath,
                loaderMap,
            );
            docs = await directoryLoader.load();
            console.log(
                `📚 Loaded ${docs.length} documents from collection: ${collectionFolder}`,
            );
        }

        if (docs.length === 0) {
            console.log(
                `⚠️ No documents found in collection: ${collectionFolder}`,
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

        // CRITICAL: Sanitize and validate documents for Chroma
        const validatedDocs = splitDocs
            .map((doc, chunkIndex) => {
                // Validate content
                if (!doc.pageContent || doc.pageContent.trim().length === 0) {
                    console.warn(
                        `⚠️ Skipping empty document at chunk ${chunkIndex}`,
                    );
                    return null;
                }

                // Limit content length (Chroma has limits)
                const maxContentLength = 8000;
                let content = doc.pageContent;
                if (content.length > maxContentLength) {
                    console.warn(
                        `✂️ Truncating long document from ${content.length} to ${maxContentLength} chars`,
                    );
                    content = content.substring(0, maxContentLength) + "...";
                }

                // Sanitize metadata for Chroma compatibility
                const sanitizedMetadata = sanitizeMetadataForChroma({
                    ...doc.metadata,
                    chunk_id: chunkIndex,
                    chunk_length: content.length,
                    chunk_word_count: content.split(" ").length,
                    processing_timestamp: new Date().toISOString(),
                });

                return new Document({
                    pageContent: content,
                    metadata: sanitizedMetadata,
                });
            })
            .filter((doc): doc is Document => doc !== null);

        if (validatedDocs.length === 0) {
            console.error(
                `❌ No valid documents after validation for collection: ${collectionFolder}`,
            );
            return;
        }

        console.log(
            `✅ Validated ${validatedDocs.length}/${splitDocs.length} chunks for collection: ${collectionFolder}`,
        );

        //await ensureCollectionExists(collectionFolder);

        // Create vector store for this collection
        const collectionVectorStore = new Chroma(embeddings, {
            collectionName: collectionFolder, // Use folder name as collection name
            url: process.env.CHROMA_DB,

            collectionMetadata: { "hnsw:space": "cosine" },
        });

        // Add documents to vector store
        // await collectionVectorStore.addDocuments(splitDocs);
        //await collectionVectorStore.addDocuments(enhancedSplitDocs);

        console.log("🚀 Starting to add documents to Chroma...");

        // Process in smaller batches to avoid overloading Chroma
        const batchSize = 5;
        let successCount = 0;

        for (let i = 0; i < validatedDocs.length; i += batchSize) {
            const batch = validatedDocs.slice(i, i + batchSize);
            const batchNum = Math.floor(i / batchSize) + 1;
            const totalBatches = Math.ceil(validatedDocs.length / batchSize);

            try {
                console.log(
                    `📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} docs)`,
                );
                await collectionVectorStore.addDocuments(batch);
                successCount += batch.length;
                console.log(`✅ Batch ${batchNum} added successfully`);
            } catch (batchError) {
                console.error(`❌ Error in batch ${batchNum}:`, batchError);

                // Try individual documents in failed batch
                for (let j = 0; j < batch.length; j++) {
                    try {
                        await collectionVectorStore.addDocuments([batch[j]]);
                        successCount++;
                        console.log(
                            `✅ Individual document ${i + j + 1} added`,
                        );
                    } catch (docError) {
                        console.error(
                            `❌ Failed individual document ${i + j + 1}:`,
                            docError,
                        );
                        console.error("Problematic document preview:", {
                            contentLength: batch[j].pageContent.length,
                            metadataKeys: Object.keys(batch[j].metadata),
                            contentPreview:
                                batch[j].pageContent.substring(0, 200) + "...",
                        });
                    }
                }
            }
        }

        console.log(
            `🎉 Successfully added ${successCount}/${validatedDocs.length} document chunks to collection: ${collectionFolder}`,
        );

        // Log sample metadata for debugging
        if (validatedDocs.length > 0) {
            console.log(
                "📋 Sample document metadata for collection",
                collectionFolder,
                ":",
            );
            console.log(JSON.stringify(validatedDocs[0].metadata, null, 2));
        }
    } catch (error) {
        console.error(
            `Error processing collection ${collectionFolder}:`,
            error,
        );
        throw error;
    }
}

// Helper function to sanitize metadata for Chroma
function sanitizeMetadataForChroma(metadata: any): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(metadata)) {
        // Skip null/undefined values
        if (value === null || value === undefined) continue;

        // Convert to appropriate types
        let sanitizedValue: any = value;

        if (typeof value === "object" && value !== null) {
            // Convert objects to strings
            sanitizedValue = JSON.stringify(value);
        } else if (typeof value === "string") {
            // Limit string length
            const maxLength = 500;
            if (value.length > maxLength) {
                sanitizedValue = value.substring(0, maxLength) + "...";
            }
            // Remove problematic characters
            sanitizedValue = value.replace(/[\x00-\x1F\x7F]/g, "");
        }

        // Clean key name (Chroma is picky about field names)
        const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, "_");

        if (cleanKey && sanitizedValue !== "") {
            sanitized[cleanKey] = sanitizedValue;
        }
    }

    return sanitized;
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

export async function clearChromaCollection(
    collectionName: string,
): Promise<void> {
    try {
        const vectorStore = new Chroma(embeddings, {
            collectionName: collectionName,
            url: process.env.CHROMA_DB,
            collectionMetadata: { "hnsw:space": "cosine" },
        });

        // Delete all documents in the collection
        await vectorStore.delete({});
        console.log(`Successfully cleared collection: ${collectionName}`);
    } catch (error) {
        console.error(`Error clearing collection ${collectionName}:`, error);
        throw error;
    }
}

/* // List all collections in Chroma DB
export async function listChromaCollections(): Promise<string[]> {
    try {
        const { ChromaClient } = await import("chromadb");
        const client = new ChromaClient({
            path: process.env.CHROMA_DB
        });

        const collections = await client.listCollections();
        return collections.map(c => c.name);
    } catch (error) {
        console.error("Error listing Chroma collections:", error);
        return [];
    }
} */

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
