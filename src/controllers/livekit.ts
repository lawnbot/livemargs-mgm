import { Request, Response } from "express";
import { AccessToken } from "livekit-server-sdk";
import { CreateOptions, Room, RoomServiceClient } from "livekit-server-sdk";
import { wss } from "../server.js";
import { User } from "../models/user.js";
import { Department, RoomChannel, RoomDetails } from "../models/RoomDetails.js";
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

/* export const createStandardToken = async (req: Request, res: Response) => {
    const token: string = await createTokenForRoomAndParticipant(
        "quickstart-room",
        "quickstart-username",
    );
    res.json(token);
}; */

export const getParticipantDetail = async (req: Request, res: Response) => {
    req.body;
    //const participant = await roomService.getParticipant(roomName, identity);

    //res.send(participant.toJsonString);
};

const getRooms = async (): Promise<Room[]> => {
    return await roomService.listRooms();
};

const createCustomerRoom = async (
    roomChannel: RoomChannel | undefined,
    department: Department | undefined,
    productCategory: string,
): Promise<Room> => {
    const currentTime = new Date().toLocaleTimeString();
    // create a new room
    const roomDetails = new RoomDetails(
        roomChannel,
        department,
        productCategory,
    );

    const opts: CreateOptions = {
        name: "CustRoom:" + currentTime.toString(),
        // timeout in seconds
        departureTimeout: 60,
        emptyTimeout: 10 * 60,
        maxParticipants: 20,
        metadata: JSON.stringify(roomDetails),
    };

    return await roomService.createRoom(opts);
};

const createTokenForCustomerRoomAndParticipant = async (
    participantName: string,
    roomChannel: RoomChannel | undefined,
    department: Department | undefined,
    productCategory: string,
) => {
    // If this room doesn't exist, it'll be automatically created when the first
    // participant joins
    // const roomName = 'quickstart-room';
    // // Identifier to be used for participant.
    // // It's available as LocalParticipant.identity with livekit-client SDK
    // const participantName = 'quickstart-username';
    try {
        const createdRoom = await createCustomerRoom(
            roomChannel,
            department,
            productCategory,
        );
        const at = new AccessToken(
            process.env.LIVEKIT_API_KEY,
            process.env.LIVEKIT_API_SECRET,
            {
                identity: participantName,

                // Token to expire after 10 minutes
                ttl: "10m",
            },
        );
        at.addGrant({ roomJoin: true, room: createdRoom.name });

        return await at.toJwt();
    } catch (e) {
    }
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

const broadcastTime = () => {
    const currentTime = new Date().toLocaleTimeString();
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(currentTime);
        }
    });
};

const broadcastActiveModerators = () => {
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                fbStatus: 200,
                fbType: "activeModerators",
                value: getActiveModerators(),
            }));
        }
    });
};

//setInterval(broadcastTime, 3000);
setInterval(broadcastActiveModerators, 10000); // All 10 seconds

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
