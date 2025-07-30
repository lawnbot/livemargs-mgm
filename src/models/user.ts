export interface User {
    nanoid: string;
    identity: string;
    name: string;
    email: string;
    userType: UserType;
    status: UserStatus;
    mgmAccessToken: string;
}

export enum UserType {
    Enduser = "enduser",
    Dealer = "dealer",
    Moderator = "moderator",
}

export enum UserStatus {
    available,
    occupied,
    offline,
}

// Create PIN and save it in redis to allow to open the room with a different device
// Check mail + PIN for cross device joining
