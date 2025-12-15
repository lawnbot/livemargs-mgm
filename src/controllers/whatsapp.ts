import { Request, Response, NextFunction } from "express";
import dotenv from "dotenv";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import https from "https";
import { nanoid } from "nanoid";
import {
    WhatsAppMessage,
    WhatsAppWebhookPayload,
    WhatsAppIncomingMessage,
    WhatsAppOutgoingMessage,
    MessageDirection,
    MessageStatus,
    WhatsAppMediaType,
    WhatsAppStatus,
} from "../models/whatsapp-message.js";
import { dbService } from "../server.js";
import { RoomDetails, RoomChannel, Department, RequestingHelp, TicketStatus } from "../models/room-details.js";
import { ChatMessage, MessageType } from "../models/chat-message.js";

dotenv.config();

const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || "";
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const WHATSAPP_API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";
const WHATSAPP_WEBHOOK_VERIFY_TOKEN = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || "";
const UPLOAD_BASE = path.resolve(process.env.UPLOAD_DIR || "uploads");

// Ensure WhatsApp uploads folder exists
const WHATSAPP_UPLOAD_DIR = path.join(UPLOAD_BASE, "whatsapp");
fs.mkdirSync(WHATSAPP_UPLOAD_DIR, { recursive: true });

/**
 * Webhook verification for WhatsApp Cloud API
 */
export async function verifyWebhook(req: Request, res: Response) {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
        console.log("WhatsApp webhook verified successfully");
        res.status(200).send(challenge);
    } else {
        console.error("WhatsApp webhook verification failed");
        res.sendStatus(403);
    }
}

/**
 * Handle incoming WhatsApp webhook events
 */
