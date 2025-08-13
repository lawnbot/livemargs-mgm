import express from "express";
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
