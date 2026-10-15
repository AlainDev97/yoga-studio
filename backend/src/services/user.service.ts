import type { User } from "@prisma/client";

import { UserRepository } from "../repositories/user.repository";
import { AppError } from "../utils/AppError";

type PublicUser = Omit<User, "password">;

export class UserService {
  private readonly userRepository = new UserRepository();

  private toPublicUser(user: User): PublicUser {
    const { password: _password, ...publicUser } = user;
    return publicUser;
  }

  private parseUserId(id: string): number {
    if (!id) {
      throw new AppError(400, "User ID is required");
    }

    const userId = Number(id);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(400, "Invalid user ID");
    }

    return userId;
  }

  async getById(id: string): Promise<PublicUser> {
    const userId = this.parseUserId(id);

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    return this.toPublicUser(user);
  }

  async delete(id: string, authenticatedUserId?: number): Promise<void> {
    const userId = this.parseUserId(id);

    if (authenticatedUserId !== userId) {
      throw new AppError(403, "You can only delete your own account");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    await this.userRepository.deleteById(userId);
  }

  async promoteSelfToAdmin(authenticatedUserId?: number): Promise<PublicUser> {
    const isDev = (process.env.NODE_ENV || "development") === "development";

    if (!isDev) {
      throw new AppError(
        403,
        "Admin self-promotion is only available in development",
      );
    }

    if (!authenticatedUserId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await this.userRepository.findById(authenticatedUserId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    if (user.admin) {
      return this.toPublicUser(user);
    }

    const updatedUser = await this.userRepository.promoteToAdmin(user.id);

    return this.toPublicUser(updatedUser);
  }
}
