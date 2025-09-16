import { Document } from "@langchain/core/documents";
import { BaseLanguageModel } from "@langchain/core/language_models/base";
import { Embeddings } from "@langchain/core/embeddings";

export interface IAIService {
    // Chat/Completion methods
    generateResponse(prompt: string, context?: string): Promise<string>;
    generateStreamResponse(prompt: string, context?: string): AsyncIterableIterator<string>;
    
    // RAG (Retrieval Augmented Generation) methods
    generateRAGResponse(query: string, documents: Document[]): Promise<string>;
    
    // Embedding methods
    createEmbeddings(texts: string[]): Promise<number[][]>;
    createSingleEmbedding(text: string): Promise<number[]>;
    
    // Model access
    getLLM(): BaseLanguageModel;
    getEmbeddings(): Embeddings;
    
    // Service info
    getServiceName(): string;
    isAvailable(): Promise<boolean>;
}

export enum AIServiceType {
    OPENAI = 'openai',
    OLLAMA = 'ollama'
}

export interface AIServiceConfig {
    apiKey?: string;
    baseUrl?: string;
    model?: string;
    embeddingModel?: string;
    temperature?: number;
    maxTokens?: number;
}
