import { Ollama } from "@langchain/ollama";
import { OllamaEmbeddings } from "@langchain/ollama";
import { BaseAIService } from './base-ai-service.js';

export class OllamaAiService extends BaseAIService {
    protected llm: Ollama;
    protected embeddings: OllamaEmbeddings;
    protected serviceName = "Ollama";

    constructor() {
        super();
        
        const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
        
        this.llm = new Ollama({
            baseUrl: baseUrl,
            model: process.env.OLLAMA_MODEL || "phi4",
            temperature: Number(process.env.OLLAMA_TEMPERATURE) || 0,
        });

        this.embeddings = new OllamaEmbeddings({
            baseUrl: baseUrl,
            model: process.env.OLLAMA_EMBEDDING_MODEL || "nomic-embed-text",
        });
    }

    async isAvailable(): Promise<boolean> {
        try {
            const baseUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
            
            // Check if Ollama server is running
            const response = await fetch(`${baseUrl}/api/version`);
            if (!response.ok) {
                return false;
            }

            // Test with a simple prompt
            await this.llm.invoke("Test connection");
            return true;
        } catch (error) {
            console.warn("Ollama service not available:", error);
            return false;
        }
    }
}
