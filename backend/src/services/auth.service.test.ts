import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";
import bcrypt from "bcrypt";

import { AuthService } from "./auth.service";
import { UserRepository } from "../repositories/user.repository";
import { generateToken } from "../utils/jwt.util";

vi.mock("../repositories/user.repository", () => ({
  UserRepository: vi.fn(),
}));

vi.mock("bcrypt", () => ({
  default: {
    compare: vi.fn(),
    hash: vi.fn(),
  },
}));

vi.mock("../utils/jwt.util", () => ({
  generateToken: vi.fn(),
}));

const findByEmail = vi.fn<UserRepository["findByEmail"]>();
const create = vi.fn<UserRepository["create"]>();

const mockUser: User = {
  id: 1,
  email: "test@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  password: "hashed-password",
  admin: false,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const loginData = {
  email: "test@example.com",
  password: "Password123",
};

const registerData = {
  ...loginData,
  firstName: "Jean",
  lastName: "Dupont",
};

const expectedResponse = {
  id: 1,
  email: "test@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  admin: false,
  token: "fake-jwt-token",
};

describe("AuthService", () => {
  let service: AuthService;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(UserRepository).mockImplementation(function () {
      return {
        findByEmail,
        create,
      } as unknown as UserRepository;
    });

    vi.mocked(generateToken).mockReturnValue("fake-jwt-token");

    service = new AuthService();
  });

  describe("login", () => {
    it("connecte un utilisateur avec des identifiants valides", async () => {
      findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockImplementation(async () => true);

      const result = await service.login(loginData);

      expect(result).toEqual(expectedResponse);
      expect(findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(bcrypt.compare).toHaveBeenCalledWith(
        "Password123",
        "hashed-password",
      );
      expect(generateToken).toHaveBeenCalledWith(1);
    });

    it("conserve le statut administrateur dans la réponse", async () => {
      findByEmail.mockResolvedValue({
        ...mockUser,
        admin: true,
      });
      vi.mocked(bcrypt.compare).mockImplementation(async () => true);

      const result = await service.login(loginData);

      expect(result.admin).toBe(true);
    });

    it("refuse une connexion sans email", async () => {
      await expect(
        service.login({ ...loginData, email: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Email is required",
      });
    });

    it("refuse une connexion sans mot de passe", async () => {
      await expect(
        service.login({ ...loginData, password: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Password is required",
      });
    });

    it("refuse un email non textuel", async () => {
      await expect(
        service.login({
          ...loginData,
          email: 123 as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Email must be a string",
      });
    });

    it("refuse un mot de passe non textuel", async () => {
      await expect(
        service.login({
          ...loginData,
          password: 123 as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Password must be a string",
      });
    });

    it("refuse un compte inexistant", async () => {
      findByEmail.mockResolvedValue(null);

      await expect(service.login(loginData)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid credentials",
      });

      expect(bcrypt.compare).not.toHaveBeenCalled();
    });

    it("refuse un mot de passe incorrect", async () => {
      findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockImplementation(async () => false);

      await expect(service.login(loginData)).rejects.toMatchObject({
        statusCode: 401,
        message: "Invalid credentials",
      });
    });
  });

  describe("register", () => {
    it("crée un utilisateur et retourne un token", async () => {
      findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockImplementation(async () => "hashed-password");
      create.mockResolvedValue(mockUser);

      const result = await service.register(registerData);

      expect(findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(bcrypt.hash).toHaveBeenCalledWith("Password123", 10);

      expect(create).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "hashed-password",
        firstName: "Jean",
        lastName: "Dupont",
      });

      expect(result).toEqual(expectedResponse);
    });

    it("préserve le statut administrateur retourné par le repository", async () => {
      findByEmail.mockResolvedValue(null);
      vi.mocked(bcrypt.hash).mockImplementation(async () => "hashed-password");
      create.mockResolvedValue({
        ...mockUser,
        admin: true,
      });

      const result = await service.register(registerData);

      expect(result.admin).toBe(true);
    });

    it("refuse une inscription sans email", async () => {
      await expect(
        service.register({ ...registerData, email: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Email is required",
      });
    });

    it("refuse une inscription sans mot de passe", async () => {
      await expect(
        service.register({ ...registerData, password: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Password is required",
      });
    });

    it("refuse une inscription sans prénom", async () => {
      await expect(
        service.register({ ...registerData, firstName: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "First name is required",
      });
    });

    it("refuse une inscription sans nom", async () => {
      await expect(
        service.register({ ...registerData, lastName: "" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Last name is required",
      });
    });

    it("refuse un email ou mot de passe de type incorrect", async () => {
      await expect(
        service.register({
          ...registerData,
          email: 123 as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid email or password",
      });
    });

    it("refuse un prénom ou nom de type incorrect", async () => {
      await expect(
        service.register({
          ...registerData,
          firstName: 123 as unknown as string,
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid first or last name",
      });
    });

    it("refuse un mot de passe trop court", async () => {
      await expect(
        service.register({
          ...registerData,
          password: "1234567",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Password must be at least 8 characters",
      });
    });

    it("refuse une adresse email déjà utilisée", async () => {
      findByEmail.mockResolvedValue(mockUser);

      await expect(service.register(registerData)).rejects.toMatchObject({
        statusCode: 400,
        message: "Email already exists",
      });

      expect(create).not.toHaveBeenCalled();
    });

    it("propage une erreur du repository", async () => {
      findByEmail.mockRejectedValue(new Error("Database unavailable"));

      await expect(service.register(registerData)).rejects.toThrow(
        "Database unavailable",
      );
    });
  });
});
