import { Document } from "@langchain/core/documents";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Embeddings } from "@langchain/core/embeddings";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { createStuffDocumentsChain } from "langchain/chains/combine_documents";
import { IAIService } from "./ai-interface.js";
import { RagSources } from "../models/rag-sources.js";
import path from "path";

export abstract class BaseAIService implements IAIService {
    protected abstract llm: BaseLanguageModel;
    protected abstract embeddings: Embeddings;
    protected abstract serviceName: string;

    // Abstract methods that must be implemented by each service
    abstract isAvailable(): Promise<boolean>;

    // Common implementations that can be shared
    async generateResponse(prompt: string, context?: string): Promise<string> {
        try {
            const fullPrompt = context
                ? `Context: ${context}\n\nQuery: ${prompt}`
                : prompt;
            const response = await this.llm.invoke(fullPrompt);
            return typeof response === "string"
                ? response
                : response.content?.toString() || "";
        } catch (error) {
            throw new Error(
                `${this.serviceName} response generation failed: ${error}`,
            );
        }
    }

    async *generateStreamResponse(
        prompt: string,
        context?: string,
    ): AsyncIterableIterator<string> {
        try {
            const fullPrompt = context
                ? `Context: ${context}\n\nQuery: ${prompt}`
                : prompt;
            const stream = await this.llm.stream(fullPrompt);

            for await (const chunk of stream) {
                if (chunk && chunk.content) {
                    yield chunk.content.toString();
                } else if (typeof chunk === "string") {
                    yield chunk;
                }
            }
        } catch (error) {
            throw new Error(
                `${this.serviceName} stream generation failed: ${error}`,
            );
        }
    }

    async *generateRAGStreamResponseWithSources(
        query: string,
        collectionName: string = "robot-collection",
        retrievedDocsWithScores: [Document, number][],
    ): AsyncIterable<string | RagSources> {
        // Search relevant documents
        const retrievedDocs = retrievedDocsWithScores.map(([doc, score]) =>
            doc
        );

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

        const ragChain = await createStuffDocumentsChain({
            llm: this.llm,
            prompt,
            outputParser: new StringOutputParser(),
        });

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
                        const looksLikeArray = s.startsWith("[") &&
                            s.endsWith("]");
                        const looksLikeJSON = s.startsWith("{") &&
                            s.endsWith("}");
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

    async generateRAGResponse(
        query: string,
        documents: Document[],
    ): Promise<string> {
        try {
            const prompt = ChatPromptTemplate.fromTemplate(`
                Answer the following question based only on the provided context.
                If you cannot answer the question based on the context, say so.
                
                Context: {context}
                
                Question: {question}
            `);

            const ragChain = await createStuffDocumentsChain({
                llm: this.llm,
                prompt,
                outputParser: new StringOutputParser(),
            });

            const response = await ragChain.invoke({
                question: query,
                context: documents,
            });

            return response;
        } catch (error) {
            throw new Error(
                `${this.serviceName} RAG generation failed: ${error}`,
            );
        }
    }

    async createEmbeddings(texts: string[]): Promise<number[][]> {
        try {
            return await this.embeddings.embedDocuments(texts);
        } catch (error) {
            throw new Error(
                `${this.serviceName} embeddings creation failed: ${error}`,
            );
        }
    }

    async createSingleEmbedding(text: string): Promise<number[]> {
        try {
            return await this.embeddings.embedQuery(text);
        } catch (error) {
            throw new Error(
                `${this.serviceName} single embedding creation failed: ${error}`,
            );
        }
    }

    getLLM(): BaseLanguageModel {
        return this.llm;
    }

    getEmbeddings(): Embeddings {
        return this.embeddings;
    }

    getServiceName(): string {
        return this.serviceName;
    }
}

const prompt = ChatPromptTemplate.fromTemplate(
    `Answer the following question based on the provided context in the language of the Question: 
    {context}
    Question: {question}`,
);

// Helper function to create safe preview
export function createSafePreview(content: string, maxLength: number = 150): string {
    if (!content) return "";

    const cleanContent = content.replace(/\n/g, " ").trim();

    if (cleanContent.length <= maxLength) {
        return cleanContent;
    }

    return cleanContent.substring(0, maxLength) + "...";
}
