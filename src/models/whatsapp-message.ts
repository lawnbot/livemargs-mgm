export interface WhatsAppMessage {
    messageId: string;
    whatsappMessageId: string; // WhatsApp's own message ID
    phoneNumber: string; // Customer's phone number
    roomName: string; // LiveKit room associated with this chat
    text?: string;
    mediaUrl?: string;
    mediaType?: WhatsAppMediaType;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    caption?: string;
    direction: MessageDirection; // incoming or outgoing
    status: MessageStatus;
    timestamp: number;
    deliveredAt?: number;
    readAt?: number;
    failedReason?: string;
}

export enum WhatsAppMediaType {
    Text = "text",
    Image = "image",
    Video = "video",
    Audio = "audio",
    Document = "document",
    Sticker = "sticker",
    Voice = "voice",
    Location = "location",
    Contacts = "contacts",
}

export enum MessageDirection {
    Incoming = "incoming",
    Outgoing = "outgoing",
}

export enum MessageStatus {
    Sent = "sent",
    Delivered = "delivered",
    Read = "read",
    Failed = "failed",
    Pending = "pending",
}

export interface WhatsAppMessageSchema extends WhatsAppMessage {
    expiresAt: Date;
}

// WhatsApp webhook payload interfaces
export interface WhatsAppWebhookPayload {
    object: string;
    entry: WhatsAppWebhookEntry[];
}

export interface WhatsAppWebhookEntry {
    id: string;
    changes: WhatsAppWebhookChange[];
}

export interface WhatsAppWebhookChange {
    value: WhatsAppWebhookValue;
    field: string;
}

export interface WhatsAppWebhookValue {
    messaging_product: string;
    metadata: WhatsAppMetadata;
    contacts?: WhatsAppContact[];
    messages?: WhatsAppIncomingMessage[];
    statuses?: WhatsAppStatus[];
}

export interface WhatsAppMetadata {
    display_phone_number: string;
    phone_number_id: string;
}

export interface WhatsAppContact {
    profile: {
        name: string;
    };
    wa_id: string;
}

export interface WhatsAppIncomingMessage {
    from: string;
    id: string;
    timestamp: string;
    type: string;
    text?: {
        body: string;
    };
    image?: WhatsAppMedia;
    video?: WhatsAppMedia;
    audio?: WhatsAppMedia;
    document?: WhatsAppMedia;
    voice?: WhatsAppMedia;
    sticker?: WhatsAppMedia;
    location?: {
        latitude: number;
        longitude: number;
        name?: string;
        address?: string;
    };
    contacts?: any[];
}

export interface WhatsAppMedia {
    id: string;
    mime_type: string;
    sha256: string;
    caption?: string;
    filename?: string;
}

export interface WhatsAppStatus {
    id: string;
    status: string;
    timestamp: string;
    recipient_id: string;
    conversation?: {
        id: string;
        origin: {
            type: string;
        };
    };
    pricing?: {
        billable: boolean;
        pricing_model: string;
        category: string;
    };
}

// Outgoing message interfaces
export interface WhatsAppOutgoingMessage {
    messaging_product: string;
    recipient_type: string;
    to: string;
    type: string;
    text?: {
        preview_url?: boolean;
        body: string;
    };
    image?: {
        link?: string;
        id?: string;
        caption?: string;
    };
    video?: {
        link?: string;
        id?: string;
        caption?: string;
    };
    audio?: {
        link?: string;
        id?: string;
    };
    document?: {
        link?: string;
        id?: string;
        caption?: string;
        filename?: string;
    };
}

export namespace WhatsAppMessage {
    export function sanitize(obj: any): WhatsAppMessage {
        return {
            messageId: String(obj.messageId),
            whatsappMessageId: String(obj.whatsappMessageId),
            phoneNumber: String(obj.phoneNumber),
            roomName: String(obj.roomName),
            text: obj.text ? String(obj.text) : undefined,
            mediaUrl: obj.mediaUrl ? String(obj.mediaUrl) : undefined,
            mediaType: obj.mediaType as WhatsAppMediaType,
            fileName: obj.fileName ? String(obj.fileName) : undefined,
            fileSize: obj.fileSize ? Number(obj.fileSize) : undefined,
            mimeType: obj.mimeType ? String(obj.mimeType) : undefined,
            caption: obj.caption ? String(obj.caption) : undefined,
            direction: obj.direction as MessageDirection,
            status: obj.status as MessageStatus,
            timestamp: Number(obj.timestamp),
            deliveredAt: obj.deliveredAt ? Number(obj.deliveredAt) : undefined,
            readAt: obj.readAt ? Number(obj.readAt) : undefined,
            failedReason: obj.failedReason ? String(obj.failedReason) : undefined,
        };
    }

    export function isValid(obj: any): obj is WhatsAppMessage {
        return obj &&
            typeof obj.messageId === "string" &&
            typeof obj.whatsappMessageId === "string" &&
            typeof obj.phoneNumber === "string" &&
            typeof obj.roomName === "string" &&
            typeof obj.direction === "string" &&
            typeof obj.status === "string" &&
            typeof obj.timestamp === "number";
    }
}
