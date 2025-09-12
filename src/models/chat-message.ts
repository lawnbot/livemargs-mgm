import { RagSources } from "./rag-sources.js";

export interface ChatMessage {
    messageId: string;
    participantId: string;
    text: string;
    aiQueryContext: string;
    mediaUri?: string;
    fileName?: string;
    fileSize?: number;
    type: MessageType;
    ragSources?: RagSources;
    timestamp: number;
    editTimestamp?: number;
}
export interface ChatMessageSchema extends ChatMessage {
    roomName: string;
    expiresAt: Date;
}

export enum MessageType {
    Text = "text",
    Image = "image",
    Video = "video",
    File = "file",
}

// Function to map MIME types to MessageType
export function convertMimeTypeToMessageType(mimeType: string): MessageType {
    if (!mimeType) {
        return MessageType.File;
    }

    const type = mimeType.toLowerCase();

    // Text type
    if (type.startsWith('text/plain')) {
        return MessageType.Text;
    }

    // Image types
    if (type.startsWith('image/')) {
        return MessageType.Image;
    }

    // Video types
    if (type.startsWith('video/')) {
        return MessageType.Video;
    }

    // Common image formats (additional check)
    if (type.includes('jpeg') || type.includes('jpg') || type.includes('png') || 
        type.includes('gif') || type.includes('bmp') || type.includes('webp') || 
        type.includes('svg') || type.includes('tiff') || type.includes('ico')) {
        return MessageType.Image;
    }

    // Common video formats (additional check)
    if (type.includes('mp4') || type.includes('avi') || type.includes('mov') || 
        type.includes('wmv') || type.includes('flv') || type.includes('webm') || 
        type.includes('mkv') || type.includes('m4v') || type.includes('3gp')) {
        return MessageType.Video;
    }

    // Audio files are treated as files (could add Audio type if needed)
    // Document files, archives, etc. are treated as files
    return MessageType.File;
}

/* export interface ChatMessageFile {
    mediaUri?: string;
    fileName?: string;
    fileSize?: number;
}
 */

export namespace ChatMessage {
    export function sanitize(obj: any): ChatMessage {
        return {
            messageId: String(obj.messageId),
            participantId: String(obj.participantId),
            text: String(obj.text),
            aiQueryContext: String(obj.aiQueryContext),
            mediaUri: obj.mediaUri ? String(obj.mediaUri) : undefined,
            fileName: obj.fileName ? String(obj.fileName) : undefined,
            fileSize: obj.fileSize ? Number(obj.fileSize) : undefined,
            type: obj.type as MessageType,
            timestamp: Number(obj.timestamp),
            editTimestamp: obj.editTimestamp ? Number(obj.editTimestamp) : undefined,
            ragSources: obj.ragSources ? sanitizeRagSources(obj.ragSources) : undefined,
        };
    }

    export function isValid(obj: any): obj is ChatMessage {
        return obj &&
               typeof obj.messageId === "string" &&
               typeof obj.participantId === "string" &&
               typeof obj.text === "string" &&
               typeof obj.aiQueryContext === "string" &&
               typeof obj.timestamp === "number" &&
               (obj.fileSize === undefined || typeof obj.fileSize === "number") &&
               (obj.editTimestamp === undefined || typeof obj.editTimestamp === "number");
    }

    // Updated sanitizeRagSources - only supports flat format now
    function sanitizeRagSources(ragSources: any): RagSources | undefined {
        if (!ragSources) return undefined;
        
        return {
            metadataType: "rag-sources",
            sources: (ragSources.sources || []).map((source: any) => ({
                id: Number(source.id),
                filename: String(source.filename),
                page: source.page ? Number(source.page) : undefined,
                collection: String(source.collection),
                relevanceScore: Number(source.relevanceScore),
                preview: String(source.preview),
                wordCount: Number(source.wordCount),
                fileType: String(source.fileType),
                chunkId: source.chunkId ? Number(source.chunkId) : undefined,
            })),
            query: String(ragSources.query || ''),
            collectionName: String(ragSources.collectionName || ''),
        };
    }
}