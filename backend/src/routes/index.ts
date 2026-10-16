import { Router } from "express";
import { validateBody } from "../middleware/validate.middleware";
import { CreateSessionSchema, UpdateSessionSchema } from "../dto/session.dto";
import { LoginSchema, RegisterSchema } from "../dto/auth.dto";
import { AuthController } from "../controllers/auth.controller";
import { SessionController } from "../controllers/session.controller";
import { TeacherController } from "../controllers/teacher.controller";
import { UserController } from "../controllers/user.controller";
import { authMiddleware } from "../middleware/auth.middleware";
import { asyncHandler } from "../utils/asyncHandler";

const router = Router();

// Controllers
const authController = new AuthController();
const sessionController = new SessionController();
const teacherController = new TeacherController();
const userController = new UserController();

// Auth routes (public)
router.post(
  "/api/auth/login",
  validateBody(LoginSchema),
  asyncHandler((req, res) => authController.login(req, res)),
);

router.post(
  "/api/auth/register",
  validateBody(RegisterSchema),
  asyncHandler((req, res) => authController.register(req, res)),
);

// Session routes (protected)
router.get(
  "/api/session",
  authMiddleware,
  asyncHandler((req, res) => sessionController.getAll(req, res)),
);

router.get(
  "/api/session/:id",
  authMiddleware,
  asyncHandler((req, res) => sessionController.getById(req, res)),
);

router.post(
  "/api/session",
  authMiddleware,
  validateBody(CreateSessionSchema),
  asyncHandler((req, res) => sessionController.create(req, res)),
);

router.put(
  "/api/session/:id",
  authMiddleware,
  validateBody(UpdateSessionSchema),
  asyncHandler((req, res) => sessionController.update(req, res)),
);

router.delete(
  "/api/session/:id",
  authMiddleware,
  asyncHandler((req, res) => sessionController.delete(req, res)),
);

router.post(
  "/api/session/:id/participate/:userId",
  authMiddleware,
  asyncHandler((req, res) => sessionController.participate(req, res)),
);

router.delete(
  "/api/session/:id/participate/:userId",
  authMiddleware,
  asyncHandler((req, res) => sessionController.unparticipate(req, res)),
);

// Teacher routes (protected)
router.get(
  "/api/teacher",
  authMiddleware,
  asyncHandler((req, res) => teacherController.getAll(req, res)),
);

router.get(
  "/api/teacher/:id",
  authMiddleware,
  asyncHandler((req, res) => teacherController.getById(req, res)),
);

// User routes (protected)
router.get(
  "/api/user/:id",
  authMiddleware,
  asyncHandler((req, res) => userController.getById(req, res)),
);

router.post(
  "/api/user/promote-admin",
  authMiddleware,
  asyncHandler((req, res) => userController.promoteSelfToAdmin(req, res)),
);

router.delete(
  "/api/user/:id",
  authMiddleware,
  asyncHandler((req, res) => userController.delete(req, res)),
);

export default router;
