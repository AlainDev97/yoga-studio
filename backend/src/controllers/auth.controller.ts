import type { Request, Response } from "express";

import { AuthService } from "../services/auth.service";

export class AuthController {
  private readonly authService = new AuthService();

  async login(req: Request, res: Response): Promise<void> {
    const result = await this.authService.login(req.body);

    res.status(200).json(result);
  }

  async register(req: Request, res: Response): Promise<void> {
    const result = await this.authService.register(req.body);

    res.status(201).json(result);
  }
}
