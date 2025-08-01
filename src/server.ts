import { createServer } from "http";
import { v4 as uuidv4 } from "uuid";
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
import client from "./db/redisClient.js";
import { redisPublisher, redisSubscriber } from "./db/redisPubSub.js";
import { User } from "./models/user.js";
import {
  createAccessTokenForRoom,
  createRoom,
  getAllRooms,
  getCustomerRooms,
  setCustomerHeartbeat,
  setModeratorHeartbeat,
  updateRoomMetadata,
} from "./controllers/livekit.js";
import { RoomChannel, RoomDetails } from "./models/room-details.js";
import { FbStatus, WSFeedback } from "./models/ws-feedback.js";
import { nanoid } from "nanoid";

// Initialize dotenv to load environment variables from .env file
dotenv.config();
const app: Application = express();
const server = createServer(app);
const wss = new WebSocketServer({
  noServer: true, // Server is attached to express instance!
});

const PORT = process.env.PORT || 3000;
const portWS: string = process.env.PORT_WS ?? "3001";
const PORT_WS = parseInt(portWS);

wss.on(
  "connection",
  function connection(ws, connectionRequest) {
    // Generate a unique client ID for each ws instance
    const wsClientId = uuidv4();
    console.log("new ws conncetion");

    //Directly Subscribe to a unique Redis channel for this client
    redisSubscriber.subscribe(wsClientId, (message) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message); // Once Publish takes place it sends the message directly to the WebSocket client
      }
    });

    //const [_path, params] = connectionRequest?.url?.split("?");
    //const connectionParams = queryString.parse(params);

    // NOTE: connectParams are not used here but good to understand how to get
    // to them if you need to pass data with the connection to identify it (e.g., a userId).
    //console.log(connectionParams);
    console.log(`Websocket connection on port ${PORT}`);
    ws.on("message", async (message) => {
      const { command, user, messageData } = JSON.parse(message.toString()) as {
        command: string;
        user: User;
        messageData: Object;
      };

      if (command == "test") {
        const wsFb: WSFeedback = {
          fbStatus: FbStatus.Okay,
          originalCommand: "test",
          fbCommand: "test",
          fbMessage: "Test succcessful.",
        };

        ws.send(JSON.stringify(wsFb));
      }

      // Moderator actions
      if (command === "set-moderator-heartbeat") {
        const fbCommand: string = "fb-moderator-heartbeat-setting";
        try {
          await setModeratorHeartbeat(user.email);
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "set-moderator-heartbeat",
            fbCommand: fbCommand,
            fbMessage: "Moderator heartbeat set.",
          };

          ws.send(JSON.stringify(wsFb));
        } catch (e) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Error,
            originalCommand: "set-moderator-heartbeat",
            fbCommand: fbCommand,
            fbMessage: "Moderator heartbeat coul not be set.",
          };
        }
      }
      if (command === "protected-moderator-route") {
        const [blockAccess, jwtEmail] = getModeratorTokenPermission(user);
        const fbCommand: string = "fb-accessing-protected-moderator-route";

        if (blockAccess) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "protected-moderator-route",
            fbCommand: fbCommand,
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "protected-moderator-route",
            fbCommand: fbCommand,
            fbMessage: "Access allowed.",
          };

          ws.send(JSON.stringify(wsFb));
        }
      }

      if (command === "protected-moderator-get-all-rooms") {
        const [blockAccess, jwtEmail] = getModeratorTokenPermission(user);
        const fbCommand: string = "fb-rooms-list-access";
        if (!blockAccess) {
          const rooms = await getAllRooms();
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "protected-moderator-get-all-rooms",
            fbCommand: fbCommand,
            fbMessage: "Retrieved all rooms.",
            fbData: JSON.stringify(rooms),
          };

          ws.send(JSON.stringify(wsFb));
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "protected-moderator-get-all-rooms",
            fbCommand: fbCommand,
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));
        }
      }
      if (command === "create-room-name") {
        interface MessageData {
          internalRoom?: boolean;
        }
        const messageDataObj = messageData as MessageData;
        const interalRoom = messageDataObj?.internalRoom ?? false;
        let authFailed = false;        
        let roomName = "";
        const fbCommand: string = "fb-creating-room-name";

        if (interalRoom) {
          const [blockAccess, jwtEmail] = getModeratorTokenPermission(user);
          authFailed = blockAccess;
          if (!blockAccess) {
            roomName = RoomChannel.Internal.toString() + nanoid(9);
          }
        } else {
          roomName = RoomChannel.Customer.toString() + nanoid(9);
        }

        if (authFailed) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            fbCommand: fbCommand,
            originalCommand: "create-access-token-for-room",
            fbMessage: "Authentication for creating interal room failed.",
          };
          ws.send(JSON.stringify(wsFb));
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "create-room-name",
            fbCommand: fbCommand,
            fbMessage: "Created room name id.",
            fbData: roomName,
          };
          ws.send(JSON.stringify(wsFb));
        }
      }
      if (command === "create-access-token-for-room") {
        interface MessageData {
          roomName: string;
        }
        const messageDataObj = messageData as MessageData;
        const roomName = messageDataObj.roomName;
        const fbCommand: string = "fb-creating-access-token-for-room";
        if (roomName == undefined || roomName === "" || roomName.length < 9) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Error,
            originalCommand: "create-access-token-for-room",
            fbCommand: fbCommand,
            fbMessage: "Room name is required.",
          };
          ws.send(JSON.stringify(wsFb));
        } else {
          let authFailed = false;
          let authRequired = false;

          if (
            roomName.startsWith(RoomChannel.Internal.toString())
          ) {
            authRequired = true;
          }

          // Auth is required
          if (
            authRequired
          ) {
            const [blockAccess, jwtEmail] = getModeratorTokenPermission(user);
            authFailed = blockAccess; // Is blocked means auth failed.
          }

          if (authRequired && authFailed) {
            const wsFb: WSFeedback = {
              fbStatus: FbStatus.Unauthorized,
              originalCommand: "create-access-token-for-room",
              fbCommand: fbCommand, //"createAccessTokenForRoomFailed",
              fbMessage: "Moderator token missing or wrong.",
            };

            ws.send(JSON.stringify(wsFb));
          } else {
            try {
              const at = await createAccessTokenForRoom(
                roomName,
                user,
                authRequired && !authFailed, // Means once auth is required (case of moderator) it must not have failed
              );
              if (at === "") {
                throw new Error("Access token is empty.");
              }
              const wsFb: WSFeedback = {
                fbStatus: FbStatus.Okay,
                originalCommand: "create-access-token-for-room",
                fbCommand: fbCommand,
                fbMessage: "Created access token for room.",
                fbData: at,
              };
              ws.send(JSON.stringify(wsFb));
            } catch (e) {
              const wsFb: WSFeedback = {
                fbStatus: FbStatus.Error,
                originalCommand: "create-access-token-for-room",
                fbCommand: fbCommand, //"createAccessTokenForRoomFailed",
                fbMessage: "Could not create access token for room.",
              };
              ws.send(JSON.stringify(wsFb));
            }
          }
        }
      }
      if (command == "create-access-token-w-metadata-for-room") {
        interface MessageData {
          roomName: string;
          roomDetails: RoomDetails;
        }
        const messageDataObj = messageData as MessageData;
        const roomName = messageDataObj.roomName;
        const roomDetails = messageDataObj.roomDetails;
        const fbCommand: string =
          "fb-creating-access-token-w-metadata-for-room";
        let authFailed = false;
        let authRequired = false;

        if (
          roomName.startsWith(RoomChannel.Internal.toString()) ||
          roomDetails.channel == RoomChannel.Internal
        ) {
          authRequired = true;
        }

        // Auth is required
        if (
          authRequired
        ) {
          const [blockAccess, jwtEmail] = getModeratorTokenPermission(user);
          authFailed = blockAccess; // Is blocked means auth failed.
        }

        if (authRequired && authFailed) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "create-access-token-w-metadata-for-room",
            fbCommand: fbCommand, //"createAccessTokenForRoomFailed",
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));
        } else {
          try {
            const newRoom = await createRoom(roomDetails, roomName);
            const at = await createAccessTokenForRoom(
              roomName,
              user,
              authRequired && !authFailed, // Means once auth is required (case of moderator) it must not have failed
            );
            if (at === "") {
              throw new Error("Access token is empty.");
            }
            const wsFb: WSFeedback = {
              fbStatus: FbStatus.Okay,
              originalCommand: "create-access-token-w-metadata-for-room",
              fbCommand: fbCommand,
              fbMessage: "Could create access token with metadata for room.",
              fbData: at,
            };
            ws.send(JSON.stringify(wsFb));
          } catch (e) {
            const wsFb: WSFeedback = {
              fbStatus: FbStatus.Error,
              originalCommand: "create-access-token-w-metadata-for-room",
              fbCommand: fbCommand,
              fbMessage:
                "Could not create access token with metadata for room.",
            };
            ws.send(JSON.stringify(wsFb));
          }
        }
      }

      if (command == "update-room-metadata") {
        interface MessageData {
          roomName: string;
          roomDetails: RoomDetails;
        }
        const messageDataObj = messageData as MessageData;
        const roomName = messageDataObj.roomName;
        const roomDetails = messageDataObj.roomDetails;
        const fbCommand: string = "fb-updating-room-metadata";
        try {
          const room = await updateRoomMetadata(
            roomName,
            JSON.stringify(roomDetails),
          );
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "update-room-metadata",
            fbCommand: fbCommand,
            fbMessage: "Could update room metadata.",
          };
          ws.send(JSON.stringify(wsFb));
        } catch (e) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Error,
            originalCommand: "update-room-metadata",
            fbCommand: fbCommand,
            fbMessage: "Could not update room metadata.",
          };
          ws.send(JSON.stringify(wsFb));
        }
      }
    });
    // Handle connection close
    ws.on("close", async () => {
      console.log(`Connection closed: ${wsClientId}`);

      // Unsubscribe from the client's Redis channel
      await redisSubscriber.unsubscribe(wsClientId);
    });
  },
);

