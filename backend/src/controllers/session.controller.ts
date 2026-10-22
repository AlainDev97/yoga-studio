import { Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import { SessionService } from "../services/session.service";

export class SessionController {
  private readonly sessionService = new SessionService();

  async getAll(_req: AuthRequest, res: Response): Promise<void> {
    const sessions = await this.sessionService.getAll();

    res.status(200).json(sessions);
  }

  async getById(req: AuthRequest, res: Response): Promise<void> {
    const session = await this.sessionService.getById(String(req.params.id));

    res.status(200).json(session);
  }

  async create(req: AuthRequest, res: Response): Promise<void> {
    const session = await this.sessionService.create(req.body, req.userId);

    res.status(201).json(session);
  }

  async update(req: AuthRequest, res: Response): Promise<void> {
    const session = await this.sessionService.update(
      String(req.params.id),
      req.body,
      req.userId,
    );

    res.status(200).json(session);
  }

  async delete(req: AuthRequest, res: Response): Promise<void> {
    await this.sessionService.delete(String(req.params.id), req.userId);

    res.status(200).json({
      message: "Session deleted successfully",
    });
  }

  async participate(req: AuthRequest, res: Response): Promise<void> {
    await this.sessionService.participate(
      String(req.params.id),
      String(req.params.userId),
      req.userId,
    );

    res.status(200).json({
      message: "Successfully joined the session",
    });
  }

  async unparticipate(req: AuthRequest, res: Response): Promise<void> {
    await this.sessionService.unparticipate(
      String(req.params.id),
      String(req.params.userId),
      req.userId,
    );

    res.status(200).json({
      message: "Successfully left the session",
    });
  }
}
