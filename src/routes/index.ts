import express from 'express';
import { aiRoutes } from './ai-routes.js';
import { livemargsRouter } from './livemargs-routes.js';
import { authRouter } from './auth-routes.js';

export const routes = express.Router();

routes.use(authRouter);
routes.use(livemargsRouter);
routes.use(aiRoutes);
