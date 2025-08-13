export interface ChatMessage {
    messageId: string;
    participantId: string;
    text: string;
    aiQueryContext: string;
    mediaUri?: string;
    fileName?: string;
    fileSize?: number;
    type: MessageType;
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