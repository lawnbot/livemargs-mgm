# AI Services API Reference

Complete API reference for the AI Services architecture.

## Interfaces

### IAIService

Main interface implemented by all AI service providers.

```typescript
interface IAIService {
  // Chat and completion methods
  generateResponse(prompt: string, context?: string): Promise<string>;
  generateStreamResponse(prompt: string, context?: string): AsyncIterableIterator<string>;
  
  // RAG (Retrieval Augmented Generation)
  generateRAGResponse(query: string, documents: Document[]): Promise<string>;
  
  // Embedding methods
  createEmbeddings(texts: string[]): Promise<number[][]>;
  createSingleEmbedding(text: string): Promise<number[]>;
  
  // Model access
  getLLM(): BaseLanguageModel;
  getEmbeddings(): Embeddings;
  
  // Service information
  getServiceName(): string;
  isAvailable(): Promise<boolean>;
}
```

#### Methods

##### `generateResponse(prompt: string, context?: string): Promise<string>`
Generates a single response from the AI model.

**Parameters:**
- `prompt` - The input prompt/question
- `context` - Optional context to include with the prompt

**Returns:** Promise resolving to the AI response as a string

**Example:**
```typescript
const response = await aiService.generateResponse(
  "What is machine learning?",
  "Previous discussion about AI fundamentals..."
);
```

##### `generateStreamResponse(prompt: string, context?: string): AsyncIterableIterator<string>`
Generates a streaming response from the AI model.

**Parameters:**
- `prompt` - The input prompt/question  
- `context` - Optional context to include with the prompt

**Returns:** AsyncIterableIterator yielding response chunks as strings

**Example:**
```typescript
for await (const chunk of aiService.generateStreamResponse("Explain quantum physics")) {
  process.stdout.write(chunk);
}
```

##### `generateRAGResponse(query: string, documents: Document[]): Promise<string>`
Generates a response based on provided documents (RAG pattern).

**Parameters:**
- `query` - The question to answer
- `documents` - Array of Document objects containing relevant context

**Returns:** Promise resolving to the AI response based on the documents

**Example:**
```typescript
const docs = [
  new Document({ pageContent: "Quantum computers use qubits..." }),
  new Document({ pageContent: "Superposition allows multiple states..." })
];

const response = await aiService.generateRAGResponse(
  "How do quantum computers work?",
  docs
);
```

##### `createEmbeddings(texts: string[]): Promise<number[][]>`
Creates embeddings for multiple text inputs.

**Parameters:**
- `texts` - Array of strings to embed

**Returns:** Promise resolving to array of embedding vectors

**Example:**
```typescript
const embeddings = await aiService.createEmbeddings([
  "First text to embed",
  "Second text to embed"
]);
```

##### `createSingleEmbedding(text: string): Promise<number[]>`
Creates an embedding for a single text input.

**Parameters:**
- `text` - String to embed

**Returns:** Promise resolving to embedding vector

**Example:**
```typescript
const embedding = await aiService.createSingleEmbedding("Text to embed");
```

##### `getLLM(): BaseLanguageModel`
Returns the underlying language model instance.

**Returns:** BaseLanguageModel instance

##### `getEmbeddings(): Embeddings`
Returns the underlying embeddings model instance.

**Returns:** Embeddings instance

##### `getServiceName(): string`
Returns the name of the AI service.

**Returns:** Service name ("OpenAI" or "Ollama")

##### `isAvailable(): Promise<boolean>`
Checks if the AI service is available and properly configured.

**Returns:** Promise resolving to boolean availability status

### AIServiceConfig

Configuration interface for AI services.

```typescript
interface AIServiceConfig {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  embeddingModel?: string;
  temperature?: number;
  maxTokens?: number;
}
```

### AIServiceType

Enumeration of supported AI service types.

```typescript
enum AIServiceType {
  OPENAI = 'openai',
  OLLAMA = 'ollama'
}
```

## Classes

### AIFactory

Factory class for creating AI service instances.

