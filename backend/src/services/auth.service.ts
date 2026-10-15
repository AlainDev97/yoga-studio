import bcrypt from "bcrypt";
import type { User } from "@prisma/client";

import { UserRepository } from "../repositories/user.repository";
import { AppError } from "../utils/AppError";
import { generateToken } from "../utils/jwt.util";

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData extends LoginData {
  firstName: string;
  lastName: string;
}

interface AuthResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  admin: boolean;
  token: string;
}

export class AuthService {
  private readonly userRepository = new UserRepository();

  private buildAuthResponse(user: User): AuthResponse {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      admin: user.admin,
      token: generateToken(user.id),
    };
  }

  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password } = data;

    if (!email) {
      throw new AppError(400, "Email is required");
    }

    if (!password) {
      throw new AppError(400, "Password is required");
    }

    if (typeof email !== "string") {
      throw new AppError(400, "Email must be a string");
    }

    if (typeof password !== "string") {
      throw new AppError(400, "Password must be a string");
    }

    const user = await this.userRepository.findByEmail(email);

    if (!user) {
      throw new AppError(401, "Invalid credentials");
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new AppError(401, "Invalid credentials");
    }

    return this.buildAuthResponse(user);
  }

  async register(data: RegisterData): Promise<AuthResponse> {
    const { email, password, firstName, lastName } = data;

    if (!email) {
      throw new AppError(400, "Email is required");
    }

    if (!password) {
      throw new AppError(400, "Password is required");
    }

    if (!firstName) {
      throw new AppError(400, "First name is required");
    }

    if (!lastName) {
      throw new AppError(400, "Last name is required");
    }

    if (typeof email !== "string" || typeof password !== "string") {
      throw new AppError(400, "Invalid email or password");
    }

    if (typeof firstName !== "string" || typeof lastName !== "string") {
      throw new AppError(400, "Invalid first or last name");
    }

    if (password.length < 8) {
      throw new AppError(400, "Password must be at least 8 characters");
    }

    const existingUser = await this.userRepository.findByEmail(email);

    if (existingUser) {
      throw new AppError(400, "Email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      firstName,
      lastName,
    });

    return this.buildAuthResponse(user);
  }
}
