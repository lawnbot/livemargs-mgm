export class RoomDetails {
    constructor(
        public channel: RoomChannel | undefined,
        public department: Department | undefined,
        public productCategory: string,
        public requestingHelp: RequestingHelp = RequestingHelp.none,
        public requestingHelpSince: Date | undefined = undefined,
        public roomTitle: string = "",
    ) {
    }
}

// Channel: end-user & dealer, pure internal (for live meetings)
// Department: Sales, CustService
// ProductCategroy: Robotics, OPE
// Limits:
//  - Max. 3 pure AI chat rooms
//  - Max. 1 Sales chat room

export enum RoomChannel {
    Customer = "customer", // Dealer or End-user
    Internal = "internal", //pure internal (for live meetings)
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