```typescript
class AIFactory {
  static createAIService(): IAIService;
  static createSpecificAIService(serviceType: AIServiceType): IAIService;
}
```

#### Methods

##### `static createAIService(): IAIService`
Creates an AI service instance based on the `AI_SERVICE_TYPE` environment variable.

**Returns:** IAIService instance

**Throws:** Error if the service type is unsupported or not configured

##### `static createSpecificAIService(serviceType: AIServiceType): IAIService`
Creates a specific AI service instance.

**Parameters:**
- `serviceType` - The type of AI service to create

**Returns:** IAIService instance

**Throws:** Error if the service type is unsupported

### BaseAIService

Abstract base class providing common implementations for AI services.

```typescript
abstract class BaseAIService implements IAIService {
  protected abstract llm: BaseLanguageModel;
  protected abstract embeddings: Embeddings;
  protected abstract serviceName: string;
  
  abstract isAvailable(): Promise<boolean>;
  
  // Common implementations provided...
}
```

### OpenAIAIService

OpenAI service implementation.

```typescript
class OpenAIAIService extends BaseAIService {
  constructor();
  isAvailable(): Promise<boolean>;
}
```

#### Configuration Environment Variables
- `OPENAI_SECRET_KEY` - OpenAI API key (required)
- `OPENAI_MODEL` - Model name (default: "gpt-4")
- `OPENAI_EMBEDDING_MODEL` - Embedding model (default: "text-embedding-3-large")
- `OPENAI_TEMPERATURE` - Temperature setting (default: 0)
- `OPENAI_MAX_TOKENS` - Maximum tokens (default: 4000)

### OllamaAiService

Ollama service implementation.

```typescript
class OllamaAiService extends BaseAIService {
  constructor();
  isAvailable(): Promise<boolean>;
}
```

#### Configuration Environment Variables
- `OLLAMA_BASE_URL` - Ollama server URL (default: "http://localhost:11434")
- `OLLAMA_MODEL` - Model name (default: "llama3.2")
- `OLLAMA_EMBEDDING_MODEL` - Embedding model (default: "nomic-embed-text")
- `OLLAMA_TEMPERATURE` - Temperature setting (default: 0)

## ChromaDB Integration

### ChromaConfig

Configuration interface for ChromaDB.

```typescript
interface ChromaConfig {
  url?: string;
  path?: string;
  aiServiceType: AIServiceType;
  embeddingModel?: string;
  topic?: string;
}
```

### ChromaManager

Manager class for ChromaDB vector store operations.

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

#### Methods

##### `static getInstance(config: ChromaConfig): ChromaManager`
Gets or creates a ChromaManager instance for the specified configuration.

**Parameters:**
- `config` - ChromaDB configuration

**Returns:** ChromaManager instance

##### `initialize(): Promise<void>`
Initializes the vector store connection.

**Throws:** Error if initialization fails

##### `addDocuments(documents: Document[]): Promise<void>`
Adds documents to the vector store.

**Parameters:**
- `documents` - Array of Document objects to add

**Throws:** Error if operation fails

##### `similaritySearch(query: string, k?: number, filter?: Record<string, any>): Promise<Document[]>`
Searches for similar documents.

**Parameters:**
- `query` - Search query
- `k` - Number of results to return (default: 4)
- `filter` - Optional metadata filter

**Returns:** Promise resolving to array of similar documents

##### `similaritySearchWithScore(query: string, k?: number, filter?: Record<string, any>): Promise<[Document, number][]>`
Searches for similar documents with similarity scores.

**Parameters:**
- `query` - Search query
- `k` - Number of results to return (default: 5)
- `filter` - Optional metadata filter

**Returns:** Promise resolving to array of [Document, score] tuples

##### `deleteCollection(): Promise<void>`
Deletes the entire collection.

**Throws:** Error if operation fails

##### `getCollectionInfo(): CollectionInfo`
Returns information about the collection.

**Returns:** CollectionInfo object

```typescript
interface CollectionInfo {
  name: string;
  aiServiceType: AIServiceType;
  embeddingModel: string;
  dimensions: number;
}
```

