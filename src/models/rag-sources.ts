export interface RagSources {
    metadataType: "rag-sources";
    sources: RagSource[];
    query: string;
    collectionName: string;
}


export interface RagSource {
    id: number;
    filename: string;
    page?: number;
    collection: string;
    relevanceScore: number;
    preview: string;
    wordCount: number;
    fileType: string;
    chunkId?: number;
}