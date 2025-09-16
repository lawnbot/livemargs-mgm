
import { ChatOpenAI, OpenAIEmbeddings } from "@langchain/openai";
import { BaseAIService } from './base-ai-service.js';

export class OpenAIAIService extends BaseAIService {
    protected llm: ChatOpenAI;
    protected embeddings: OpenAIEmbeddings;
    protected serviceName = "OpenAI";

    constructor() {
        super();
        
        this.llm = new ChatOpenAI({
            openAIApiKey: process.env.OPENAI_SECRET_KEY,
            model: process.env.OPENAI_MODEL || "gpt-4",
            temperature: Number(process.env.OPENAI_TEMPERATURE) || 0,
            maxTokens: Number(process.env.OPENAI_MAX_TOKENS) || 4000,
        });

        this.embeddings = new OpenAIEmbeddings({
            model: process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-large",
            apiKey: process.env.OPENAI_SECRET_KEY,
        });
    }

    async isAvailable(): Promise<boolean> {
        try {
            if (!process.env.OPENAI_SECRET_KEY) {
                return false;
            }
            
            // Test with a simple prompt
            await this.llm.invoke("Test connection");
            return true;
        } catch (error) {
            console.warn("OpenAI service not available:", error);
            return false;
        }
    }
}