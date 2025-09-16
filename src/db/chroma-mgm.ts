import { Chroma } from "@langchain/community/vectorstores/chroma";
import { OpenAIEmbeddings } from "@langchain/openai";
import { OllamaEmbeddings } from "@langchain/ollama";
import { Document } from "@langchain/core/documents";
import { Embeddings } from "@langchain/core/embeddings";
import { AIServiceType } from '../ai/ai-interface.js';

export interface ChromaConfig {
    url?: string;
    path?: string;
    aiServiceType: AIServiceType;
    embeddingModel?: string;
    topic?: string; // Simple topic name like "robot", "medical", etc.
}

export class ChromaManager {
    private static instances: Map<string, ChromaManager> = new Map();
    private vectorStore: Chroma | null = null;
    private embeddings: Embeddings;
    private collectionName: string;
    private config: ChromaConfig;

    private constructor(config: ChromaConfig) {
        this.config = config;
        this.collectionName = this.generateCollectionName(config);
        this.embeddings = this.createEmbeddings(config);
    }

    /**
     * Get or create ChromaManager instance for specific AI service
     */
    public static getInstance(config: ChromaConfig): ChromaManager {
        const key = `${config.aiServiceType}-${config.embeddingModel || 'default'}-${config.topic || 'general'}`;
        
        if (!ChromaManager.instances.has(key)) {
            ChromaManager.instances.set(key, new ChromaManager(config));
        }
        
        return ChromaManager.instances.get(key)!;
    }

    /**
     * Generate collection name based on AI service and model
     */
    private generateCollectionName(config: ChromaConfig): string {
        // Simple pattern: topic-service-model (or fallback to env vars)
        const topic = config.topic || process.env.CHROMA_DEFAULT_TOPIC || 'general';
        const servicePrefix = config.aiServiceType.toLowerCase();
        const model = config.embeddingModel || this.getDefaultModelFromEnv(config.aiServiceType);
        
        // Clean topic name
        const cleanTopic = topic.toLowerCase().replace(/[^a-zA-Z0-9]/g, '-');
        
        // Clean model name
        const cleanModel = model.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
        
        return `${cleanTopic}-${servicePrefix}-${cleanModel}`;
    }

    /**
     * Get default model from environment variables
     */
    private getDefaultModelFromEnv(serviceType: AIServiceType): string {
        switch (serviceType) {
            case AIServiceType.OPENAI:
                return process.env.OPENAI_EMBEDDING_MODEL || 'text-embedding-3-large';
            case AIServiceType.OLLAMA:
                return process.env.OLLAMA_EMBEDDING_MODEL || 'nomic-embed-text';
            default:
                return 'default';
        }
    }

    /**
     * Create appropriate embeddings based on AI service type
     */
    private createEmbeddings(config: ChromaConfig): Embeddings {
        switch (config.aiServiceType) {
            case AIServiceType.OPENAI:
                return new OpenAIEmbeddings({
                    model: config.embeddingModel || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
                    apiKey: process.env.OPENAI_SECRET_KEY,
                });
            
            case AIServiceType.OLLAMA:
                return new OllamaEmbeddings({
                    model: config.embeddingModel || process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
                    baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
                });
            
            default:
                throw new Error(`Unsupported AI service type: ${config.aiServiceType}`);
        }
    }

    /**
     * Initialize vector store
     */
    public async initialize(): Promise<void> {
        try {
            this.vectorStore = new Chroma(this.embeddings, {
                url: this.config.url || process.env.CHROMA_URL,
                collectionName: this.collectionName,
                collectionMetadata: { "hnsw:space": "cosine" },                
            });
            
            console.log(`Initialized Chroma collection: ${this.collectionName}`);
        } catch (error) {
            console.error(`Failed to initialize Chroma for ${this.config.aiServiceType}:`, error);
            throw error;
        }
    }

