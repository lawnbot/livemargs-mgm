import { NextFunction, Request, Response } from "express";
import dotenv from "dotenv";
import jwt, { JwtPayload } from "jsonwebtoken";
import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { pipeline } from "stream/promises";
import { createWriteStream } from "fs";
import { RoomChannel } from "../models/room-details.js";

import {
    Error400BadRequest,
    Error401Unauthorized,
} from "../models/errors/custom-errors.js";
import {
    ChatMessage,
    convertMimeTypeToMessageType,
    MessageType,
} from "../models/chat-message.js";
import { nanoid } from "nanoid";
import { mongoDBService } from "../server.js";
import { notifyRoomParticpantsAboutNewUpload } from "./livekit.js";

dotenv.config();

// Basic hard limits; adjust as needed
const MAX_FILE_SIZE = 300 * 1024 * 1024; // 300 MB per file
const MAX_FILES = 20;

// Ensure base upload dir exists
const UPLOAD_BASE = path.resolve(process.env.UPLOAD_DIR || "uploads");
fs.mkdirSync(UPLOAD_BASE, { recursive: true });

// Utility: sanitize to prevent directory traversal
function sanitizeInput(input: string): string | null {
    const ok = /^[a-zA-Z0-9_\-]+$/.test(input);
    return ok ? input : null;
}

// Utility: ensure room folder exists (in rooms subfolder)
function ensureRoomDir(room: string): string {
    const dir = path.join(UPLOAD_BASE, "rooms", room);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// Utility: ensure RAG collection folder exists (in rag subfolder)
function ensureRagDir(collection: string): string {
    const dir = path.join(UPLOAD_BASE, "rag", collection);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
}

// Multer storage using dynamic destination per room
const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const room = (req.params.room || "").toString();
        const sanitized = sanitizeInput(room);
        if (!sanitized) return cb(new Error("Invalid room"), "");
        const dir = ensureRoomDir(sanitized);
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeBase = path.basename(file.originalname);
        const ext = path.extname(safeBase);
        const stem = path.basename(safeBase, ext);
        const hash = crypto.randomBytes(6).toString("hex");
        cb(null, `${stem}.${hash}${ext}`);
    },
});

// Multer storage for RAG collections (stores in rag subfolder)
const ragStorage = multer.diskStorage({
    destination: (req, _file, cb) => {
        const collection = (req.params.collection || "").toString();
        const sanitized = sanitizeInput(collection);
        if (!sanitized) return cb(new Error("Invalid collection"), "");
        const dir = ensureRagDir(sanitized);
        cb(null, dir);
    },
    filename: (_req, file, cb) => {
        const safeBase = path.basename(file.originalname);
        const ext = path.extname(safeBase);
        const stem = path.basename(safeBase, ext);
        const hash = crypto.randomBytes(6).toString("hex");
        cb(null, `${stem}.${hash}${ext}`);
    },
});

// Memory storage for streaming large files
const memoryStorage = multer.memoryStorage();

export const upload = multer({
    storage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
    },
});

// Upload instance for RAG collections
export const uploadRag = multer({
    storage: ragStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
    },
});

// Upload instance for streaming (memory storage)
export const uploadStream = multer({
    storage: memoryStorage,
    limits: {
        fileSize: MAX_FILE_SIZE,
        files: MAX_FILES,
    },
});

// Utility function to generate unique filename
function generateUniqueFilename(originalName: string): string {
    const safeBase = path.basename(originalName);
    const ext = path.extname(safeBase);
    const stem = path.basename(safeBase, ext);
    const hash = crypto.randomBytes(6).toString("hex");
    return `${stem}.${hash}${ext}`;
}

// Stream-based file handler for large files
export const streamFileToRoom = async (
    fileBuffer: Buffer,
    originalName: string,
    room: string,
): Promise<{ filename: string; path: string; size: number }> => {
    const sanitized = sanitizeInput(room);
    if (!sanitized) {
        throw new Error("Invalid room name");
    }

    const dir = ensureRoomDir(sanitized);
    const filename = generateUniqueFilename(originalName);
    const filePath = path.join(dir, filename);

    try {
        // Use fs.promises.writeFile for better performance with large files
        await fs.promises.writeFile(filePath, fileBuffer);

        return {
            filename,
            path: filePath,
            size: fileBuffer.length,
        };
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        throw new Error(`Failed to write file: ${errorMessage}`);
    }
};

