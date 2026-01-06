import { Router } from "express";
import {
  authenticateTokenMiddleWare,
  refreshJWT,
  sendLoginLink,
  sendLoginPIN,
  testRoute,
  verifyPIN,
  verifyToken,
  testMail
} from "../controllers/auth.js";

const router: Router = Router();

router.post("/login", sendLoginLink);
router.post("/login-by-pin", sendLoginPIN);

router.get("/verify", verifyToken);
router.post("/verify-pin", verifyPIN);

router.post("/refresh", refreshJWT);
router.post("/protected-test-route", authenticateTokenMiddleWare, testRoute);

router.post("/test-mail", testMail);

export { router as authRouter };
