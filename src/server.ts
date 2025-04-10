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
  createCustomerRoom,
  createInternalRoom,
  createTokenForCustomerRoomAndParticipant,
  getAllRooms,
  getCustomerRooms,
  setCustomerHeartbeat,
  setModeratorHeartbeat,
} from "./controllers/livekit.js";
import { RoomDetails } from "./models/RoomDetails.js";
import { FbStatus, FbType, WSFeedback } from "./models/ws-feedback.js";

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
          fbType: "test",
          fbMessage: "Test succcessful.",
        };

        ws.send(JSON.stringify(wsFb));
      }

      // Moderator actions
      if (command === "set-moderator-heartbeat") {
        await setModeratorHeartbeat(user.email);
        const wsFb: WSFeedback = {
          fbStatus: FbStatus.Okay,
          originalCommand: "set-moderator-heartbeat",
          fbType: "moderatorHeartbeatSet",
          fbMessage: "Moderator heartbeat set.",
        };

        ws.send(JSON.stringify(wsFb));
      }
      if (command === "protected-moderator-route") {
        const [blockAccess, jwtEmail] = getModeartorTokenPermission(user);

        if (blockAccess) {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "protected-moderator-route",
            fbType: FbType.Error,
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));

          // ws.send(
          //   JSON.stringify({
          //     fbStatus: 403,
          //     message: "Moderator token missing or wrong.",
          //   }),
          // );
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "protected-moderator-route",
            fbType: FbType.MessageResponse,
            fbMessage: "Access allowed.",
          };

          ws.send(JSON.stringify(wsFb));
        }
      }
      if (command === "protected-moderator-create-internal-room") {
        const [blockAccess, jwtEmail] = getModeartorTokenPermission(user);

        if (!blockAccess) {
          const room = await createInternalRoom(undefined);
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "protected-moderator-create-internal-room",
            fbType: "createdRoom",
            fbMessage: "Room created.",
            fbData: JSON.stringify(room),
          };

          ws.send(JSON.stringify(wsFb));

          // ws.send(
          //   JSON.stringify({
          //     fbStatus: 200,
          //     fbCommand: "roomCreated",
          //     fbMessage: "Room created.",
          //     fbData: JSON.stringify(room),
          //   }),
          // );
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "protected-moderator-create-internal-room",
            fbType: FbType.Error,
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));
        }
      }
      if (command === "protected-moderator-get-all-rooms") {
        const [blockAccess, jwtEmail] = getModeartorTokenPermission(user);

        if (!blockAccess) {
          const rooms = await getAllRooms();
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand: "protected-moderator-get-all-rooms",
            fbType: "roomsList",
            fbMessage: "Retrieved all rooms.",
            fbData: JSON.stringify(rooms),
          };

          ws.send(JSON.stringify(wsFb));
        } else {
          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Unauthorized,
            originalCommand: "protected-moderator-get-all-rooms",
            fbType: FbType.Error,
            fbMessage: "Moderator token missing or wrong.",
          };

          ws.send(JSON.stringify(wsFb));
        }
      }

      // End-user & Dealer actions
      switch (command) {
        case "get-customer-room-or-queue-up":
          let numOfCustRooms = (await getCustomerRooms()).length;

          if (numOfCustRooms > 10) {
            // Queued up

            const wsFb: WSFeedback = {
              fbStatus: FbStatus.Okay,
              originalCommand: "get-customer-room-or-queue-up",
              fbType: "queuedUpAtRequestingNewCustomerRoom",
              fbMessage:
                "No customer rooms are available. Wait for a room to become free.",
            };
            ws.send(JSON.stringify(wsFb));
            // ws.send(
            //   JSON.stringify({
            //     fbStatus: 400,
            //     fbCommand: "queued",
            //     fbMessage:
            //       "No customer rooms are available. Wait for a room to become free.", // Implement re-requesting in app side.
            //   }),
            // );
          } else {
            const roomDetails = messageData as RoomDetails;
            console.log(roomDetails);

            const at = await createTokenForCustomerRoomAndParticipant(
              user.name,
              roomDetails.channel,
              roomDetails.department,
              roomDetails.productCategory,
            );

            const wsFb: WSFeedback = {
              fbStatus: FbStatus.Okay,
              originalCommand: "get-customer-room-or-queue-up",
              fbType: "customerRoomTokenCreated",
              fbMessage: "Created new room for customer.",
              fbData: JSON.stringify(at),
            };
            ws.send(JSON.stringify(wsFb));

            // ws.send(
            //   JSON.stringify({
            //     fbStatus: 200,
            //     fbCommand: "customerRoomTokenCreated",
            //     fbMessage: at,
            //   }),
            // );
          }

          break;

        case "set-customer-still-waiting-to-create-room-heartbeat":
          await setCustomerHeartbeat(user.uuid);
          // ws.send(
          //   JSON.stringify({
          //     fbStatus: 200,
          //     fbMessage: "Customer heartbeat set.",
          //   }),
          // );

          const wsFb: WSFeedback = {
            fbStatus: FbStatus.Okay,
            originalCommand:
              "set-customer-still-waiting-to-create-room-heartbeat",
            fbType: "customerHeartbeatSet",
            fbMessage: "Customer heartbeat set.",
          };
          ws.send(JSON.stringify(wsFb));
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

const getModeartorTokenPermission = (
  user: User,
): [boolean, string?] => {
  let blockAccess: boolean = false;
  let jwtPayloadEmail: string = "";
  if (user.moderatorToken === "") {
    blockAccess = true;
  }
  jwt.verify(
    user.moderatorToken,
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
