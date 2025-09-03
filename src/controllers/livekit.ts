import { Request, Response } from "express";
import {
    AccessToken,
    DataPacket_Kind,
    ParticipantInfo,
    ParticipantPermission,
} from "livekit-server-sdk";
import { CreateOptions, Room, RoomServiceClient } from "livekit-server-sdk";
import { customAlphabet } from "nanoid";
import { wss } from "../server.js";
import { User, UserType } from "../models/user.js";
import { FbStatus, WSFeedback } from "../models/ws-feedback.js";
import { RoomChannel, RoomDetails } from "../models/room-details.js";
import {
    addUser,
    getNextUser,
    getQueuePosition,
    removeUser,
    waitingQueue,
} from "../models/user-queue.js";
import client from "../db/redisClient.js";
import { ChatMessage } from "../models/chat-message.js";

const livekitHost = process.env.LIVEKIT_HOST ?? "";
const roomService = new RoomServiceClient(
    livekitHost,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
);

const alphabet =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
//Nano ID Collision Calculator https://zelark.github.io/nano-id-cc/
const nanoid = customAlphabet(alphabet, 9);

/*

Channel: end-user & dealer, pure internal (for live meetings
By channel class with

Product Category: Robotics, OPE
Department: Sales, CustService

Limit of rooms is defined by number of available moderators.

Process desccription

Room management

Idea 1
End-user selects firstly AI help or personal help
Add an option to ask for personal help later
Once clicked on personal help the user is in the queue.

Idea 2
MUST HAVE FEATURES
- Cross device joining. Multiple devices of the same user. Therefor create a Code of 5 digits. More secure with email.

Description of process
Dealer & End-user Room is directly created if no limits are exceeded. Otherwise user needs to wait until rooms are available again.

End-user goes in AI chatroom automatically no limits are exceeded. Show Buttons "Try AI" or "Ask personal help" if needed.
If personal help requested Show "Wir haben einen Platz bereits für Sie reserviert. Helfen Sie uns das Thema festzulegen, dass der richtige Kollge sich mit Ihnen verbindet."
Area and department is determined.

If no moderators are available.
show directly personal service is not available with regular office times.
Personal service times mean Last Activitiy of any logged in moderator is max 10 minutes old.


Can play in room as long as he wants with AI.
If personal help is asked own position is determined and Number on waiting list is showed.

If no moderators are available. Show Personal service is not available

Moderator see the chat room list and names which are available
He sees the order in the room list (with personal help required ) and decides independently of the waiting list which room he joins next
to fulfill urgent cases.

If Moderator not joined he sees which room ask for personal help.
In praxis room is always created.


Challenges: determine number of available moderators. Keep Wss connection. Send all 10 seconds a presence sign of a moderator.
Get notified once a room is left. Idea: Moderator leaves the room and releases with that a place in a personal chatroom.
Alternatively manuel Status change and automatic status change once 5 minutes no heartbeat /mousemove happened.
What happens if more work is still to do after leave??? No automatic releease should be done for such cases
Manual join is best.

WSS for
 Send all 10 seconds a presence sign of a moderator.
 Show moderator availabilty in room channel EndUser.
  If not available show regular service times of our office
 Automatic status update of the qeue.

Implementation
User is identified in a device with a uuid

*/

export const getParticipantDetail = async (req: Request, res: Response) => {
    req.body;
    //const participant = await roomService.getParticipant(roomName, identity);

    //res.send(participant.toJsonString);
};

export const sendChatMessageData = async (
    roomName: string,
    cm: ChatMessage,
    isChunk: boolean,
) => {
    const strData = JSON.stringify({ chatMessage: cm, isChunk: isChunk });
    const encoder = new TextEncoder();
    const data = encoder.encode(strData);

    await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
        topic: "lm-chat",
    });
};

export const notifyRoomParticpantsAboutNewUpload = async (
    roomName: string,
    cm: ChatMessage,
) => {
    try {
        // Validate inputs
        if (!roomName || !cm) {
            console.error(
                "Invalid parameters for notifyRoomParticpantsAboutNewUpload:",
                {
                    roomName,
                    chatMessage: cm,
                },
            );
            return;
        }

        // Check if room exists
        const rooms = await roomService.listRooms();
        const roomExists = rooms.some((room) => room.name === roomName);

        if (!roomExists) {
            console.error(`Room ${roomName} does not exist`);
            return;
        }

        const strData = JSON.stringify({ chatMessage: cm, isChunk: false });
        const encoder = new TextEncoder();
        const data = encoder.encode(strData);

        await roomService.sendData(roomName, data, DataPacket_Kind.RELIABLE, {
            topic: "lm-chat",
        });

        console.log(`Successfully sent chat message to room ${roomName}`);
    } catch (error) {
        console.error("Failed to notify room participants about new upload:", {
            roomName,
            error: error instanceof Error ? error.message : String(error),
            stack: error instanceof Error ? error.stack : undefined,
            chatMessage: cm,
        });
        // Don't throw the error to prevent breaking the upload flow
    }
};

