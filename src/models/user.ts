export interface User {
    uuid: string;
    name: string;
    email: string;
    userType: UserType;
    status: UserStatus;
}

enum UserType {
    Enduser,
    Moderator,
}

enum UserStatus {
    available,
    offline,
}
