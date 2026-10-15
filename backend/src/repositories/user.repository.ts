import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export class UserRepository {
  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
    });
  }

  async create(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
  }) {
    return prisma.user.create({
      data: {
        ...data,
        admin: false,
      },
    });
  }

  async findById(id: number) {
    return prisma.user.findUnique({
      where: { id },
    });
  }

  async deleteById(id: number) {
    return prisma.user.delete({
      where: { id },
    });
  }

  async promoteToAdmin(id: number) {
    return prisma.user.update({
      where: { id },
      data: { admin: true },
    });
  }
}
