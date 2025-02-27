import { Router } from "express";
import { createStandardToken,getParticipantDetail } from "../controllers/livemargs.js";
const router: Router = Router();

router.get("/", createStandardToken);
router.post("/room-participants", createStandardToken);
router.post("/participant-detail", getParticipantDetail);

export { router as livemargsRouter };
