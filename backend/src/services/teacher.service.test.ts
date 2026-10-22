import { beforeEach, describe, expect, it, vi } from "vitest";

import { TeacherService } from "./teacher.service";
import { TeacherRepository } from "../repositories/teacher.repository";
import { AppError } from "../utils/AppError";

// On remplace les méthodes du repository par des mocks.
// La vraie base PostgreSQL ne sera pas appelée.
vi.mock("../repositories/teacher.repository", () => ({
  TeacherRepository: vi.fn(),
}));

const teacher = {
  id: 1,
  firstName: "Margot",
  lastName: "Delahaye",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
};

const findAll = vi.fn<TeacherRepository["findAll"]>();
const findById = vi.fn<TeacherRepository["findById"]>();

describe("TeacherService", () => {
  let service: TeacherService;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(TeacherRepository).mockImplementation(function () {
      return {
        findAll,
        findById,
      } as TeacherRepository;
    });

    service = new TeacherService();
  });

  describe("getAll", () => {
    it("retourne tous les professeurs", async () => {
      findAll.mockResolvedValue([teacher]);

      const result = await service.getAll();

      expect(result).toEqual([teacher]);
      expect(findAll).toHaveBeenCalledOnce();
    });

    it("retourne un tableau vide lorsqu'aucun professeur n'existe", async () => {
      findAll.mockResolvedValue([]);

      const result = await service.getAll();

      expect(result).toEqual([]);
    });

    it("propage une erreur du repository", async () => {
      findAll.mockRejectedValue(new Error("Database unavailable"));

      await expect(service.getAll()).rejects.toThrow("Database unavailable");
    });
  });

  describe("getById", () => {
    it("retourne un professeur avec un identifiant valide", async () => {
      findById.mockResolvedValue(teacher);

      const result = await service.getById("1");

      expect(result).toEqual(teacher);
      expect(findById).toHaveBeenCalledWith(1);
    });

    it("retourne une erreur 400 si l'identifiant est absent", async () => {
      await expect(service.getById("")).rejects.toMatchObject({
        statusCode: 400,
        message: "Teacher ID is required",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("retourne une erreur 400 si l'identifiant n'est pas numérique", async () => {
      await expect(service.getById("abc")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid teacher ID",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("retourne une erreur 400 si l'identifiant est négatif", async () => {
      await expect(service.getById("-1")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid teacher ID",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("retourne une erreur 400 si l'identifiant est décimal", async () => {
      await expect(service.getById("1.5")).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid teacher ID",
      });

      expect(findById).not.toHaveBeenCalled();
    });

    it("retourne une erreur 404 si le professeur n'existe pas", async () => {
      findById.mockResolvedValue(null);

      await expect(service.getById("999")).rejects.toMatchObject({
        statusCode: 404,
        message: "Teacher not found",
      });

      expect(findById).toHaveBeenCalledWith(999);
    });

    it("propage une erreur inattendue du repository", async () => {
      findById.mockRejectedValue(new Error("Database unavailable"));

      await expect(service.getById("1")).rejects.toThrow(
        "Database unavailable",
      );
    });
  });
});
