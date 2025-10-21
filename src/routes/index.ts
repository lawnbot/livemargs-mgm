import express from "express";
import path from "path";
import fs from "fs";
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

// Check if Flutter app is built with WASM (requires COOP/COEP headers for multi-threading)
const isWasmBuild = fs.existsSync(path.join(WEB_CLIENT_PATH, "main.dart.wasm"));

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

    // Add COOP and COEP headers only for WASM builds (required for multi-threading)
    if (isWasmBuild) {
      res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
      res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    }

    // Critical files that must never be cached (entry points)
   if (rel === 'index.html' || 
        rel === 'flutter_service_worker.js' || 
        rel === 'version.json' ||
        rel === 'assets/pubspec.yaml') {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      res.removeHeader('ETag');
      res.removeHeader('Last-Modified');
      return;
    }

    // Flutter bootstrap files - should check for updates
    if (rel === 'flutter.js' || rel === 'flutter_bootstrap.js') {
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
       res.removeHeader('ETag');
      return;
    }

    // Hashed assets can be cached aggressively (they have version in filename)
    // But exclude pubspec.yaml which doesn't have version hashing
    if ((rel.startsWith('assets/') || rel.startsWith('canvaskit/') || 
        rel.match(/main\.dart\.[a-f0-9]+\.js/) || rel.match(/\.wasm$/)) &&
        !rel.endsWith('pubspec.yaml')) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      // Other files - moderate caching with revalidation
      res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
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




// Fallback route for SPA. Must be placed after all API routes
// Uses all potential routes except .well-known
routes.get(/^\/(?!\.well-known).*/, (req, res) => {
  // Add COOP and COEP headers only for WASM builds (required for multi-threading)
  if (isWasmBuild) {
    res.setHeader('Cross-Origin-Embedder-Policy', 'credentialless');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  }
  
  // Never cache index.html to ensure users get the latest version
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.removeHeader('ETag');
  res.removeHeader('Last-Modified');
  
  res.sendFile(path.join(WEB_CLIENT_PATH, "index.html"));
});