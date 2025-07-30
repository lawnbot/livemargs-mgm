import { User } from "./user.js";

export let waitingQueue: User[] = [];

export function addUser(user: User) {
    waitingQueue.push(user);
}

export function removeUser(nanoID: String) {
    waitingQueue.filter((user) => user.nanoid !== nanoID);
}

export function getQueuePosition(nanoID: String): number {
    return waitingQueue.findIndex((user) => user.nanoid === nanoID) + 1;
}

export function getNextUser(): User | undefined {
    return waitingQueue.shift();
}
