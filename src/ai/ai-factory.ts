import { IAIService, AIServiceType } from './ai-interface.js';
import { OpenAIAIService } from './open-ai.js';
import { OllamaAiService } from './ollama.js';

export type AIService = OpenAIAIService | OllamaAiService;

export class AIServiceFactory {
    static createAIService(): IAIService {
        const aiServiceType = process.env.AI_SERVICE_TYPE || "openai";
        
        switch (aiServiceType.toLowerCase()) {
            case "ollama":
                console.log("Start Ollama AI Service");
                return new OllamaAiService();
            case "openai":
            case "gpt":
            default:
                console.log("Start OpenAI Service");
                return new OpenAIAIService();
        }
    }

    static createSpecificAIService(serviceType: AIServiceType): IAIService {
        switch (serviceType) {
            case AIServiceType.OPENAI:
                console.log("Start OpenAI Service");
                return new OpenAIAIService();
            case AIServiceType.OLLAMA:
                console.log("Start Ollama AI Service");
                return new OllamaAiService();
            default:
                throw new Error(`Unsupported AI service type: ${serviceType}`);
        }
    }
}