### Convenience Functions

#### `getChromaManagerByServiceType(aiServiceType: AIServiceType, topic?: string, embeddingModel?: string): Promise<ChromaManager>`
Creates and initializes a ChromaManager for the specified service type.

#### `getOpenAIChromaManager(topic?: string, embeddingModel?: string): Promise<ChromaManager>`
Creates and initializes a ChromaManager for OpenAI service.

#### `getOllamaChromaManager(topic?: string, embeddingModel?: string): Promise<ChromaManager>`
Creates and initializes a ChromaManager for Ollama service.

## Error Types

### Common Errors

```typescript
// Configuration errors
"OpenAI response generation failed: Invalid API key"
"Ollama service not available: fetch failed"

// Model errors  
"The model 'invalid-model' does not exist"
"Vector dimensions don't match collection"

// Rate limiting
"Rate limit exceeded. Please try again later."

// Network errors
"Connection timeout"
"Service unavailable"
```

## Environment Variables Reference

### Required Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `AI_SERVICE_TYPE` | All | Service type to use ("openai" or "ollama") |
| `OPENAI_SECRET_KEY` | OpenAI | OpenAI API key |

### Optional Variables

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `OPENAI_MODEL` | OpenAI | "gpt-4" | OpenAI chat model |
| `OPENAI_EMBEDDING_MODEL` | OpenAI | "text-embedding-3-large" | OpenAI embedding model |
| `OPENAI_TEMPERATURE` | OpenAI | 0 | Response randomness (0-1) |
| `OPENAI_MAX_TOKENS` | OpenAI | 4000 | Maximum response tokens |
| `OLLAMA_BASE_URL` | Ollama | "http://localhost:11434" | Ollama server URL |
| `OLLAMA_MODEL` | Ollama | "llama3.2" | Ollama chat model |
| `OLLAMA_EMBEDDING_MODEL` | Ollama | "nomic-embed-text" | Ollama embedding model |
| `OLLAMA_TEMPERATURE` | Ollama | 0 | Response randomness (0-1) |
| `CHROMA_URL` | ChromaDB | - | ChromaDB server URL |
| `CHROMA_DB` | ChromaDB | - | ChromaDB database path |
| `CHROMA_DEFAULT_TOPIC` | ChromaDB | "general" | Default topic for collections |

## Usage Patterns

### Error Handling Pattern

```typescript
try {
  const aiService = AIFactory.createAIService();
  
  if (!(await aiService.isAvailable())) {
    throw new Error('AI service not available');
  }
  
  const response = await aiService.generateResponse(prompt);
  return response;
  
} catch (error) {
  console.error('AI service error:', error.message);
  
  if (error.message.includes('API key')) {
    // Handle authentication error
  } else if (error.message.includes('rate limit')) {
    // Handle rate limiting
  }
  
  throw error;
}
```

### Service Fallback Pattern

```typescript
async function robustAICall(prompt: string): Promise<string> {
  const serviceTypes = [AIServiceType.OPENAI, AIServiceType.OLLAMA];
  
  for (const serviceType of serviceTypes) {
    try {
      const service = AIFactory.createSpecificAIService(serviceType);
      
      if (await service.isAvailable()) {
        return await service.generateResponse(prompt);
      }
    } catch (error) {
      console.warn(`${serviceType} failed: ${error.message}`);
    }
  }
  
  throw new Error('No AI services available');
}
```

### RAG Implementation Pattern

```typescript
async function ragQuery(query: string, topic: string): Promise<string> {
  // Get AI service
  const aiService = AIFactory.createAIService();
  
  // Get vector store for topic
  const chromaManager = await getChromaManagerByServiceType(
    AIServiceType.OPENAI,
    topic
  );
  
  // Search for relevant documents
  const documents = await chromaManager.similaritySearch(query, 5);
  
  if (documents.length === 0) {
    return "No relevant information found.";
  }
  
  // Generate RAG response
  return await aiService.generateRAGResponse(query, documents);
}
```
