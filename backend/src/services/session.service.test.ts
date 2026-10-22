import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Prisma, User, Teacher } from "@prisma/client";

import { SessionService } from "./session.service";

const mocks = vi.hoisted(() => ({
  session: {
    findAll: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteById: vi.fn(),
    findParticipation: vi.fn(),
    createParticipation: vi.fn(),
    deleteParticipation: vi.fn(),
  },
  user: {
    findById: vi.fn(),
  },
  teacher: {
    findById: vi.fn(),
  },
}));

vi.mock("../repositories/session.repository", () => ({
  SessionRepository: class {
    findAll = mocks.session.findAll;
    findById = mocks.session.findById;
    create = mocks.session.create;
    update = mocks.session.update;
    deleteById = mocks.session.deleteById;
    findParticipation = mocks.session.findParticipation;
    createParticipation = mocks.session.createParticipation;
    deleteParticipation = mocks.session.deleteParticipation;
  },
}));

vi.mock("../repositories/user.repository", () => ({
  UserRepository: class {
    findById = mocks.user.findById;
  },
}));

vi.mock("../repositories/teacher.repository", () => ({
  TeacherRepository: class {
    findById = mocks.teacher.findById;
  },
}));

type SessionWithRelations = Prisma.SessionGetPayload<{
  include: {
    teacher: true;
    participants: {
      include: {
        user: true;
      };
    };
  };
}>;

const now = new Date("2026-10-01T12:00:00.000Z");

const admin: User = {
  id: 1,
  email: "admin@example.com",
  firstName: "Admin",
  lastName: "Test",
  password: "hashed-password",
  admin: true,
  createdAt: now,
  updatedAt: now,
};

const regularUser: User = {
  ...admin,
  id: 2,
  email: "user@example.com",
  firstName: "Regular",
  admin: false,
};

const teacher: Teacher = {
  id: 3,
  firstName: "Margot",
  lastName: "Delahaye",
  createdAt: now,
  updatedAt: now,
};

const session: SessionWithRelations = {
  id: 10,
  name: "Yoga Vinyasa",
  date: new Date("2026-11-15T00:00:00.000Z"),
  description: "Séance de yoga dynamique",
  teacherId: teacher.id,
  teacher,
  createdAt: now,
  updatedAt: now,
  participants: [
    {
      sessionId: 10,
      userId: regularUser.id,
      user: regularUser,
    },
  ],
};

const createData = {
  name: "Yoga Vinyasa",
  date: "2026-11-15",
  description: "Séance de yoga dynamique",
  teacherId: 3,
};

const expectedSession = {
  id: 10,
  name: "Yoga Vinyasa",
  date: session.date,
  description: "Séance de yoga dynamique",
  teacher: {
    id: 3,
    firstName: "Margot",
    lastName: "Delahaye",
  },
  users: [2],
  createdAt: now,
  updatedAt: now,
};

