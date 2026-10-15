import type { Response } from "express";

import type { AuthRequest } from "../middleware/auth.middleware";
import { UserService } from "../services/user.service";

export class UserController {
  private readonly userService = new UserService();

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const user = await this.userService.getById(String(req.params.id));

    res.status(200).json(user);
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    await this.userService.delete(String(req.params.id), req.userId);

    res.status(200).json({
      message: "User deleted successfully",
    });
  }

  async promoteSelfToAdmin(req: AuthRequest, res: Response): Promise<void> {
    const user = await this.userService.promoteSelfToAdmin(req.userId);

    res.status(200).json(user);
  }
}
