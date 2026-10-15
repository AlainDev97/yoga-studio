import type { Request, Response } from "express";
import { TeacherService } from "../services/teacher.service";

export class TeacherController {
  private readonly teacherService = new TeacherService();

  async getAll(_req: Request, res: Response): Promise<void> {
    const teachers = await this.teacherService.getAll();

    res.status(200).json(teachers);
  }

  async getById(req: Request, res: Response): Promise<void> {
    const teacher = await this.teacherService.getById(String(req.params.id));

    res.status(200).json(teacher);
  }
}
