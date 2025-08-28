export class RoomDetails {
    constructor(
        public channel: RoomChannel,
        public department: Department | undefined,
        public productCategory: string,
        public requestingHelp: RequestingHelp = RequestingHelp.none,
        public requestingHelpSince: Date | undefined = undefined,
        public roomName: string ="",
        public roomTitle: string = "",
        public ticketStatus: TicketStatus,
        public belongingUserIdentity: string = "",
        public privateRoom: boolean = false, // Whether to track history
    ) {
    }
}

export interface RoomDetailsSchema extends RoomDetails {
    
    expiresAt: Date;
}

// Channel: end-user & dealer, pure internal (for live meetings)
// Department: Sales, CustService
// ProductCategroy: Robotics, OPE
// Limits:
//  - Max. 3 pure AI chat rooms
//  - Max. 1 Sales chat room

export enum RoomChannel {
    Internal = 0, //pure internal (for live meetings)
    Customer = 1, // Dealer or End-user
}

export enum Department {
    Sales = "sales",
    CustomerService = "customerService",
    Finance = "finance",
}

export enum RequestingHelp {
    none = 0,
    std = 1,
    byManager = 2,
}

export enum TicketStatus {
    open = 0,
    waitingOnFeedback = 1,
    closed = 2,
}
