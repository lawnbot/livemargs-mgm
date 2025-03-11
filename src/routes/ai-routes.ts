import { Request, Response, Router } from "express";
import { getAIResult, streamAIResult } from "../controllers/ai.js";
export const aiRoutes = Router();

aiRoutes.post("/calc", (req: Request, res: Response): void => {
    const { a, b } = req.body;

    if (a && b && typeof a === "number" && typeof b === "number") {
        res.json({
            success: true,
            message: a + b,
        });
    } else {
        res.json({
            success: false,
            message: "Missing parameters",
        });
    }
});

aiRoutes.post("/stream-ai", streamAIResult);

aiRoutes.post("/ai-result", getAIResult);
