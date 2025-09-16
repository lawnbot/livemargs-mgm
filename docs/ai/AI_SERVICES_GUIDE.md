# AI Services Guide

This guide explains how to use the AI Services architecture in the livemargs-mgm platform. The system supports multiple AI providers (OpenAI and Ollama) with a unified interface and factory pattern.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Supported AI Services](#supported-ai-services)
3. [Configuration](#configuration)
4. [Usage Examples](#usage-examples)
5. [Vector Database Integration](#vector-database-integration)
6. [Best Practices](#best-practices)
7. [Error Handling](#error-handling)
8. [Troubleshooting](#troubleshooting)

## Architecture Overview

The AI Services architecture follows these design patterns:

- **Factory Pattern**: `AIFactory` creates appropriate service instances
- **Interface Segregation**: All services implement `IAIService` interface
- **Base Class Abstraction**: `BaseAIService` eliminates code duplication
- **Singleton Pattern**: ChromaManager instances are cached per service type

### Key Components

```
src/ai/
├── ai-interface.ts      # IAIService interface definition
├── ai-factory.ts        # Factory for creating AI service instances
├── base-ai-service.ts   # Abstract base class with shared implementations
├── open-ai.ts          # OpenAI service implementation
└── ollama.ts           # Ollama service implementation
```

## Supported AI Services

### OpenAI
- **Models**: GPT-4, GPT-3.5-turbo, and custom models
- **Embeddings**: text-embedding-3-large (3072 dimensions), text-embedding-3-small (1536 dimensions)
- **Features**: Chat completion, streaming, RAG, embeddings

### Ollama
- **Models**: Llama 3.2, Mistral, and other locally hosted models
- **Embeddings**: nomic-embed-text (768 dimensions), all-MiniLM-L6-v2 (384 dimensions)
- **Features**: Local inference, chat completion, streaming, RAG, embeddings

## Configuration

### Environment Variables

Create a `.env` file in your project root with the following variables:

```bash
# AI Service Selection
AI_SERVICE_TYPE=openai  # or 'ollama'

# OpenAI Configuration
OPENAI_SECRET_KEY=your_openai_api_key
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-3-large
OPENAI_TEMPERATURE=0
OPENAI_MAX_TOKENS=4000

# Ollama Configuration
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.2
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
OLLAMA_TEMPERATURE=0

# Chroma Vector Database
CHROMA_URL=http://localhost:8000
CHROMA_DEFAULT_TOPIC=general
```

### Model Compatibility

| Service | Chat Models | Embedding Models | Dimensions |
|---------|-------------|------------------|------------|
| OpenAI | gpt-4, gpt-3.5-turbo | text-embedding-3-large | 3072 |
| OpenAI | gpt-4, gpt-3.5-turbo | text-embedding-3-small | 1536 |
| Ollama | llama3.2, mistral | nomic-embed-text | 768 |
| Ollama | llama3.2, mistral | all-MiniLM-L6-v2 | 384 |

## Usage Examples

### Basic Service Creation

```typescript
import { AIFactory } from './ai/ai-factory.js';
import { AIServiceType } from './ai/ai-interface.js';

// Create service based on environment variable
const aiService = AIFactory.createAIService();

// Create specific service
const openaiService = AIFactory.createSpecificAIService(AIServiceType.OPENAI);
const ollamaService = AIFactory.createSpecificAIService(AIServiceType.OLLAMA);
```

### Chat Completion

```typescript
// Simple chat completion
const response = await aiService.generateResponse("What is artificial intelligence?");
console.log(response);

// Chat with context
const contextualResponse = await aiService.generateResponse(
  "How does this relate to machine learning?",
  "Previous context about AI definitions..."
);
```

### Streaming Responses

```typescript
// Streaming chat completion
const prompt = "Explain quantum computing in simple terms";

for await (const chunk of aiService.generateStreamResponse(prompt)) {
  process.stdout.write(chunk);
}
```

### RAG (Retrieval Augmented Generation)

```typescript
import { Document } from "@langchain/core/documents";

// Prepare documents for RAG
const documents = [
  new Document({
    pageContent: "Quantum computers use quantum bits (qubits) instead of classical bits.",
    metadata: { source: "quantum_basics.pdf" }
  }),
  new Document({
    pageContent: "Superposition allows qubits to exist in multiple states simultaneously.",
    metadata: { source: "quantum_principles.pdf" }
  })
];

// Generate RAG response
const ragResponse = await aiService.generateRAGResponse(
  "How do quantum computers differ from classical computers?",
  documents
);
```

### Embeddings

```typescript
// Create embeddings for multiple texts
const texts = [
  "Machine learning is a subset of artificial intelligence",
  "Deep learning uses neural networks with multiple layers",
  "Natural language processing deals with text understanding"
];

const embeddings = await aiService.createEmbeddings(texts);
console.log(`Created ${embeddings.length} embeddings`);

// Create single embedding
const singleEmbedding = await aiService.createSingleEmbedding(
  "This is a single text to embed"
);
console.log(`Embedding dimensions: ${singleEmbedding.length}`);
```

### Service Information

```typescript
// Check service availability
const isAvailable = await aiService.isAvailable();
console.log(`Service available: ${isAvailable}`);

// Get service details
console.log(`Service name: ${aiService.getServiceName()}`);
console.log(`LLM instance:`, aiService.getLLM());
console.log(`Embeddings instance:`, aiService.getEmbeddings());
```

## Vector Database Integration

The system integrates with ChromaDB for vector storage, with automatic collection management based on AI service type and topic.

### Collection Naming Convention

Collections are automatically named using the pattern: `{topic}-{service}-{model}`

Examples:
- `robot-openai-text-embedding-3-large`
- `medical-ollama-nomic-embed-text`
- `general-openai-text-embedding-3-small`

### ChromaManager Usage

```typescript
import { getChromaManagerByServiceType, AIServiceType } from './db/chroma-mgm.js';

// Get Chroma manager for specific service and topic
const chromaManager = await getChromaManagerByServiceType(
  AIServiceType.OPENAI,
  'robot',  // topic
  'text-embedding-3-large'  // optional: specific embedding model
);

// Add documents to vector store
await chromaManager.addDocuments(documents);

// Search similar documents
const similarDocs = await chromaManager.similaritySearch(
  "robot maintenance procedures",
  5  // number of results
);

// Search with similarity scores
const docsWithScores = await chromaManager.similaritySearchWithScore(
  "troubleshooting robotic systems",
  5
);
```

### Topic-Based Collections

```typescript
// Different topics create separate collections
const robotManager = await getChromaManagerByServiceType(AIServiceType.OPENAI, 'robot');
const medicalManager = await getChromaManagerByServiceType(AIServiceType.OPENAI, 'medical');
const generalManager = await getChromaManagerByServiceType(AIServiceType.OPENAI, 'general');

// Each manager handles its own collection
await robotManager.addDocuments(robotDocuments);
await medicalManager.addDocuments(medicalDocuments);
```

### Collection Information

```typescript
// Get collection details
const collectionInfo = chromaManager.getCollectionInfo();
console.log(`Collection: ${collectionInfo.name}`);
console.log(`Service: ${collectionInfo.aiServiceType}`);
console.log(`Model: ${collectionInfo.embeddingModel}`);
console.log(`Dimensions: ${collectionInfo.dimensions}`);
```

## Best Practices

### 1. Service Selection

```typescript
// Check availability before using
const aiService = AIFactory.createAIService();
if (await aiService.isAvailable()) {
  const response = await aiService.generateResponse(prompt);
} else {
  // Fallback to alternative service
  const fallbackService = AIFactory.createSpecificAIService(AIServiceType.OLLAMA);
  if (await fallbackService.isAvailable()) {
    const response = await fallbackService.generateResponse(prompt);
  }
}
```

### 2. Error Handling

```typescript
try {
  const response = await aiService.generateResponse(prompt);
  return response;
} catch (error) {
  console.error(`AI service error: ${error.message}`);
  // Handle specific error types
  if (error.message.includes('API key')) {
    throw new Error('Invalid API configuration');
  }
  throw error;
}
```

### 3. Embedding Compatibility

```typescript
// Ensure consistent embedding model for each collection
const chromaManager = await getChromaManagerByServiceType(
  AIServiceType.OPENAI,
  'robot',
  'text-embedding-3-large'  // Always specify for consistency
);
```

### 4. Resource Management

```typescript
// Use streaming for long responses
if (prompt.length > 1000 || expectedResponseLength > 2000) {
  for await (const chunk of aiService.generateStreamResponse(prompt)) {
    // Process chunks as they arrive
    processChunk(chunk);
  }
} else {
  const response = await aiService.generateResponse(prompt);
}
```

### 5. Topic Organization

```typescript
// Organize collections by logical topics
const topics = {
  robotics: 'robot',
  healthcare: 'medical',
  general: 'general',
  legal: 'legal',
  technical: 'tech'
};

const roboticsManager = await getChromaManagerByServiceType(
  AIServiceType.OPENAI,
  topics.robotics
);
```

## Error Handling

### Common Error Types

1. **Configuration Errors**
   ```typescript
   // Missing API keys
   Error: OpenAI response generation failed: Invalid API key
   
   // Wrong base URL for Ollama
   Error: Ollama service not available: fetch failed
   ```

2. **Model Errors**
   ```typescript
   // Model not found
   Error: The model 'gpt-5' does not exist
   
   // Embedding dimension mismatch
   Error: Vector dimensions don't match collection
   ```

3. **Rate Limiting**
   ```typescript
   // OpenAI rate limits
   Error: Rate limit exceeded. Please try again later.
   ```

### Error Recovery

```typescript
async function robustAICall(prompt: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const aiService = AIFactory.createAIService();
      return await aiService.generateResponse(prompt);
    } catch (error) {
      console.warn(`Attempt ${attempt} failed: ${error.message}`);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Wait before retry (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
    }
  }
}
```

## Troubleshooting

### 1. Service Not Available

**Problem**: `isAvailable()` returns `false`

**Solutions**:
- Check environment variables (API keys, URLs)
- Verify Ollama server is running (for Ollama service)
- Test network connectivity
- Check API key permissions

### 2. Embedding Dimension Mismatch

**Problem**: Vector store errors about dimension mismatch

**Solutions**:
- Use consistent embedding models within the same collection
- Create separate collections for different embedding models
- Check the model configuration

### 3. Collection Not Found

**Problem**: ChromaDB collection errors

**Solutions**:
- Ensure ChromaDB is running
- Check collection naming convention
- Initialize ChromaManager properly

### 4. Memory Issues with Large Documents

**Problem**: Out of memory errors with large document sets

**Solutions**:
- Process documents in batches
- Use streaming for large responses
- Implement pagination for similarity searches

### 5. Slow Response Times

**Problem**: Long wait times for AI responses

**Solutions**:
- Use streaming responses for immediate feedback
- Implement caching for frequently requested content
- Consider using smaller, faster models for simple tasks
- Optimize prompt length

## API Reference

### IAIService Interface

```typescript
interface IAIService {
  generateResponse(prompt: string, context?: string): Promise<string>;
  generateStreamResponse(prompt: string, context?: string): AsyncIterableIterator<string>;
  generateRAGResponse(query: string, documents: Document[]): Promise<string>;
  createEmbeddings(texts: string[]): Promise<number[][]>;
  createSingleEmbedding(text: string): Promise<number[]>;
  getLLM(): BaseLanguageModel;
  getEmbeddings(): Embeddings;
  getServiceName(): string;
  isAvailable(): Promise<boolean>;
}
```

### AIFactory Methods

```typescript
class AIFactory {
  static createAIService(): IAIService;
  static createSpecificAIService(serviceType: AIServiceType): IAIService;
}
```

### ChromaManager Methods

```typescript
class ChromaManager {
  static getInstance(config: ChromaConfig): ChromaManager;
  initialize(): Promise<void>;
  addDocuments(documents: Document[]): Promise<void>;
  similaritySearch(query: string, k?: number, filter?: Record<string, any>): Promise<Document[]>;
  similaritySearchWithScore(query: string, k?: number, filter?: Record<string, any>): Promise<[Document, number][]>;
  deleteCollection(): Promise<void>;
  getCollectionInfo(): CollectionInfo;
  getVectorStore(): Chroma | null;
  getEmbeddings(): Embeddings;
}
```

This documentation provides a comprehensive guide for using the AI Services architecture. For additional support or questions, refer to the source code or contact the development team.
