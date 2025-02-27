interface CustomRoomDetails {
    channel: RoomChannel;
    department: Department;
    productCategory: string;
}

// Channel: end-user & dealer, pure internal (for live meetings)
// Department: Sales, CustService
// ProductCategroy: Robotics, OPE
// Limits:
//  - Max. 3 pure AI chat rooms
//  - Max. 1 Sales chat room

enum RoomChannel {
    EndUser,
    Internal, //pure internal (for live meetings)
}

enum Department {
    Sales,
    CustomerService,
    Finance
}
