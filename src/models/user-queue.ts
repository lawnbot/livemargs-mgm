import { User } from "./user.js";

export let waitingQueue: User[] = [];

export function addUser(user: User) {
    waitingQueue.push(user);
}

export function removeUser(userUUID: String) {
    waitingQueue.filter((user) => user.uuid !== userUUID);
}

export function getQueuePosition(userUUID: String): number {
    return waitingQueue.findIndex((user) => user.uuid === userUUID) + 1;
}

export function getNextUser(): User | undefined {
    return waitingQueue.shift();
}
