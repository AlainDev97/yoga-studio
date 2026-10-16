import { prisma } from "../config/prisma";

export class TeacherRepository {
  async findAll() {
    return prisma.teacher.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  async findById(id: number) {
    return prisma.teacher.findUnique({
      where: { id },
    });
  }
}