export const updateParticipant = async (
    room: string,
    identity: string,
    metadata?: string,
    permission?: Partial<ParticipantPermission>,
    name?: string,
): Promise<ParticipantInfo> => {
    return await roomService.updateParticipant(
        room,
        identity,
        metadata,
        permission,
        name,
    );
};

export const listRoomParticipants = async (
    roomName: string,
): Promise<ParticipantInfo[]> => {
    return await roomService.listParticipants(roomName);
};

export const getParticipantInfo = async (
    roomName: string,
    identity: string,
): Promise<ParticipantInfo> => {
    return await roomService.getParticipant(roomName, identity);
};

export const getAllRooms = async (): Promise<Room[]> => {
    return await roomService.listRooms();
};

export const updateRoomMetadata = async (
    room: string,
    metadata: string,
): Promise<Room> => {
    return await roomService.updateRoomMetadata(room, metadata);
};

export const getCustomerRooms = async (): Promise<Room[]> => {
    const rooms = await roomService.listRooms();
    return rooms.filter((el) => {
        const rd = JSON.parse(el.metadata) as RoomDetails;
        return rd.channel == RoomChannel.Customer;
    });
};

export const createRoom = async (
    roomDetails: RoomDetails,
    roomName?: string,
): Promise<Room> => {
    const opts: CreateOptions = {
        name: roomName != null && roomName != undefined
            ? roomName
            : roomDetails.channel == RoomChannel.Internal
            ? RoomChannel.Internal.toString() + nanoid(9)
            : RoomChannel.Customer.toString() + nanoid(9),
        // timeout in seconds
        departureTimeout: 30,
        //emptyTimeout: 10 * 60,
        //maxParticipants: 10,

        metadata: JSON.stringify(roomDetails),
    };

    return await roomService.createRoom(opts);
};

export const createAccessTokenForRoom = async (
    roomName: string,
    user: User,
    hasModeratorAccess: boolean = false,
): Promise<string> => {
    try {
        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: user.identity, // MUST NOT BE NULL OR EMPTY. Otherwise no tokens are generated.
                name: user.name,

                // Token to expire after 10 minutes
                //ttl: "10m",
                ttl: process.env.LIVEKIT_ACCESS_TOKEN_LIFETIME,
            },
        );
        at.addGrant({
            roomCreate: true, //Allow to create rooms as as someone meight want to recover a historic room.
            roomJoin: true,
            room: roomName,
            roomList: hasModeratorAccess,
            roomRecord: hasModeratorAccess,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
            canUpdateOwnMetadata: true,
            canSubscribeMetrics: true,
        });

        return await at.toJwt();
    } catch (e) {
        return "";
    }
};

const broadcastActiveModerators = async () => {
    wss.clients.forEach(async (client) => {
        if (client.readyState === WebSocket.OPEN) {
            const wsFb: WSFeedback = {
                fbStatus: FbStatus.Okay,
                originalCommand: "none",
                fbCommand: "active-moderators",
                fbNumberValue: await getActiveModerators(),
            };

            client.send(JSON.stringify(wsFb));
        }
    });
};

// working
const interval1 = setInterval(() => {
    broadcastActiveModerators();
}, 10000);

//meetingRoomAvailable &&
function checkQueue() {
    if (waitingQueue.length > 0) {
        const nextUser = getNextUser();
        //meetingRoomAvailable = false;
        console.log(`User ${nextUser?.name} can enter the meeting room`);
        // Simulate meeting room being used for 5 seconds
        setTimeout(() => {
            //meetingRoomAvailable = true;
            checkQueue();
        }, 5000);
    }
}
export async function setModeratorHeartbeat(email: string) {
    client.set(`moderator:heartbeat:${email}`, Date.now(), { EX: 600 }); // 10 minutes
}

export async function setCustomerHeartbeat(uuid: string) {
    client.set(`customer:heartbeat:${uuid}`, Date.now(), { EX: 300 }); // 5 minutes
}

async function getActiveModerators(): Promise<number> {
    let result: string[] = [];
    for await (
        const key of client.scanIterator({
            TYPE: "string", // `SCAN` only
            MATCH: "moderator:heartbeat:*",
            COUNT: 100,
        })
    ) {
        // use the key!
        const k = await client.get(key);
        let curr: string = k?.toString() ?? "";
        if (curr !== "") {
            result.push(curr);
            console.log(k);
        }
    }
    return result.length;
}
