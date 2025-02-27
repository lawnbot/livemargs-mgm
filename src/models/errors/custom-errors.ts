class Error401Unauthorized extends Error {
    constructor(message: string) {
        super(message); // Call the constructor of the base class `Error`
        this.name = "Error401Unauthorized"; // Set the error name to your custom error class name
        // Set the prototype explicitly to maintain the correct prototype chain
        Object.setPrototypeOf(this, Error401Unauthorized.prototype);
    }
}

class Error403Forbidden extends Error {
    constructor(message: string) {
        super(message); // Call the constructor of the base class `Error`
        this.name = "Error403Forbidden"; // Set the error name to your custom error class name
        // Set the prototype explicitly to maintain the correct prototype chain
        Object.setPrototypeOf(this, Error403Forbidden.prototype);
    }
}

export { Error401Unauthorized, Error403Forbidden };
