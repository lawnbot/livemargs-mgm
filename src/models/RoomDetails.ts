export class RoomDetails {
    constructor(
        public channel: RoomChannel | undefined,
        public department: Department | undefined,
        public productCategory: string,
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
    Customer, // Dealer or End-user
    Internal, //pure internal (for live meetings)
}

export enum Department {
    Sales,
    CustomerService,
    Finance,
}
