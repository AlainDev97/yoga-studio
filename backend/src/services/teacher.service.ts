import { TeacherRepository } from "../repositories/teacher.repository";
import { AppError } from "../utils/AppError";

export class TeacherService {
  private readonly teacherRepository = new TeacherRepository();

  async getAll() {
    return this.teacherRepository.findAll();
  }

  async getById(id: string) {
    if (!id) {
      throw new AppError(400, "Teacher ID is required");
    }

    const teacherId = Number(id);

    if (!Number.isInteger(teacherId) || teacherId <= 0) {
      throw new AppError(400, "Invalid teacher ID");
    }

    const teacher = await this.teacherRepository.findById(teacherId);

    if (!teacher) {
      throw new AppError(404, "Teacher not found");
    }

    return teacher;
  }
}
