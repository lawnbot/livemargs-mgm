export interface User {
    uuid: string;
    name: string;
    email: string;
    userType: UserType;
    status: UserStatus;
    moderatorToken: string;
}

enum UserType {
    Enduser,
    Moderator,
}

enum UserStatus {
    available,
    offline,
}

// Create PIN and save it in redis to allow to open the room with a different device
//Check mail + PIN for cross device joining