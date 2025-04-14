/* export class WSFeedback {
    public fbStatus: FbStatus;
    public originalCommand: string;
    public fbType: string;
    public fbMessage: string;
    public fbValue?: number;
    public fbData?: any;

    constructor(
        fbStatus: FbStatus = FbStatus.Undefined,
        originalCommand: string = "",
        fbType: string = "",
        fbMessage: string = "",
        fbValue: number = 0.0,
        fbData: any,
    ) {
        this.fbStatus = fbStatus;
        this.originalCommand = originalCommand;
        this.fbType = fbType;
        this.fbMessage = fbMessage;
        this.fbValue = fbValue;
        this.fbData = fbData;
    }
}
 */

export interface WSFeedback {
    fbStatus: FbStatus;
    originalCommand: string;
    fbType: string;
    fbMessage?: string;
    fbNumberValue?: number;
    fbData?: string;
}
export enum FbStatus {
    Undefined = 0,
    Okay = 200,
    Created = 201,
    Error = 400,
    Unauthorized = 401,
}
export enum FbType {
    Error = "error",
    MessageResponse = "messageResponse",
    NumberResponse = "numberResponse",
    DataResponse = "dataResponse",
}
