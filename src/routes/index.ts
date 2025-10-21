import express from "express";
import path from "path";
import { aiRoutes } from "./ai-routes.js";
import { livemargsRouter } from "./livekit-routes.js";
import { authRouter } from "./auth-routes.js";
import { healthcheck } from "../controllers/generic.js";
import { fileManagementRoutes } from "./file-mgm-routes.js";

// Consistent with file-mgm.ts approach
const UPLOAD_BASE = path.resolve(process.env.UPLOAD_DIR || "uploads");
const WEB_CLIENT_PATH = path.join(UPLOAD_BASE, "clients", "web");

const PUBLIC_BASE = path.resolve("public");
const WELL_KNOWN_PATH = path.join(PUBLIC_BASE, ".well-known");

export const routes = express.Router();

routes.use(authRouter);
routes.use(livemargsRouter);
routes.use(aiRoutes);
routes.use(fileManagementRoutes);

routes.get("/health", healthcheck);

// Host App Links with correct Content-Type Headers
// Requires HTTPS. HTTP is not possible!
routes.get("/.well-known/apple-app-site-association", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(WELL_KNOWN_PATH, "apple-app-site-association"));
});

routes.get("/.well-known/assetlinks.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.sendFile(path.join(WELL_KNOWN_PATH, "assetlinks.json"));
});

// Fallback for other .well-known files
routes.use("/.well-known", express.static(WELL_KNOWN_PATH));

// Host Livemargs Web-Version
routes.use(express.static(WEB_CLIENT_PATH,
{
  setHeaders: (res, filePath) => {
    const rel = path.relative(WEB_CLIENT_PATH, filePath).replace(/\\/g, '/');

    if (rel === 'index.html') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      return;
    }
    if (rel.startsWith('assets/') || rel.startsWith('canvaskit/')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
    }

    if (filePath.endsWith('.wasm')) {
      res.setHeader('Content-Type', 'application/wasm');
    }
    if (filePath.endsWith('.webmanifest') || filePath.endsWith('.manifest')) {
      res.setHeader('Content-Type', 'application/manifest+json');
    }
  }
})
);




//Fallback route for SPA. Must be placed after all API routes
// Uses all potential routes except .well-known
routes.get(/^\/(?!\.well-known).*/, (req, res) => {
  res.sendFile(path.join(WEB_CLIENT_PATH, "index.html"));
});