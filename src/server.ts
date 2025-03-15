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
import jwt, { JwtPayload } from "jsonwebtoken";
import client from "./db/redis-client.js";
import { User } from "./models/user.js";
import { setCustomerHeartbeat, setModeratorHeartbeat } from "./controllers/livekit.js";

// Initialize dotenv to load environment variables from .env file
dotenv.config();
const app: Application = express();
const PORT = process.env.PORT || 3000;
const portWS: string = process.env.PORT_WS ?? "3001";
const PORT_WS = parseInt(portWS);

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

const wss = new WebSocketServer({
  noServer: true, // Server is attached to express instance!
  path: "/websockets",
  port: PORT_WS,
});

wss.on(
  "connection",
  function connection(websocketConnection, connectionRequest) {
    //const [_path, params] = connectionRequest?.url?.split("?");
    //const connectionParams = queryString.parse(params);

    // NOTE: connectParams are not used here but good to understand how to get
    // to them if you need to pass data with the connection to identify it (e.g., a userId).
    //console.log(connectionParams);
    console.log(`Websocket connection on port ${PORT_WS}`);
    websocketConnection.on("message", async (message) =>  {
      const { command, user, data } = JSON.parse(message.toString()) as {
        command: string;
        user: User;
        data: Object;
      };

      // Moderator actions
      if (command === "set-moderator-heartbeat") {
        await setModeratorHeartbeat(user.email);
        websocketConnection.send(
          JSON.stringify({
            fbStatus: 200,
            message: "Moderator heartbeat set.",
          }),
        );
      }
      if (command === "protected-moderator-route") {
        if (user.moderatorToken === "") {
          websocketConnection.send(
            JSON.stringify({
              fbStatus: 403,
              message: "Missing moderator token.",
            }),
          );
        }
        let blockAccess: boolean = false;
        let jwtPayloadEmail: string = "";
        jwt.verify(
          user.moderatorToken,
          process.env.JWT_SECRET!,
          (err, email) => {
            if (err) {
              blockAccess = true;
            }
            jwtPayloadEmail = email as string;
            //  next();
          },
        );
        if(blockAccess){
          websocketConnection.send(
            JSON.stringify({
              fbStatus: 403,
              message: "Missing moderator token.",
            }),
          );
        }
        websocketConnection.send(
          JSON.stringify({
            fbStatus: 403,
            message: "Access allowed.",
          }),
        );
      }
      // End-user & Dealer actions
      switch (command) {
        case "get-customer-room-or-queue-up":

          break;
        
        case "set-customer-still-waiting-to-create-room-heartbeat":
          await setCustomerHeartbeat(user.uuid);
          websocketConnection.send(
            JSON.stringify({
              fbStatus: 200,
              message: "Customer heartbeat set.",
            }),
          );
          break;
      }
      /*             const { command, user } = JSON.parse(message.toString()) as {
                command: string;
                user: User;
            };
            if (command === "join") {
                const position = addUser(user);
            }
            */

      
    });
  },
);

const expressServer = app.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    "Redis DB Livekit Version " + await client.get("livekit_version"),
  );
});

expressServer.on("upgrade", (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (websocket) => {
    wss.emit("connection", websocket, request);
  });
});

export { wss };