export async function handleWebhook(req: Request, res: Response) {
    try {
        const payload: WhatsAppWebhookPayload = req.body;

        // Acknowledge receipt immediately
        res.sendStatus(200);

        if (!payload.entry || payload.entry.length === 0) {
            return;
        }

        for (const entry of payload.entry) {
            for (const change of entry.changes) {
                const value = change.value;

                // Handle incoming messages
                if (value.messages && value.messages.length > 0) {
                    for (const message of value.messages) {
                        await handleIncomingMessage(message);
                    }
                }

                // Handle message status updates
                if (value.statuses && value.statuses.length > 0) {
                    for (const status of value.statuses) {
                        await handleMessageStatus(status);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Error handling WhatsApp webhook:", error);
        // Don't send error to WhatsApp, just log it
    }
}

/**
 * Process incoming WhatsApp message
 */
async function handleIncomingMessage(message: WhatsAppIncomingMessage) {
    try {
        const phoneNumber = message.from;
        const whatsappMessageId = message.id;
        const timestamp = parseInt(message.timestamp) * 1000; // Convert to milliseconds

        // Get or create LiveKit room for this phone number
        const roomName = await getOrCreateRoomForPhoneNumber(phoneNumber);

        let text = "";
        let mediaUrl: string | undefined;
        let mediaType: WhatsAppMediaType = WhatsAppMediaType.Text;
        let fileName: string | undefined;
        let fileSize: number | undefined;
        let mimeType: string | undefined;
        let caption: string | undefined;

        // Extract message content based on type
        switch (message.type) {
            case "text":
                text = message.text?.body || "";
                mediaType = WhatsAppMediaType.Text;
                break;

            case "image":
                if (message.image) {
                    mediaUrl = await downloadWhatsAppMedia(message.image.id, "image");
                    mediaType = WhatsAppMediaType.Image;
                    caption = message.image.caption;
                    text = caption || "";
                    mimeType = message.image.mime_type;
                }
                break;

            case "video":
                if (message.video) {
                    mediaUrl = await downloadWhatsAppMedia(message.video.id, "video");
                    mediaType = WhatsAppMediaType.Video;
                    caption = message.video.caption;
                    text = caption || "";
                    mimeType = message.video.mime_type;
                }
                break;

            case "audio":
            case "voice":
                const audioData = message.audio || message.voice;
                if (audioData) {
                    mediaUrl = await downloadWhatsAppMedia(audioData.id, message.type);
                    mediaType = message.type === "voice" ? WhatsAppMediaType.Voice : WhatsAppMediaType.Audio;
                    mimeType = audioData.mime_type;
                }
                break;

            case "document":
                if (message.document) {
                    mediaUrl = await downloadWhatsAppMedia(message.document.id, "document");
                    mediaType = WhatsAppMediaType.Document;
                    fileName = message.document.filename;
                    caption = message.document.caption;
                    text = caption || "";
                    mimeType = message.document.mime_type;
                }
                break;

            case "sticker":
                if (message.sticker) {
                    mediaUrl = await downloadWhatsAppMedia(message.sticker.id, "sticker");
                    mediaType = WhatsAppMediaType.Sticker;
                    mimeType = message.sticker.mime_type;
                }
                break;

            default:
                console.log(`Unsupported message type: ${message.type}`);
                return;
        }

        // Create WhatsApp message record
        const whatsappMessage: WhatsAppMessage = {
            messageId: nanoid(),
            whatsappMessageId,
            phoneNumber,
            roomName,
            text,
            mediaUrl,
            mediaType,
            fileName,
            fileSize,
            mimeType,
            caption,
            direction: MessageDirection.Incoming,
            status: MessageStatus.Delivered,
            timestamp,
        };

        // Save to database
        await dbService.saveWhatsAppMessage(whatsappMessage);

        // Also save as a regular chat message for LiveKit room
        const chatMessage: ChatMessage = {
            messageId: whatsappMessage.messageId,
            participantId: `whatsapp:${phoneNumber}`,
            text: text || `[${mediaType}]`,
            aiQueryContext: "",
            mediaUri: mediaUrl,
            fileName,
            fileSize,
            type: convertWhatsAppMediaTypeToChatMessageType(mediaType),
            timestamp,
        };

        await dbService.saveChatMessage(roomName, chatMessage);

        console.log(`Received WhatsApp message from ${phoneNumber} in room ${roomName}`);
    } catch (error) {
        console.error("Error processing incoming WhatsApp message:", error);
    }
}

/**
 * Handle WhatsApp message status updates
 */
async function handleMessageStatus(status: WhatsAppStatus) {
    try {
        const whatsappMessageId = status.id;
        const statusType = status.status;
        const timestamp = parseInt(status.timestamp) * 1000;

        let updateFields: Partial<WhatsAppMessage> = {};

        switch (statusType) {
            case "sent":
                updateFields.status = MessageStatus.Sent;
                break;
            case "delivered":
                updateFields.status = MessageStatus.Delivered;
                updateFields.deliveredAt = timestamp;
                break;
            case "read":
                updateFields.status = MessageStatus.Read;
                updateFields.readAt = timestamp;
                break;
            case "failed":
                updateFields.status = MessageStatus.Failed;
                break;
        }

        await dbService.updateWhatsAppMessageStatus(whatsappMessageId, updateFields);
        console.log(`Updated WhatsApp message ${whatsappMessageId} status to ${statusType}`);
    } catch (error) {
        console.error("Error updating WhatsApp message status:", error);
    }
}

/**
 * Send a WhatsApp message
 */
export async function sendWhatsAppMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const { phoneNumber, text, mediaUrl, mediaType, fileName, caption } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number is required" });
        }

        const roomName = await getOrCreateRoomForPhoneNumber(phoneNumber);

        // Prepare outgoing message
        const outgoingMessage: WhatsAppOutgoingMessage = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            type: mediaType || "text",
        };

        if (mediaType === "text" || !mediaType) {
            outgoingMessage.text = {
                body: text || "",
            };
        } else if (mediaType === "image") {
            outgoingMessage.type = "image";
            outgoingMessage.image = {
                link: mediaUrl,
                caption: caption || text,
            };
        } else if (mediaType === "video") {
            outgoingMessage.type = "video";
            outgoingMessage.video = {
                link: mediaUrl,
                caption: caption || text,
            };
        } else if (mediaType === "audio") {
            outgoingMessage.type = "audio";
            outgoingMessage.audio = {
                link: mediaUrl,
            };
        } else if (mediaType === "document") {
            outgoingMessage.type = "document";
            outgoingMessage.document = {
                link: mediaUrl,
                caption: caption || text,
                filename: fileName,
            };
        }

        // Send via WhatsApp API
        const apiUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${WHATSAPP_PHONE_NUMBER_ID}/messages`;
        const postData = JSON.stringify(outgoingMessage);

        const apiResponse = await new Promise<any>((resolve, reject) => {
            const options = {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(postData),
                },
            };

            const req = https.request(apiUrl, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse response'));
                        }
                    } else {
                        reject(new Error(`WhatsApp API error: ${res.statusCode} - ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(postData);
            req.end();
        });

        const whatsappMessageId = apiResponse.messages[0].id;
        const messageId = nanoid();
        const timestamp = Date.now();

        // Save to database
        const whatsappMessage: WhatsAppMessage = {
            messageId,
            whatsappMessageId,
            phoneNumber,
            roomName,
            text: text || caption,
            mediaUrl,
            mediaType: mediaType as WhatsAppMediaType,
            fileName,
            mimeType: undefined,
            caption,
            direction: MessageDirection.Outgoing,
            status: MessageStatus.Sent,
            timestamp,
        };

        await dbService.saveWhatsAppMessage(whatsappMessage);

        // Also save as chat message
        const chatMessage: ChatMessage = {
            messageId,
            participantId: "system",
            text: text || caption || `[${mediaType}]`,
            aiQueryContext: "",
            mediaUri: mediaUrl,
            fileName,
            type: convertWhatsAppMediaTypeToChatMessageType(mediaType as WhatsAppMediaType),
            timestamp,
        };

        await dbService.saveChatMessage(roomName, chatMessage);

        res.status(200).json({
            success: true,
            messageId,
            whatsappMessageId,
            roomName,
        });
    } catch (error: any) {
        console.error("Error sending WhatsApp message:", error.message || error);
        next(error);
    }
}

