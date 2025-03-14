import { Request, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { CreateOptions, Room, RoomServiceClient } from "livekit-server-sdk";
import { wss } from "../server.js";
import { User } from "../models/user.js";
import {
    addUser,
    getNextUser,
    getQueuePosition,
    removeUser,
    waitingQueue,
} from "../models/user-queue.js";
import client from "../db/redis-client.js";

const livekitHost = process.env.LIVEKIT_HOST ?? "";
const roomService = new RoomServiceClient(
    livekitHost,
    process.env.LIVEKIT_API_KEY,
    process.env.LIVEKIT_API_SECRET,
);

/*

Channel: end-user & dealer, pure internal (for live meetings)
Area: Sales, CustService
Department: Robotics, OPE
Limits:
 - Max. 3 pure AI chat rooms
 - Max. 1 Sales chat room

Process desc

Moderator decides when to end-users a room is
Idea 1
End-user select AI help or personal help
Add option to askfor personal help later

Idea 2

If no moderators are available.
Show Personal service is not available with regular office times
Personal service times mean Last Activitiy of any logged in moderator is max 10 minutes old.

End-user goes in AI chatroom automatically if available max 3. Ask personal help if needed.
If personal help requested Show "Wir haben einen Platz bereits für Sie reserviert. Helfen Sie uns das Thema festzulegen, dass der richtige Kollge sich mit Ihnen verbindet."
Area and department is determined.

Can play in room as long as he wants with AI.
If personal help is asked own position is determined and Number on waiting list is showed.

If no moderators are available. Show Personal service is not available

Moderator see the chaat room list and names which are available

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

*/

export const createStandardToken = async (req: Request, res: Response) => {
    const token: string = await createTokenForRoomAndParticipant(
        "quickstart-room",
        "quickstart-username",
    );
    res.send(token);
};

export const getParticipantDetail = async (req: Request, res: Response) => {
    req.body;
    //const participant = await roomService.getParticipant(roomName, identity);

    //res.send(participant.toJsonString);
};

const getRooms = async () => {
    const rooms: Room[] = await roomService.listRooms();
};

const createRoom = async () => {
    // create a new room
    const opts: CreateOptions = {
        name: "myroom",
        // timeout in seconds
        emptyTimeout: 10 * 60,
        maxParticipants: 20,
        metadata: "",
    };
    await roomService.createRoom(opts);
};
const createTokenForRoomAndParticipant = async (
    roomName: string,
    participantName: string,
) => {
    // If this room doesn't exist, it'll be automatically created when the first
    // participant joins
    // const roomName = 'quickstart-room';
    // // Identifier to be used for participant.
    // // It's available as LocalParticipant.identity with livekit-client SDK
    // const participantName = 'quickstart-username';

    const at = new AccessToken(
        process.env.LIVEKIT_API_KEY,
        process.env.LIVEKIT_API_SECRET,
        {
            identity: participantName,
            // Token to expire after 10 minutes
            ttl: "10m",
        },
    );
    at.addGrant({ roomJoin: true, room: roomName });

    return await at.toJwt();
};

//websocketServer.clients.forEach()
function broadcastQueuePositions() {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(
                JSON.stringify({
                    type: "update",
                    queue: waitingQueue.map((user) => ({
                        id: user.uuid,
                        position: getQueuePosition(user.uuid),
                    })),
                }),
            );
        }
    });
}
function broadcastAvailabilityOfModerators() {
    wss.clients.forEach((client) => {
        if (client.readyState === client.OPEN) {
            client.send(
                JSON.stringify({
                    type: "moderator-is-available-update",
                }),
            );
        }
    });
}

const broadcastTime = () => {
    const currentTime = new Date().toLocaleTimeString();
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(currentTime);
        }
    });
};

setInterval(broadcastTime, 3000);

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
async function setModeratorHeartbeat(email: string) {
    client.set(`moderator:heartbeat:${email}`, Date.now(), { EX: 600 }); // 10 minutes
}

async function getActiveModerators(email: string): Promise<number> {
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
