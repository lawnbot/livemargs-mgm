import express from "express";
import path from 'path';
import { aiRoutes } from "./ai-routes.js";
import { livemargsRouter } from "./livekit-routes.js";
import { authRouter } from "./auth-routes.js";
import { healthcheck } from "../controllers/generic.js";
import { fileManagementRoutes } from "./file-mgm-routes.js";

export const routes = express.Router();

routes.use(authRouter);
routes.use(livemargsRouter);
routes.use(aiRoutes);
routes.use(fileManagementRoutes);

routes.get("/health", healthcheck);

// Host Livemargs Web-Version
routes.use(express.static(path.join(__dirname, '../../uploads/clients/web')));

//Fallback route for SPA. Must be placed after all API routes
routes.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../uploads/clients/web/index.html'));
});