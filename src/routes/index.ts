import express from 'express';
import { aiRoutes } from './ai-routes.js';
import { livemargsRouter } from './livekit-routes.js';
import { authRouter } from './auth-routes.js';
import { healthcheck } from '../controllers/generic.js';

export const routes = express.Router();

routes.use(authRouter);
routes.use(livemargsRouter);
routes.use(aiRoutes);


routes.get("/health", healthcheck);