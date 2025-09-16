import express from "express";
import path from 'path';
import { aiRoutes } from "./ai-routes.js";
import { livemargsRouter } from "./livekit-routes.js";
import { authRouter } from "./auth-routes.js";
import { healthcheck } from "../controllers/generic.js";
import { fileManagementRoutes } from "./file-mgm-routes.js";

// Consistent with file-mgm.ts approach
const UPLOAD_BASE = path.resolve(process.env.UPLOAD_DIR || "uploads");
const WEB_CLIENT_PATH = path.join(UPLOAD_BASE, "clients", "web");

export const routes = express.Router();

routes.use(authRouter);
routes.use(livemargsRouter);
routes.use(aiRoutes);
routes.use(fileManagementRoutes);

routes.get("/health", healthcheck);

// Host Livemargs Web-Version
routes.use(express.static(WEB_CLIENT_PATH));

//Fallback route for SPA. Must be placed after all API routes
routes.get('*', (req, res) => {
  res.sendFile(path.resolve(WEB_CLIENT_PATH, 'index.html'));
});