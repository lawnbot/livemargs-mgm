import { Router } from "express";
import {
  authenticateTokenMiddleWare,
  refreshToken,
  sendLoginLink,
  sendLoginPIN,
  testRoute,
  verifyPIN,
  verifyToken,
} from "../controllers/auth.js";

const router: Router = Router();

router.post("/login", sendLoginLink);
router.post("/login-by-pin", sendLoginPIN);

router.get("/verify", verifyToken);
router.post("/verify-pin", verifyPIN);

router.post("/refresh", refreshToken);
router.post("/protected-test-route", authenticateTokenMiddleWare, testRoute);

export { router as authRouter };
