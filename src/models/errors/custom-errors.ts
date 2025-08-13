class Error400BadRequest extends Error {
    constructor(message: string) {
        super(message); // Call the constructor of the base class `Error`
        this.name = "Error400BadRequest"; // Set the error name to your custom error class name
        // Set the prototype explicitly to maintain the correct prototype chain
        Object.setPrototypeOf(this, Error400BadRequest.prototype);
    }
}

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

export { Error400BadRequest, Error401Unauthorized, Error403Forbidden };