// Advanced streaming for very large files using Node.js streams
export const streamLargeFileToRoom = async (
    fileStream: NodeJS.ReadableStream,
    originalName: string,
    room: string,
    expectedSize?: number,
): Promise<{ filename: string; path: string; size: number }> => {
    const sanitized = sanitizeInput(room);
    if (!sanitized) {
        throw new Error("Invalid room name");
    }

    const dir = ensureRoomDir(sanitized);
    const filename = generateUniqueFilename(originalName);
    const filePath = path.join(dir, filename);

    try {
        const writeStream = createWriteStream(filePath);
        let bytesWritten = 0;

        // Track progress for large files
        const trackingStream = new (require("stream").Transform)({
            transform(chunk: Buffer, encoding: string, callback: Function) {
                bytesWritten += chunk.length;
                this.push(chunk);
                callback();
            },
        });

        // Use pipeline for proper error handling and cleanup
        await pipeline(fileStream, trackingStream, writeStream);

        return {
            filename,
            path: filePath,
            size: bytesWritten,
        };
    } catch (error) {
        // Clean up partial file on error
        try {
            await fs.promises.unlink(filePath);
        } catch (unlinkError) {
            // Ignore cleanup errors
        }

        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        throw new Error(`Failed to stream file: ${errorMessage}`);
    }
};

export const preSanitizeCheck = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    // Validate room early to fail before parsing big payloads
    const sanitized = sanitizeInput(req.params.room);
    if (!sanitized) {
        res.status(400).json({ error: "Invalid room" });
        return;
    }
    next();
};

export const preSanitizeCheckCollection = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    // Validate collection early to fail before parsing big payloads
    const sanitized = sanitizeInput(req.params.collection);
    if (!sanitized) {
        res.status(400).json({ error: "Invalid collection" });
        return;
    }
    next();
};
export const ensureParticipantIdHeaderAvailable = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const participantId = req.headers["participantId"];

    if (
        participantId == undefined || participantId == null ||
        participantId === ""
    ) {
        next(new Error400BadRequest("Error participantId in header missing."));
    }
    next();
};
export const checkUploadRequiresAuth = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const roomName = req.params.room;

    let authRequired = false;
    if (
        roomName.startsWith(RoomChannel.Internal.toString())
    ) {
        authRequired = true;
    }

    // Auth is required
    if (
        authRequired
    ) {
        const authHeader = req.headers["authorization"];
        //console.log("Auth Header: " + authHeader);
        const token = (authHeader && authHeader.split(" ")[1]) ?? "";
        //console.log("token: " + token);

        if (token === "") next(new Error401Unauthorized("Token not valid"));

        try {
            const decoded = jwt.verify(
                token,
                process.env.JWT_SECRET!,
            ) as { email?: string };
        } catch (err) {
            console.log("Error at verifying ws mgmAccessToken: " + err);
            next(new Error401Unauthorized("Error at verifying"));
        }
    }
    next();
};

export const uploadForRoom = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const room = sanitizeInput(req.params.room)!;

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
    }

    const payload = files.map((f) => ({
        field: f.fieldname,
        originalName: f.originalname,
        storedName: path.basename(f.path),
        size: f.size,
        mimeType: f.mimetype,
        relativePath: path.relative(UPLOAD_BASE, f.path),
    }));
    
    const participantId = req.headers["participantId"]?.toString() ?? "";

    for (let i = 0; i < payload.length; i++) {
        try {
            const fileMessage: ChatMessage = {
                messageId: nanoid(9),
                participantId: participantId,
                text: "",
                aiQueryContext: "",
                timestamp: Date.now(),
                type: convertMimeTypeToMessageType(
                    payload[i].mimeType,
                ),
                fileName: payload[i].storedName,
                fileSize: payload[i].size,
            };
            await mongoDBService.saveChatMessage(
                req.params.room,
                fileMessage,
            );

            // Notifiy room listeners
            await notifyRoomParticpantsAboutNewUpload(
                req.params.room,
                fileMessage,
            );
        } catch (dbError) {
            console.error(
                "Failed to save file upload message to database:",
                dbError,
            );
        }
    }

    res.status(200).json({
        room,
        uploaded: files.length,
        files: payload,
    });
};

// Upload handler for RAG collections
export const uploadForRagCollection = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    const collection = sanitizeInput(req.params.collection)!;

    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (files.length === 0) {
        res.status(400).json({ error: "No files provided" });
        return;
    }

    const payload = files.map((f) => ({
        field: f.fieldname,
        originalName: f.originalname,
        storedName: path.basename(f.path),
        size: f.size,
        mimeType: f.mimetype,
        relativePath: path.relative(UPLOAD_BASE, f.path),
    }));

    res.status(200).json({
        collection,
        uploaded: files.length,
        files: payload,
    });
};

