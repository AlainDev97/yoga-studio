import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import type { User } from "@prisma/client";

import { UserService } from "./user.service";
import { UserRepository } from "../repositories/user.repository";

vi.mock("../repositories/user.repository", () => ({
  UserRepository: vi.fn(),
}));

const findById = vi.fn<UserRepository["findById"]>();
const deleteById = vi.fn<UserRepository["deleteById"]>();
const promoteToAdmin = vi.fn<UserRepository["promoteToAdmin"]>();

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

const expectedPublicUser = {
  id: 1,
  email: "test@example.com",
  firstName: "Jean",
  lastName: "Dupont",
  admin: false,
  createdAt: mockUser.createdAt,
  updatedAt: mockUser.updatedAt,
};

describe("UserService", () => {
  let service: UserService;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.resetAllMocks();

    process.env.NODE_ENV = "development";

    vi.mocked(UserRepository).mockImplementation(function () {
      return {
        findById,
        deleteById,
        promoteToAdmin,
      } as unknown as UserRepository;
    });

    service = new UserService();
  });

  afterEach(() => {
    if (originalNodeEnv === undefined) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = originalNodeEnv;
    }
  });

  describe("getById", () => {
    it("retourne les informations publiques d'un utilisateur", async () => {
      findById.mockResolvedValue(mockUser);

      const result = await service.getById("1");

      expect(result).toEqual(expectedPublicUser);
      expect(findById).toHaveBeenCalledWith(1);
    });

    it("ne retourne jamais le mot de passe", async () => {
      findById.mockResolvedValue(mockUser);

      const result = await service.getById("1");

      expect(result).not.toHaveProperty("password");
    });

    it("refuse un identifiant absent", async () => {
      await expect(service.getById("")).rejects.toMatchObject({
        statusCode: 400,
        message: "User ID is required",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("refuse un identifiant non numérique", async () => {
      await expect(service.getById("abc")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });
    });

    it("refuse un identifiant négatif", async () => {
      await expect(service.getById("-1")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });
    });

    it("refuse un identifiant décimal", async () => {
      await expect(service.getById("1.5")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });
    });

    it("retourne 404 si l'utilisateur n'existe pas", async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById("999")).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });
  });

  describe("delete", () => {
    it("permet de supprimer son propre compte", async () => {
      findById.mockResolvedValue(mockUser);
      deleteById.mockResolvedValue(mockUser);

      await service.delete("1", 1);

      expect(findById).toHaveBeenCalledWith(1);
      expect(deleteById).toHaveBeenCalledWith(1);
    });

    it("interdit de supprimer le compte d'un autre utilisateur", async () => {
      await expect(service.delete("2", 1)).rejects.toMatchObject({
        statusCode: 403,
        message: "You can only delete your own account",
      });

      expect(deleteById).not.toHaveBeenCalled();
    });

    it("interdit la suppression sans authentification", async () => {
      await expect(service.delete("1")).rejects.toMatchObject({
        statusCode: 403,
        message: "You can only delete your own account",
      });

      expect(deleteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si le compte n'existe pas", async () => {
      findById.mockResolvedValue(null);

      await expect(service.delete("1", 1)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });

      expect(deleteById).not.toHaveBeenCalled();
    });

    it("refuse un identifiant invalide avant toute suppression", async () => {
      await expect(service.delete("abc", 1)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });

      expect(findById).not.toHaveBeenCalled();
      expect(deleteById).not.toHaveBeenCalled();
    });
  });

  describe("promoteSelfToAdmin", () => {
    it("permet la promotion en environnement development", async () => {
      findById.mockResolvedValue(mockUser);

      promoteToAdmin.mockResolvedValue({
        ...mockUser,
        admin: true,
      });

      const result = await service.promoteSelfToAdmin(1);

      expect(promoteToAdmin).toHaveBeenCalledWith(1);
      expect(result.admin).toBe(true);
      expect(result).not.toHaveProperty("password");
    });

    it("refuse la promotion en production", async () => {
      process.env.NODE_ENV = "production";

      await expect(service.promoteSelfToAdmin(1)).rejects.toMatchObject({
        statusCode: 403,
        message: "Admin self-promotion is only available in development",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("refuse la promotion sans authentification", async () => {
      await expect(service.promoteSelfToAdmin()).rejects.toMatchObject({
        statusCode: 401,
        message: "Unauthorized",
      });
    });

    it("retourne 404 si l'utilisateur n'existe pas", async () => {
      findById.mockResolvedValue(null);

      await expect(service.promoteSelfToAdmin(999)).rejects.toMatchObject({
        statusCode: 404,
        message: "User not found",
      });
    });

    it("ne modifie pas un utilisateur déjà administrateur", async () => {
      findById.mockResolvedValue({
        ...mockUser,
        admin: true,
      });

      const result = await service.promoteSelfToAdmin(1);

      expect(result.admin).toBe(true);
      expect(result).not.toHaveProperty("password");
      expect(promoteToAdmin).not.toHaveBeenCalled();
    });
  });
});
