/**
 * Base class for custom HTTP errors
 */
abstract class BaseHTTPError extends Error {
    public readonly statusCode: number;
    public readonly message: string;

    constructor(message: string, statusCode: number) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        
        // Capture stack trace and exclude constructor call from it
        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, this.constructor);
        }
        
        // Set the prototype explicitly to maintain the correct prototype chain
        Object.setPrototypeOf(this, new.target.prototype);
    }

    /**
     * Returns a JSON representation of the error suitable for API responses
     */
    toJSON() {
        return {
            name: this.name,
            message: this.message,
            statusCode: this.statusCode,
            ...(process.env.NODE_ENV === 'development' && { stack: this.stack })
        };
    }
}

class Error400BadRequest extends BaseHTTPError {
    constructor(message: string = "Bad Request") {
        super(message, 400);
        this.name = "Error400BadRequest";
    }
}

class Error401Unauthorized extends BaseHTTPError {
    constructor(message: string = "Unauthorized") {
        super(message, 401);
        this.name = "Error401Unauthorized";
    }
}

class Error403Forbidden extends BaseHTTPError {
    constructor(message: string = "Forbidden") {
        super(message, 403);
        this.name = "Error403Forbidden";
    }
}

class Error404NotFound extends BaseHTTPError {
    constructor(message: string = "Not Found") {
        super(message, 404);
        this.name = "Error404NotFound";
    }
}

class Error500InternalServerError extends BaseHTTPError {
    constructor(message: string = "Internal Server Error") {
        super(message, 500);
        this.name = "Error500InternalServerError";
    }
}

/**
 * Utility function to create HTTP errors based on status code
 */
export function createHTTPError(statusCode: number, message?: string): BaseHTTPError {
    switch (statusCode) {
        case 400:
            return new Error400BadRequest(message);
        case 401:
            return new Error401Unauthorized(message);
        case 403:
            return new Error403Forbidden(message);
        case 404:
            return new Error404NotFound(message);
        case 500:
            return new Error500InternalServerError(message);
        default:
            return new Error500InternalServerError(message || `HTTP Error ${statusCode}`);
    }
}

/**
 * Type guard to check if an error is a BaseHTTPError
 */
export function isHTTPError(error: any): error is BaseHTTPError {
    return error instanceof BaseHTTPError;
}

export { 
    BaseHTTPError,
    Error400BadRequest, 
    Error401Unauthorized, 
    Error403Forbidden,
    Error404NotFound,
    Error500InternalServerError
};
