export interface ChatMessage {
    messageId: string,
    participantId: string;
    text: string;
    aiQueryContext: string
    mediaUri?: string;
    fileName?: string;
    fileSize?: string;
    type: MessageType;
    timestamp: number;
    editTimestamp?: number;

}
export interface ChatMessageSchema extends ChatMessage{
    roomName: string,
    expiresAt: Date
}

export enum MessageType {
    Text = "text",
    Image = "image",
    Video = "video",
    File = "file",
}
