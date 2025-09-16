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
import { dbService } from "../server.js";
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
    const participantId = req.headers["participantid"]; //HTTP2 is lower case!

    if (
        participantId == undefined || participantId == null ||
        participantId === ""
    ) {
        next(new Error400BadRequest("Error participantid in header missing."));
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

    const participantId = req.headers["participantid"]?.toString() ?? ""; // HTTP 2.0 is lower case!

    // Process subtitles and save file messages
    const subtitlesArray = parseSubtitles(req.body);
    await processAndSaveFileMessages(
        payload,
        subtitlesArray,
        participantId,
        req.params.room,
    );

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
        const participantId = req.headers["participantid"]?.toString() ?? "";

        // Process subtitles and save file messages
        const subtitlesArray = parseSubtitles(req.body);
        await processAndSaveFileMessages(
            processedFiles,
            subtitlesArray,
            participantId,
            req.params.room,
        );

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
        // if (!fs.existsSync(roomDir)) {
        //     res.status(404).json({ error: "Room not found" });
        //     return;
        // }
        // Show empty folder also at no files.
        if (!fs.existsSync(roomDir)) {
            res.status(200).json({
                room,
                fileCount: 0,
                files: [],
            });
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

// Download a file from a room
export const downloadFileFromRAG = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const collection = sanitizeInput(req.params.collection);
        const filename = req.params.filename;

        if (!collection) {
            res.status(400).json({ error: "Invalid collection" });
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
            "rag",
            collection,
            sanitizedFilename,
        );

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "File not found" });
            return;
        }

        // Verify the file is actually within the room directory (additional security)
        const collectionDir = path.join(UPLOAD_BASE, "rag", collection);
        const resolvedFilePath = path.resolve(filePath);
        const resolvedcollectionDir = path.resolve(collectionDir);

        if (!resolvedFilePath.startsWith(resolvedcollectionDir)) {
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

// Helper function to parse subtitles from request body
function parseSubtitles(requestBody: any): string[] {
    let subtitlesArray: string[] = [];
    if (requestBody.subtitles) {
        try {
            subtitlesArray = JSON.parse(requestBody.subtitles);
            if (!Array.isArray(subtitlesArray)) {
                subtitlesArray = [];
            }
        } catch (error) {
            console.warn("Failed to parse subtitles:", error);
            subtitlesArray = [];
        }
    }
    return subtitlesArray;
}

// Helper function to process and save file messages with subtitles
async function processAndSaveFileMessages(
    files: Array<{
        mimeType: string;
        storedName: string;
        size: number;
    }>,
    subtitlesArray: string[],
    participantId: string,
    room: string,
): Promise<void> {
    for (let i = 0; i < files.length; i++) {
        try {
            // Get subtitle for this file (can be empty string)
            const subtitle = i < subtitlesArray.length
                ? subtitlesArray[i] || ""
                : "";

            const fileMessage: ChatMessage = {
                messageId: nanoid(9),
                participantId: participantId,
                text: subtitle,
                aiQueryContext: "",
                timestamp: Date.now(),
                type: convertMimeTypeToMessageType(
                    files[i].mimeType,
                ),
                fileName: files[i].storedName,
                fileSize: files[i].size,
            };

            console.log("Saving file message to database:", fileMessage);
            await dbService.saveChatMessage(
                room,
                fileMessage,
            );

            // Notify room listeners if room exists
            console.log("Notifiy Particpants");
            await notifyRoomParticpantsAboutNewUpload(
                room,
                fileMessage,
            );
        } catch (dbError) {
            console.error(
                "Failed to save file upload message to database:",
                dbError,
            );
        }
    }
}

// List android apk files for release and beta branch
// List android apk files for release and beta branch
export const listAndroidAPKs = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const androidBaseDir = path.join(UPLOAD_BASE, "clients", "android");

        // Function to extract version from filename like "Livemargs_1.2.54.apk"
        const extractVersionFromFilename = (
            filename: string,
        ): string | null => {
            const match = filename.match(/Livemargs_(\d+\.\d+\.\d+)\.apk$/i);
            return match ? match[1] : null;
        };

        // Function to scan a directory for APK files
        const scanAPKDirectory = async (dirPath: string) => {
            if (!fs.existsSync(dirPath)) {
                return [];
            }

            const entries = await fs.promises.readdir(dirPath, {
                withFileTypes: true,
            });
            const apkFiles = [];

            for (const entry of entries) {
                if (
                    entry.isFile() && entry.name.toLowerCase().endsWith(".apk")
                ) {
                    const filePath = path.join(dirPath, entry.name);
                    const stats = await fs.promises.stat(filePath);
                    const version = extractVersionFromFilename(entry.name);

                    apkFiles.push({
                        fileName: entry.name,
                        version: version || "unknown",
                        createdDate: stats.birthtime,
                        size: stats.size,
                        lastModified: stats.mtime,
                    });
                }
            }

            return apkFiles;
        };

        // Scan both release and beta directories
        const releaseDir = path.join(androidBaseDir, "release");
        const betaDir = path.join(androidBaseDir, "beta");

        const [releaseAPKs, betaAPKs] = await Promise.all([
            scanAPKDirectory(releaseDir),
            scanAPKDirectory(betaDir),
        ]);

        // Sort by version (descending) - newest first
        const sortByVersion = (a: any, b: any) => {
            if (a.version === "unknown" && b.version === "unknown") return 0;
            if (a.version === "unknown") return 1;
            if (b.version === "unknown") return -1;

            // Simple version comparison (assumes semantic versioning)
            const aVersion = a.version.split(".").map(Number);
            const bVersion = b.version.split(".").map(Number);

            for (
                let i = 0; i < Math.max(aVersion.length, bVersion.length); i++
            ) {
                const aPart = aVersion[i] || 0;
                const bPart = bVersion[i] || 0;

                if (aPart !== bPart) {
                    return bPart - aPart; // Descending order
                }
            }

            return 0;
        };

        releaseAPKs.sort(sortByVersion);
        betaAPKs.sort(sortByVersion);

        const response = {
            release: releaseAPKs,
            beta: betaAPKs,
            summary: {
                totalReleaseAPKs: releaseAPKs.length,
                totalBetaAPKs: betaAPKs.length,
                latestRelease: releaseAPKs.length > 0
                    ? releaseAPKs[0].version
                    : null,
                latestBeta: betaAPKs.length > 0 ? betaAPKs[0].version : null,
            },
        };

        res.status(200).json(response);
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        res.status(500).json({
            error: `Failed to list Android APKs: ${errorMessage}`,
        });
    }
};

