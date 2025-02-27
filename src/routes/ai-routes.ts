import { Request, Response, Router } from "express";

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