    /**
     * Add documents to vector store
     */
    public async addDocuments(documents: Document[]): Promise<void> {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            await this.vectorStore!.addDocuments(documents);
            console.log(`Added ${documents.length} documents to ${this.collectionName}`);
        } catch (error) {
            console.error(`Failed to add documents to ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Search similar documents
     */
    public async similaritySearch(
        query: string, 
        k: number = 4,
        filter?: Record<string, any>
    ): Promise<Document[]> {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            return await this.vectorStore!.similaritySearch(query, k, filter);
        } catch (error) {
            console.error(`Failed to search in ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Search with scores
     */
    public async similaritySearchWithScore(
        query: string, 
        k: number = 5,
        filter?: Record<string, any>
    ): Promise<[Document, number][]> {
        if (!this.vectorStore) {
            await this.initialize();
        }

        try {
            return await this.vectorStore!.similaritySearchWithScore(query, k, filter);
        } catch (error) {
            console.error(`Failed to search with scores in ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Delete collection
     */
    public async deleteCollection(): Promise<void> {
        try {
            const { ChromaClient } = await import("chromadb");
            const client = new ChromaClient({
                path: this.config.path || process.env.CHROMA_URL,
            });

            await client.deleteCollection({ name: this.collectionName });
            console.log(`Successfully deleted collection: ${this.collectionName}`);
            
            // Reset vector store
            this.vectorStore = null;
        } catch (error) {
            console.error(`Error deleting collection ${this.collectionName}:`, error);
            throw error;
        }
    }

    /**
     * Get collection info
     */
    public getCollectionInfo(): {
        name: string;
        aiServiceType: AIServiceType;
        embeddingModel: string;
        dimensions: number;
    } {
        const dimensionMap: Record<string, number> = {
            'text-embedding-3-large': 3072,
            'text-embedding-3-small': 1536,
            'text-embedding-ada-002': 1536,
            'nomic-embed-text': 768,
            'all-MiniLM-L6-v2': 384,
        };

        const model = this.config.embeddingModel || 
            (this.config.aiServiceType === AIServiceType.OPENAI ? 'text-embedding-3-large' : 'nomic-embed-text');

        return {
            name: this.collectionName,
            aiServiceType: this.config.aiServiceType,
            embeddingModel: model,
            dimensions: dimensionMap[model] || 0
        };
    }

    /**
     * Get vector store instance
     */
    public getVectorStore(): Chroma | null {
        return this.vectorStore;
    }

    /**
     * Get embeddings instance
     */
    public getEmbeddings(): Embeddings {
        return this.embeddings;
    }
}

// Convenience functions
export async function getChromaManagerByServiceType(
    aiServiceType: AIServiceType,
    topic?: string,
    embeddingModel?: string
): Promise<ChromaManager> {
    const manager = ChromaManager.getInstance({
        aiServiceType,
        embeddingModel,
        topic
    });
    await manager.initialize();
    return manager;
}

export async function getOpenAIChromaManager(topic?: string, embeddingModel?: string): Promise<ChromaManager> {
    const manager = ChromaManager.getInstance({
        aiServiceType: AIServiceType.OPENAI,
        embeddingModel,
        topic
    });
    await manager.initialize();
    return manager;
}

export async function getOllamaChromaManager(topic?: string, embeddingModel?: string): Promise<ChromaManager> {
    const manager = ChromaManager.getInstance({
        aiServiceType: AIServiceType.OLLAMA,
        embeddingModel,
        topic
    });
    await manager.initialize();
    return manager;
}

// Legacy function for backward compatibility
export async function deleteChromaCollection(
    collectionName: string,
): Promise<void> {
    try {
        // Use Chroma client directly for collection deletion
        const { ChromaClient } = await import("chromadb");
        const client = new ChromaClient({
            path: process.env.CHROMA_URL,            
        });

        await client.deleteCollection({ name: collectionName });
        console.log(`Successfully deleted collection: ${collectionName}`);
    } catch (error) {
        console.error(`Error deleting collection ${collectionName}:`, error);
        throw error;
    }
}

