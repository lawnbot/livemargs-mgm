import dotenv from "dotenv";
import { createServer } from "http";
import express, { Application, NextFunction, Request, Response } from "express";
import { BaseHTTPError } from "../models/errors/custom-errors.js";
import cors from "cors";
import helmet from "helmet";
import { fileManagementRoutes } from "../routes/file-mgm-routes.js";

// Initialize dotenv to load environment variables from .env file
dotenv.config();
const app: Application = express();
// const server = createServer(app);

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cors());
app.use(helmet());


app.use(fileManagementRoutes);
app.use(errorHandler);

function errorHandler(
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    console.error("Error occurred:", {
        name: err.name,
        message: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method,
        timestamp: new Date().toISOString(),
    });

    // Handle custom HTTP errors
    if (err instanceof BaseHTTPError) {
        res.status(err.statusCode).json({
            error: {
                name: err.name,
                message: err.message,
                statusCode: err.statusCode,
                ...(process.env.NODE_ENV === "development" &&
                    { stack: err.stack }),
            },
        });
        return;
    }

    // Handle other errors
    const statusCode = 500;
    const message = process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err.message;

    res.status(statusCode).json({
        error: {
            name: "InternalServerError",
            message: message,
            statusCode: statusCode,
            ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
        },
    });
}

const expressServer = app.listen(PORT, async () => {
    console.log(`Server listening on port ${PORT}`);
});