describe("SessionService", () => {
  let service: SessionService;

  beforeEach(() => {
    vi.resetAllMocks();

    mocks.user.findById.mockImplementation(async (id: number) => {
      if (id === 1) return admin;
      if (id === 2) return regularUser;
      return null;
    });

    mocks.teacher.findById.mockResolvedValue(teacher);
    mocks.session.findById.mockResolvedValue(session);
    mocks.session.findAll.mockResolvedValue([session]);
    mocks.session.create.mockResolvedValue(session);
    mocks.session.update.mockResolvedValue(session);
    mocks.session.findParticipation.mockResolvedValue(null);

    service = new SessionService();
  });

  describe("getAll", () => {
    it("retourne toutes les séances formatées", async () => {
      const result = await service.getAll();

      expect(result).toEqual([expectedSession]);
      expect(mocks.session.findAll).toHaveBeenCalledOnce();
    });

    it("retourne un tableau vide", async () => {
      mocks.session.findAll.mockResolvedValue([]);

      expect(await service.getAll()).toEqual([]);
    });
  });

  describe("getById", () => {
    it("retourne les détails d'une séance", async () => {
      expect(await service.getById("10")).toEqual(expectedSession);
      expect(mocks.session.findById).toHaveBeenCalledWith(10);
    });

    it("refuse un ID absent", async () => {
      await expect(service.getById("")).rejects.toMatchObject({
        statusCode: 400,
        message: "Session ID is required",
      });
    });

    it.each(["abc", "-1", "1.5", "0"])(
      "refuse l'identifiant invalide %s",
      async (id) => {
        await expect(service.getById(id)).rejects.toMatchObject({
          statusCode: 400,
          message: "Invalid session ID",
        });
      },
    );

    it("retourne 404 si la séance n'existe pas", async () => {
      mocks.session.findById.mockResolvedValue(null);

      await expect(service.getById("999")).rejects.toMatchObject({
        statusCode: 404,
        message: "Session not found",
      });
    });
  });

  describe("create", () => {
    it("crée une séance en tant qu'administrateur", async () => {
      const result = await service.create(createData, admin.id);

      expect(result).toEqual(expectedSession);

      expect(mocks.user.findById).toHaveBeenCalledWith(1);
      expect(mocks.teacher.findById).toHaveBeenCalledWith(3);

      expect(mocks.session.create).toHaveBeenCalledWith({
        name: createData.name,
        date: new Date("2026-11-15"),
        description: createData.description,
        teacherId: 3,
      });
    });

    it.each([
      ["name", "Name is required"],
      ["date", "Date is required"],
      ["description", "Description is required"],
      ["teacherId", "Teacher ID is required"],
    ] as const)("refuse une création sans %s", async (field, message) => {
      const invalidData = {
        ...createData,
        [field]: field === "teacherId" ? 0 : "",
      };

      await expect(service.create(invalidData, 1)).rejects.toMatchObject({
        statusCode: 400,
        message,
      });

      expect(mocks.session.create).not.toHaveBeenCalled();
    });

    it("refuse la création sans authentification", async () => {
      await expect(service.create(createData)).rejects.toMatchObject({
        statusCode: 401,
        message: "Unauthorized",
      });
    });

    it("refuse la création d'un utilisateur classique", async () => {
      await expect(
        service.create(createData, regularUser.id),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Admin access required",
      });

      expect(mocks.session.create).not.toHaveBeenCalled();
    });

    it("refuse un professeur inexistant", async () => {
      mocks.teacher.findById.mockResolvedValue(null);

      await expect(service.create(createData, admin.id)).rejects.toMatchObject({
        statusCode: 404,
        message: "Teacher not found",
      });
    });

    it("refuse une date invalide", async () => {
      await expect(
        service.create({ ...createData, date: "invalid-date" }, admin.id),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid session date",
      });
    });
  });

  describe("update", () => {
    it("modifie une séance en tant qu'administrateur", async () => {
      const result = await service.update(
        "10",
        {
          name: "Yoga Hatha",
          description: "Nouvelle description",
          date: "2026-12-01",
          teacherId: 3,
        },
        admin.id,
      );

      expect(result).toEqual(expectedSession);

      expect(mocks.session.update).toHaveBeenCalledWith(10, {
        name: "Yoga Hatha",
        description: "Nouvelle description",
        date: new Date("2026-12-01"),
        teacherId: 3,
      });
    });

    it("accepte une modification partielle", async () => {
      await service.update("10", { name: "Nouveau nom" }, admin.id);

      expect(mocks.session.update).toHaveBeenCalledWith(10, {
        name: "Nouveau nom",
      });
    });

    it("refuse un ID absent", async () => {
      await expect(
        service.update("", { name: "Test" }, 1),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Session ID is required",
      });
    });

    it("refuse un ID invalide", async () => {
      await expect(
        service.update("abc", { name: "Test" }, 1),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid session ID",
      });
    });

    it("refuse un utilisateur non administrateur", async () => {
      await expect(
        service.update("10", { name: "Test" }, 2),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: "Admin access required",
      });
    });

    it("retourne 404 si la séance est absente", async () => {
      mocks.session.findById.mockResolvedValue(null);

      await expect(
        service.update("999", { name: "Test" }, 1),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Session not found",
      });
    });

    it("refuse une date invalide", async () => {
      await expect(
        service.update("10", { date: "invalid-date" }, 1),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid session date",
      });
    });

    it("refuse un professeur inexistant", async () => {
      mocks.teacher.findById.mockResolvedValue(null);

      await expect(
        service.update("10", { teacherId: 999 }, 1),
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Teacher not found",
      });
    });
  });

  describe("delete", () => {
    it("supprime une séance en tant qu'administrateur", async () => {
      await service.delete("10", 1);

      expect(mocks.session.deleteById).toHaveBeenCalledWith(10);
    });

    it("refuse un ID absent", async () => {
      await expect(service.delete("", 1)).rejects.toMatchObject({
        statusCode: 400,
        message: "Session ID is required",
      });
    });

    it("refuse un ID invalide", async () => {
      await expect(service.delete("-1", 1)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid session ID",
      });
    });

    it("refuse la suppression par un utilisateur classique", async () => {
      await expect(service.delete("10", 2)).rejects.toMatchObject({
        statusCode: 403,
        message: "Admin access required",
      });

      expect(mocks.session.deleteById).not.toHaveBeenCalled();
    });

    it("retourne 404 si la séance n'existe pas", async () => {
      mocks.session.findById.mockResolvedValue(null);

      await expect(service.delete("999", 1)).rejects.toMatchObject({
        statusCode: 404,
        message: "Session not found",
      });
    });
  });

  describe("participate", () => {
    it("permet à un utilisateur de participer", async () => {
      await service.participate("10", "2", 2);

      expect(mocks.session.findParticipation).toHaveBeenCalledWith(10, 2);

      expect(mocks.session.createParticipation).toHaveBeenCalledWith(10, 2);
    });

    it("refuse un ID de séance absent", async () => {
      await expect(service.participate("", "2", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: "Session ID is required",
      });
    });

    it("refuse un ID utilisateur invalide", async () => {
      await expect(service.participate("10", "abc", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid user ID",
      });
    });

    it("refuse de participer à la place d'un autre utilisateur", async () => {
      await expect(service.participate("10", "2", 1)).rejects.toMatchObject({
        statusCode: 403,
        message: "You can only manage your own participation",
      });
    });

    it("refuse une séance inexistante", async () => {
      mocks.session.findById.mockResolvedValue(null);

      await expect(service.participate("999", "2", 2)).rejects.toMatchObject({
        statusCode: 404,
        message: "Session not found",
      });
    });

    it("refuse un utilisateur inexistant", async () => {
      mocks.user.findById.mockResolvedValue(null);

      await expect(service.participate("10", "999", 999)).rejects.toMatchObject(
        {
          statusCode: 404,
          message: "User not found",
        },
      );
    });

    it("empêche une double participation", async () => {
      mocks.session.findParticipation.mockResolvedValue({
        sessionId: 10,
        userId: 2,
      });

      await expect(service.participate("10", "2", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: "User already participating in this session",
      });

      expect(mocks.session.createParticipation).not.toHaveBeenCalled();
    });
  });

  describe("unparticipate", () => {
    it("permet à un utilisateur de quitter une séance", async () => {
      mocks.session.findParticipation.mockResolvedValue({
        sessionId: 10,
        userId: 2,
      });

      await service.unparticipate("10", "2", 2);

      expect(mocks.session.deleteParticipation).toHaveBeenCalledWith(10, 2);
    });

    it("refuse un ID de séance invalide", async () => {
      await expect(service.unparticipate("abc", "2", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: "Invalid session ID",
      });
    });

    it("refuse un ID utilisateur absent", async () => {
      await expect(service.unparticipate("10", "", 2)).rejects.toMatchObject({
        statusCode: 400,
        message: "User ID is required",
      });
    });

    it("refuse la désinscription d'un autre utilisateur", async () => {
      await expect(service.unparticipate("10", "2", 1)).rejects.toMatchObject({
        statusCode: 403,
        message: "You can only manage your own participation",
      });
    });

    it("retourne 404 si la participation n'existe pas", async () => {
      await expect(service.unparticipate("10", "2", 2)).rejects.toMatchObject({
        statusCode: 404,
        message: "Participation not found",
      });
    });
  });
});
