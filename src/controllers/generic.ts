
import { Request, Response } from "express";

export const healthcheck = async (req: Request, res: Response) => {
    res.json({ 'status': 'Server is online.' });
}