// Stream-based upload handler for large files
export const uploadForRoomStream = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const room = sanitizeInput(req.params.room);
        if (!room) {
            res.status(400).json({ error: "Invalid room" });
            return;
        }

        const files = (req.files as Express.Multer.File[] | undefined) || [];
        if (files.length === 0) {
            res.status(400).json({ error: "No files provided" });
            return;
        }

        // Process files using streaming approach
        const processedFiles = await Promise.all(
            files.map(async (file) => {
                try {
                    const result = await streamFileToRoom(
                        file.buffer,
                        file.originalname,
                        room,
                    );

                    return {
                        field: file.fieldname,
                        originalName: file.originalname,
                        storedName: result.filename,
                        size: result.size,
                        mimeType: file.mimetype,
                        relativePath: path.relative(UPLOAD_BASE, result.path),
                    };
                } catch (error) {
                    const errorMessage = error instanceof Error
                        ? error.message
                        : "Unknown error";
                    throw new Error(
                        `Failed to process file ${file.originalname}: ${errorMessage}`,
                    );
                }
            }),
        );
        const participantId = req.headers["participantId"]?.toString() ?? "";

        for (let i = 0; i < processedFiles.length; i++) {
            try {
                const fileMessage: ChatMessage = {
                    messageId: nanoid(9),
                    participantId: participantId,
                    text: "",
                    aiQueryContext: "",
                    timestamp: Date.now(),
                    type: convertMimeTypeToMessageType(
                        processedFiles[i].mimeType,
                    ),
                    fileName: processedFiles[i].storedName,
                    fileSize: processedFiles[i].size,
                };
                await mongoDBService.saveChatMessage(
                    req.params.room,
                    fileMessage,
                );

                // Notifiy room listeners
                await notifyRoomParticpantsAboutNewUpload(
                    req.params.room,
                    fileMessage,
                );
            } catch (dbError) {
                console.error(
                    "Failed to save file upload message to database:",
                    dbError,
                );
            }
        }

        res.status(200).json({
            room,
            uploaded: processedFiles.length,
            files: processedFiles,
        });
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        res.status(500).json({ error: `Upload failed: ${errorMessage}` });
    }
};

// List files in a room (excluding thumbnails folder)
export const listFilesForRoom = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const room = sanitizeInput(req.params.room);
        if (!room) {
            res.status(400).json({ error: "Invalid room" });
            return;
        }

        const roomDir = path.join(UPLOAD_BASE, "rooms", room);

        // Check if room directory exists
        if (!fs.existsSync(roomDir)) {
            res.status(404).json({ error: "Room not found" });
            return;
        }

        // Read directory contents
        const entries = await fs.promises.readdir(roomDir, {
            withFileTypes: true,
        });

        // Filter out directories (like thumbnails) and get file stats
        const files = await Promise.all(
            entries
                .filter((entry) => entry.isFile()) // Only files, no directories
                .map(async (entry) => {
                    const filePath = path.join(roomDir, entry.name);
                    const stats = await fs.promises.stat(filePath);

                    return {
                        name: entry.name,
                        size: stats.size,
                        lastModified: stats.mtime,
                        relativePath: path.relative(UPLOAD_BASE, filePath),
                    };
                }),
        );

        res.status(200).json({
            room,
            fileCount: files.length,
            files,
        });
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        res.status(500).json({
            error: `Failed to list files: ${errorMessage}`,
        });
    }
};

// Download a file from a room
export const downloadFileFromRoom = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const room = sanitizeInput(req.params.room);
        const filename = req.params.filename;

        if (!room) {
            res.status(400).json({ error: "Invalid room" });
            return;
        }

        if (!filename) {
            res.status(400).json({ error: "Filename is required" });
            return;
        }

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename);
        const filePath = path.join(
            UPLOAD_BASE,
            "rooms",
            room,
            sanitizedFilename,
        );

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "File not found" });
            return;
        }

        // Verify the file is actually within the room directory (additional security)
        const roomDir = path.join(UPLOAD_BASE, "rooms", room);
        const resolvedFilePath = path.resolve(filePath);
        const resolvedRoomDir = path.resolve(roomDir);

        if (!resolvedFilePath.startsWith(resolvedRoomDir)) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        // Get file stats for headers
        const stats = await fs.promises.stat(filePath);

        // Set appropriate headers
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${sanitizedFilename}"`,
        );
        res.setHeader("Content-Length", stats.size);
        res.setHeader("Content-Type", "application/octet-stream");

        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath);

        fileStream.on("error", (error) => {
            console.error("Error streaming file:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Error reading file" });
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        res.status(500).json({
            error: `Failed to download file: ${errorMessage}`,
        });
    }
};