/**
 * Get WhatsApp messages for a phone number
 */
export async function getWhatsAppMessages(req: Request, res: Response, next: NextFunction) {
    try {
        const { phoneNumber } = req.params;

        if (!phoneNumber) {
            return res.status(400).json({ error: "Phone number is required" });
        }

        const messages = await dbService.getWhatsAppMessagesByPhoneNumber(phoneNumber);
        res.status(200).json(messages);
    } catch (error) {
        next(error);
    }
}

/**
 * Download media from WhatsApp and save locally
 */
async function downloadWhatsAppMedia(mediaId: string, mediaType: string): Promise<string> {
    try {
        // Step 1: Get media URL from WhatsApp
        const mediaInfoUrl = `https://graph.facebook.com/${WHATSAPP_API_VERSION}/${mediaId}`;
        
        const mediaInfo = await new Promise<any>((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                },
            };

            https.get(mediaInfoUrl, options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error('Failed to parse media info'));
                        }
                    } else {
                        reject(new Error(`Failed to get media info: ${res.statusCode}`));
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });

        const mediaUrl = mediaInfo.url;
        const mimeType = mediaInfo.mime_type;

        // Step 2: Download the media
        const mediaBuffer = await new Promise<Buffer>((resolve, reject) => {
            const options = {
                headers: {
                    'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
                },
            };

            https.get(mediaUrl, options, (res) => {
                const chunks: Buffer[] = [];

                res.on('data', (chunk) => {
                    chunks.push(chunk);
                });

                res.on('end', () => {
                    if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(Buffer.concat(chunks));
                    } else {
                        reject(new Error(`Failed to download media: ${res.statusCode}`));
                    }
                });
            }).on('error', (error) => {
                reject(error);
            });
        });

        // Step 3: Save locally
        const extension = getExtensionFromMimeType(mimeType);
        const fileName = `${nanoid()}.${extension}`;
        const filePath = path.join(WHATSAPP_UPLOAD_DIR, fileName);

        fs.writeFileSync(filePath, mediaBuffer);

        // Return relative URL
        return `/uploads/whatsapp/${fileName}`;
    } catch (error) {
        console.error("Error downloading WhatsApp media:", error);
        throw error;
    }
}

/**
 * Get or create a LiveKit room for a phone number
 */
async function getOrCreateRoomForPhoneNumber(phoneNumber: string): Promise<string> {
    // Use phone number as room identifier (normalize it)
    const normalizedPhone = phoneNumber.replace(/[^0-9]/g, "");
    const roomName = `whatsapp_${normalizedPhone}`;

    // Check if room already exists in database
    try {
        const existingRooms = await dbService.getPrivateRoomsByUserIdentity(`whatsapp:${phoneNumber}`);
        
        if (existingRooms && existingRooms.length > 0) {
            return existingRooms[0].roomName;
        }
    } catch (error) {
        console.log("No existing room found, creating new one");
    }

    // Create new room details
    const roomDetails = new RoomDetails(
        RoomChannel.Customer,
        Department.CustomerService,
        "whatsapp",
        RequestingHelp.none,
        undefined,
        roomName,
        `WhatsApp: ${phoneNumber}`,
        TicketStatus.open,
        `whatsapp:${phoneNumber}`,
        false // no private room
    );

    await dbService.savePrivateRoom(roomName, roomDetails);

    return roomName;
}

/**
 * Convert WhatsApp media type to ChatMessage MessageType
 */
function convertWhatsAppMediaTypeToChatMessageType(mediaType: WhatsAppMediaType): MessageType {
    switch (mediaType) {
        case WhatsAppMediaType.Image:
        case WhatsAppMediaType.Sticker:
            return MessageType.Image;
        case WhatsAppMediaType.Video:
            return MessageType.Video;
        case WhatsAppMediaType.Text:
            return MessageType.Text;
        default:
            return MessageType.File;
    }
}

/**
 * Get file extension from MIME type
 */
function getExtensionFromMimeType(mimeType: string): string {
    const mimeMap: { [key: string]: string } = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "video/mp4": "mp4",
        "video/3gpp": "3gp",
        "audio/aac": "aac",
        "audio/mp4": "m4a",
        "audio/mpeg": "mp3",
        "audio/amr": "amr",
        "audio/ogg": "ogg",
        "application/pdf": "pdf",
        "application/vnd.ms-powerpoint": "ppt",
        "application/msword": "doc",
        "application/vnd.ms-excel": "xls",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    };

    return mimeMap[mimeType] || "bin";
}
