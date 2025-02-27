import { AccessToken } from "livekit-server-sdk";
import dotenv from "dotenv";
import express, { Application, NextFunction, Request, Response } from "express";
import {
  Error401Unauthorized,
  Error403Forbidden,
} from "./models/errors/custom-errors.js";
import { routes } from "./routes/index.js";
import cors from "cors";
import helmet from "helmet";
import { Server, WebSocketServer } from "ws";
import queryString from "query-string";
// Initialize dotenv to load environment variables from .env file
dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());

// routes
app.use("/", routes);
app.use(errorHandler);

function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) {
  if (err instanceof Error401Unauthorized) {
    res.status(401).json({ error: err });
  } else if (err instanceof Error403Forbidden) {
    res.status(403).json({ error: err });
  } else {
    res.status(500).json({ error: err });
  }

  // res.status(500).json({ error: err });
}

const expressServer = app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});


const wss = new WebSocketServer({
  noServer: true, // Server is attached to express instance!
  path: "/websockets",
});

expressServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});
export {wss};

