# AI Services Quick Start Guide

A quick reference for getting started with the AI Services in livemargs-mgm.

## 🚀 Quick Setup

### 1. Environment Configuration

```bash
# Copy and configure your .env file
AI_SERVICE_TYPE=openai

# For OpenAI
OPENAI_SECRET_KEY=your_api_key_here
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-large

# For Ollama (alternative)
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text

# Vector Database
CHROMA_URL=http://localhost:8000
CHROMA_DEFAULT_TOPIC=general
```

### 2. Basic Usage

```typescript
import { AIFactory } from './ai/ai-factory.js';

// Create AI service (uses AI_SERVICE_TYPE from .env)
const aiService = AIFactory.createAIService();

// Simple chat
const response = await aiService.generateResponse("Hello, how are you?");
console.log(response);
```

## 📋 Common Tasks

### Chat Completion
```typescript
const response = await aiService.generateResponse("Explain quantum computing");
```

### Streaming Response
```typescript
for await (const chunk of aiService.generateStreamResponse("Write a story")) {
  process.stdout.write(chunk);
}
```

### Create Embeddings
```typescript
const embedding = await aiService.createSingleEmbedding("Text to embed");
```

### RAG with Vector Search
```typescript
import { getChromaManagerByServiceType, AIServiceType } from './db/chroma-mgm.js';
import { Document } from "@langchain/core/documents";

// Setup vector database
const chromaManager = await getChromaManagerByServiceType(
  AIServiceType.OPENAI,
  'robot'  // topic
);

// Add documents
const docs = [new Document({ pageContent: "Robot maintenance guide..." })];
await chromaManager.addDocuments(docs);

// Search and generate response
const similarDocs = await chromaManager.similaritySearch("How to maintain robots?");
const ragResponse = await aiService.generateRAGResponse(
  "How do I maintain my robot?",
  similarDocs
);
```

## 🔧 Service Types

| Service | Use Case | Setup Required |
|---------|----------|----------------|
| OpenAI | Production, high quality | API key |
| Ollama | Local, privacy, offline | Local server |

## 📊 Model Specifications

### OpenAI Models
- **Chat**: gpt-4, gpt-3.5-turbo
- **Embeddings**: text-embedding-3-large (3072D), text-embedding-3-small (1536D)

### Ollama Models  
- **Chat**: llama3.2, mistral, codellama
- **Embeddings**: nomic-embed-text (768D), all-MiniLM-L6-v2 (384D)

## 🎯 Collection Naming

Collections are automatically named: `{topic}-{service}-{model}`

Examples:
- `robot-openai-text-embedding-3-large`
- `medical-ollama-nomic-embed-text`

## ⚡ Performance Tips

1. **Use Streaming** for long responses
2. **Batch Embeddings** for multiple texts
3. **Topic Separation** for better organization
4. **Check Availability** before using services

## 🐛 Quick Troubleshooting

| Problem | Solution |
|---------|----------|
| Service not available | Check API keys and environment variables |
| Ollama connection failed | Ensure Ollama server is running on correct port |
| Dimension mismatch | Use consistent embedding models per collection |
| Rate limiting | Implement retry logic with exponential backoff |

## 📚 Full Documentation

For detailed documentation, examples, and advanced usage, see [AI_SERVICES_GUIDE.md](./AI_SERVICES_GUIDE.md).
