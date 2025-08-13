# Error Handling Guide

## Overview

This project uses custom HTTP error classes that extend the base Error class to provide better error handling in Node.js applications. These errors are designed to work seamlessly with Express.js middleware and provide structured error responses.

## Custom Error Classes

### BaseHTTPError

Abstract base class for all HTTP errors. Provides common functionality:

- **statusCode**: HTTP status code
- **message**: Error message
- **name**: Error name
- **stack**: Stack trace (captured automatically)
- **toJSON()**: Method for API responses

### Available Error Classes

- `Error400BadRequest` - 400 Bad Request
- `Error401Unauthorized` - 401 Unauthorized
- `Error403Forbidden` - 403 Forbidden
- `Error404NotFound` - 404 Not Found
- `Error500InternalServerError` - 500 Internal Server Error

## Usage Examples

### Basic Usage

```typescript
import { Error400BadRequest, Error401Unauthorized } from './models/errors/custom-errors.js';

// Throw with custom message
throw new Error400BadRequest("Invalid request parameters");

// Throw with default message
throw new Error401Unauthorized(); // Uses "Unauthorized"
```

### In Express Middleware

```typescript
import { NextFunction, Request, Response } from "express";
import { Error401Unauthorized } from './models/errors/custom-errors.js';

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const token = req.headers.authorization;
    
    if (!token) {
        next(new Error401Unauthorized("Authentication token required"));
        return;
    }
    
    // Validate token...
    next();
};
```

### Using Utility Functions

```typescript
import { createHTTPError, isHTTPError } from './models/errors/custom-errors.js';

// Create error by status code
const error = createHTTPError(404, "Resource not found");

// Type guard
if (isHTTPError(someError)) {
    console.log(`HTTP Error: ${someError.statusCode} - ${someError.message}`);
}
```

## Error Handler Middleware

The global error handler in `server.ts` automatically:

- Logs all errors with context (timestamp, URL, method, etc.)
- Returns structured JSON responses
- Handles both custom HTTP errors and generic errors
- Shows stack traces only in development mode
- Sanitizes error messages in production

### Error Response Format

```json
{
  "error": {
    "name": "Error400BadRequest",
    "message": "Invalid request parameters",
    "statusCode": 400,
    "stack": "..." // Only in development
  }
}
```

## Best Practices

1. **Use specific error types**: Choose the most appropriate HTTP status code
2. **Provide clear messages**: Include helpful information for debugging
3. **Pass to next()**: In middleware, always call `next(error)` instead of throwing
4. **Log context**: The error handler automatically logs request context
5. **Environment awareness**: Sensitive information is hidden in production

## Migration from Old Errors

Old pattern:
```typescript
// Old - inconsistent
throw new Error400BadRequest("message", 400); // Wrong constructor
```

New pattern:
```typescript
// New - consistent and improved
throw new Error400BadRequest("message"); // Status code automatic
```

## Features

- ✅ Proper inheritance from Error class
- ✅ Stack trace capture with `Error.captureStackTrace`
- ✅ Consistent constructor patterns
- ✅ Default messages for all error types
- ✅ JSON serialization support
- ✅ TypeScript support with proper typing
- ✅ Environment-aware error handling
- ✅ Comprehensive logging
- ✅ Express.js middleware integration
