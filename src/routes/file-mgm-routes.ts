import { Router } from "express";
import {
    checkUploadRequiresAuth,
    downloadFileFromRoom,
    ensureParticipantIdHeaderAvailable,
    listFilesForRoom,
    preSanitizeCheck,
    preSanitizeCheckCollection,
    upload,
    uploadForRagCollection,
    uploadForRoom,
    uploadForRoomStream,
    uploadRag,
    uploadStream,
} from "../controllers/file-mgm.js";
import { authenticateTokenMiddleWare } from "../controllers/auth.js";

const router: Router = Router();

// For Room Uploads
// Standard upload route (disk storage)
router.post(
    "/uploadRoomFiles/:room",
    ensureParticipantIdHeaderAvailable,
    checkUploadRequiresAuth,
    preSanitizeCheck,
    upload.array("files"),
    uploadForRoom,
);


// Stream-based upload route for large files (memory storage + streaming)
router.post(
    "/uploadRoomFilesStream/:room",
    ensureParticipantIdHeaderAvailable,
    checkUploadRequiresAuth,
    preSanitizeCheck,
    uploadStream.array("files"), // Support just one file per upload according tests.
    uploadForRoomStream,
);

// List files in a room (excluding thumbnails folder)
router.get(
    "/listRoomFiles/:room",
    checkUploadRequiresAuth,
    preSanitizeCheck,
    listFilesForRoom,
);

// Download a file from a room
router.get(
    "/downloadFile/:room/:filename",
    checkUploadRequiresAuth,
    preSanitizeCheck,
    downloadFileFromRoom,
);


// For RAG collection
router.post(
    "/uploadRagFiles/:collection",
    authenticateTokenMiddleWare, // Always auth
    preSanitizeCheckCollection,
    uploadRag.array("files"),
    uploadForRagCollection,
);


export { router as fileManagementRoutes };
