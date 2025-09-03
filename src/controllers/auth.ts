import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import client from "../db/redisClient.js";
import {
    Error401Unauthorized,
    Error403Forbidden,
} from "../models/errors/custom-errors.js";
import { sendMail } from "../mail/mailer.js";
import dotenv from "dotenv";
dotenv.config();

export const testMail = async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };

    await sendMail(
        process.env.SMTP_SENDING_MAIL_ADDRESS ?? "",
        email,
        "Testmail from livemargs-mgm",
        "Test",
    );

    res.send("Could send testmail.");
};

export const sendLoginLink = async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };

    // Ensure just users with a certain domain can become moderators
    if (!email.endsWith(process.env.MODERATOR_ALLOWED_DOMAIN ?? "")) {
        res.status(400).json({ "error": "No allowed domain." });
    }

    const token = jwt.sign({ email }, process.env.JWT_SECRET!, {
        expiresIn: "15m",
    });
    await client.set(`auth:${email}`, token, { EX: 900 }); // 15 minutes

    await sendMail(
        process.env.SMTP_SENDING_MAIL_ADDRESS ?? "",
        email,
        "Your login link",
        `http://localhost:3000/auth/verify?token=${token}`,
    );

    res.send("Login link sent to your email.");
};

export const sendLoginPIN = async (req: Request, res: Response) => {
    const { email } = req.body as { email: string };
    const pin = Math.floor(10000 + Math.random() * 90000).toString(); // Generate a 5-digit PIN

    // Ensure just users with a certain domain can become moderators
    if (!email.endsWith(process.env.MODERATOR_ALLOWED_DOMAIN ?? "")) {
        res.status(400).json({ "error": "No allowed domain." });
    }

    await client.set(`auth:${email}`, pin, { EX: 900 }); // 15 minutes

    await sendMail(
        process.env.SMTP_SENDING_MAIL_ADDRESS ?? "",
        email,
        "Your login PIN",
        `Your login PIN is: ${pin}`,
    );
    res.json({ "message": "Login PIN sent to your email." });
};

export const verifyPIN = async (req: Request, res: Response) => {
    const { email, pin } = req.body as { email: string; pin: string };

    const storedPin = await client.get(`auth:${email}`);
    // console.log("PIN " + pin);
    // console.log("storedPin " + storedPin);

    if (storedPin === pin) {
        const accessToken = jwt.sign({ email }, process.env.JWT_SECRET!, {
            expiresIn: "15m",
        });
        const refreshToken = jwt.sign({ email }, process.env.JWT_SECRET!, {
            expiresIn: "7d",
        });

        await client.set(`refresh:${email}`, refreshToken, {
            EX: 604800,
        }); // Store refresh token for 7 days

        res.json({ accessToken, refreshToken });
    } else {
        res.status(401).json({ "error": "Invalid or expired PIN." }); //.send("Invalid or expired PIN.");
    }
};

export const verifyToken = async (req: Request, res: Response) => {
    const { token } = req.body as { token: string };
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET!) as {
            email: string;
        };
        const storedToken = await client.get(`auth:${payload.email}`);

        if (storedToken === token) {
            const refreshToken = jwt.sign(
                { email: payload.email },
                process.env.JWT_SECRET!,
                { expiresIn: "7d" },
            );
            //await redis.set(`refresh:${payload.email}`, refreshToken, 'EX', 604800); // 7 days
            await client.set(`refresh:${payload.email}`, refreshToken, {
                EX: 604800,
            }); // 7 days

            res.json({ accessToken: token, refreshToken });
        } else {
            res.status(401).json({ "error": "Invalid or expired token." });
        }
    } catch (err) {
        res.status(401).json({ "error": "Invalid token." });
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    const { refreshToken } = req.body;
    try {
        const payload = jwt.verify(refreshToken, process.env.JWT_SECRET!) as {
            email: string;
        };
        const storedRefreshToken = await client.get(`refresh:${payload.email}`);

        if (storedRefreshToken === refreshToken) {
            const newAccessToken = jwt.sign(
                { email: payload.email },
                process.env.JWT_SECRET!,
                { expiresIn: "15m" },
            );
            res.json({ accessToken: newAccessToken });
        } else {
            res.status(401).json({ "error": "Invalid refresh token." });
        }
    } catch (err) {
        res.status(401).json({ "error": "Invalid refresh token." });
    }
};