// Subscribe to group channels to broadcast messages
redisSubscriber.subscribe("all-group", (message) => {
  // Broadcast message to all connected WebSocket clients
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      // Broadcast to all-group
      client.send(message);
    }
  });
});
// Use
// redisPublisher.publish(clientId, 'Hello, specific client!');
// redisPublisher.publish('all-group', 'Hello, group members!');

server.on("upgrade", (request, socket, head) => {
  if (request.url === "/ws") {
    wss.handleUpgrade(request, socket, head, (websocket) => {
      wss.emit("connection", websocket, request);
    });
  } else {
    socket.destroy();
  }
});

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

const expressServer = server.listen(PORT, async () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(
    "Redis DB Livekit Version " + await client.get("livekit_version"),
  );
});

export { wss };

/*Async version with unexpected behavior
const getModeratorTokenPermission = (
  user: User,
): [boolean, string?] => {
  let blockAccess: boolean = false;
  let jwtPayloadEmail: string = "";
  if (user.mgmAccessToken === "") {
    blockAccess = true;
  }
  jwt.verify(
    user.mgmAccessToken,
    process.env.JWT_SECRET!,
    (err, email) => {
      if (err) {
        blockAccess = true;
      }
      jwtPayloadEmail = email as string;
    },
  );
  return [blockAccess, jwtPayloadEmail];
};
*/

// Sync version with expected behavior
const getModeratorTokenPermission = (user: User): [boolean, string?] => {
  let blockAccess = false;
  let jwtPayloadEmail: string | undefined;

  if (user.mgmAccessToken == null || user.mgmAccessToken === "") {
    return [true, undefined];
  }

  try {
    const decoded = jwt.verify(
      user.mgmAccessToken,
      process.env.JWT_SECRET!,
    ) as { email?: string };
    jwtPayloadEmail = decoded.email;
  } catch (err) {
    console.log("Error at verifying ws mgmAccessToken: " + err);
    blockAccess = true;
  }

  return [blockAccess, jwtPayloadEmail];
};