// Download a specific APK file from android release or beta
export const downloadAndroidAPK = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const branch = req.params.branch; // 'release' or 'beta'
        const filename = req.params.filename;

        if (!branch || !["release", "beta"].includes(branch)) {
            res.status(400).json({
                error: "Invalid branch. Must be 'release' or 'beta'",
            });
            return;
        }

        if (!filename) {
            res.status(400).json({ error: "Filename is required" });
            return;
        }

        // Sanitize filename to prevent directory traversal
        const sanitizedFilename = path.basename(filename);

        // Validate that it's an APK file
        if (!sanitizedFilename.toLowerCase().endsWith(".apk")) {
            res.status(400).json({ error: "Only APK files are allowed" });
            return;
        }

        const filePath = path.join(
            UPLOAD_BASE,
            "clients",
            "android",
            branch,
            sanitizedFilename,
        );

        // Check if file exists
        if (!fs.existsSync(filePath)) {
            res.status(404).json({ error: "APK file not found" });
            return;
        }

        // Verify the file is actually within the android directory (additional security)
        const androidDir = path.join(UPLOAD_BASE, "clients", "android", branch);
        const resolvedFilePath = path.resolve(filePath);
        const resolvedAndroidDir = path.resolve(androidDir);

        if (!resolvedFilePath.startsWith(resolvedAndroidDir)) {
            res.status(403).json({ error: "Access denied" });
            return;
        }

        // Get file stats for headers
        const stats = await fs.promises.stat(filePath);

        // Set appropriate headers for APK download
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${sanitizedFilename}"`,
        );
        res.setHeader("Content-Length", stats.size);
        res.setHeader(
            "Content-Type",
            "application/vnd.android.package-archive",
        );

        // Stream the file to the response
        const fileStream = fs.createReadStream(filePath);

        fileStream.on("error", (error) => {
            console.error("Error streaming APK file:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "Error reading APK file" });
            }
        });

        fileStream.pipe(res);
    } catch (error) {
        const errorMessage = error instanceof Error
            ? error.message
            : "Unknown error";
        res.status(500).json({
            error: `Failed to download APK: ${errorMessage}`,
        });
    }
};