declare global {
    namespace Express {
        interface Request {
            email: string;
            //password: string;
            user?: string;
        }
    }
}

export function authenticateTokenMiddleWare(
    req: Request,
    res: Response,
    next: NextFunction,
): void {
    const authHeader = req.headers["authorization"];
    //console.log("Auth Header: " + authHeader);
    const token = (authHeader && authHeader.split(" ")[1]) ?? "";
    //console.log("token: " + token);

    if (token === "") {
        next(new Error401Unauthorized("Token not valid"));
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
        
        if (decoded && typeof decoded === 'object' && 'email' in decoded) {
            req.email = decoded.email as string;
            next();
        } else {
            next(new Error401Unauthorized("Token not valid"));
        }
    } catch (err) {
        next(new Error401Unauthorized("Token not valid"));
    }
}

export const testRoute = async (req: Request, res: Response) => {
    res.json({ "status": "accessed" });
};

/*
Sure! The refresh token mechanism is a way to maintain user authentication without requiring them to log in repeatedly. Here's how it works:

### How It Works

1. **Login and Access Token Generation:**
   - When a user logs in (in this case, via a passwordless link), the server generates an **access token** and a **refresh token**.
   - The access token is short-lived (e.g., 15 minutes) and is used to authenticate requests to protected resources.

2. **Using the Access Token:**
   - The client (e.g., a web or mobile app) includes the access token in the headers of requests to access protected resources.
   - The server verifies the access token to ensure the request is authenticated.

3. **Access Token Expiry:**
   - Since the access token is short-lived, it will eventually expire, requiring the user to re-authenticate.

4. **Refreshing the Access Token:**
   - Instead of asking the user to log in again, the client can use the refresh token to obtain a new access token.
   - The client sends the refresh token to a specific endpoint (e.g., `/auth/refresh`).
   - The server verifies the refresh token. If valid, it generates a new access token and sends it back to the client.

5. **Storing Tokens:**
   - The refresh token is typically stored securely on the client side (e.g., in HTTP-only cookies or secure storage).
   - The server stores the refresh token in a database (e.g., Redis) to verify its validity during the refresh process.

### Example Flow

1. **Login:**
   - User logs in and receives an access token and a refresh token.
   - Access token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
   - Refresh token: `dGhpcyBpcyBhIHJlZnJlc2ggdG9rZW4...`

2. **Accessing Protected Resource:**
   - Client sends a request with the access token in the header.
   - `Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

3. **Access Token Expiry:**
   - Access token expires after 15 minutes.

4. **Refreshing the Access Token:**
   - Client sends a request to `/auth/refresh` with the refresh token.
   - Server verifies the refresh token and issues a new access token.

5. **New Access Token:**
   - Client receives the new access token and uses it for subsequent requests.

### Security Considerations

- **Secure Storage:** Store refresh tokens securely to prevent unauthorized access.
- **Token Expiry:** Set appropriate expiry times for both access and refresh tokens.
- **Revocation:** Implement mechanisms to revoke tokens if needed (e.g., user logout or token compromise).

This mechanism helps improve user experience by reducing the need for frequent logins while maintaining security. If you have any more questions or need further details, feel free to ask!
*/

/*
router.get("/login", verifyToken);
router.post("/send-login-link", sendLoginLink);
export const sendLoginLink = async (req: Request, res: Response) => {
    const { email } = req.body;
    const token = Math.random().toString(36).substring(2); // Simple token generation
    await client.set(email, token, { EX: 300 }); // Token expires in 5 minutes

    const loginLink =
        `http://localhost:3000/login?token=${token}&email=${email}`;
    await sendMail(
    process.env.SMTP_SENDING_MAIL_ADDRESS ?? "",
        email,
        "Your login link",
        `Click here to log in: ${loginLink}`,
    );

    res.send("Login link sent to your email.");
};

export const verifyToken = async (req: Request, res: Response) => {
    const { email, token } = req.query;
    const emailStr = email?.toString() ?? '';
    const storedToken = await client.get(emailStr);

    if (token === storedToken) {
        res.send("Token verified. You are logged in!");
    } else {
        res.status(401).send("Invalid or expired token.");
    }
};
*/
