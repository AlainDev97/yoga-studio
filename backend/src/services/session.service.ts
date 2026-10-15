import { Prisma } from "@prisma/client";
import { UserRepository } from "../repositories/user.repository";
import { TeacherRepository } from "../repositories/teacher.repository";
import { SessionRepository } from "../repositories/session.repository";
import { AppError } from "../utils/AppError";

const sessionRelations = {
  include: {
    teacher: true,
    participants: {
      include: {
        user: true,
      },
    },
  },
} satisfies Prisma.SessionDefaultArgs;

type SessionWithRelations = Prisma.SessionGetPayload<typeof sessionRelations>;

interface SessionResponse {
  id: number;
  name: string;
  date: Date;
  description: string;
  teacher: {
    id: number;
    firstName: string;
    lastName: string;
  };
  users: number[];
  createdAt: Date;
  updatedAt: Date;
}

interface CreateSessionData {
  name: string;
  date: string;
  description: string;
  teacherId: number;
}

type UpdateSessionData = Partial<CreateSessionData>;

export class SessionService {
  private readonly sessionRepository = new SessionRepository();
  private readonly userRepository = new UserRepository();
  private readonly teacherRepository = new TeacherRepository();

  private toSessionResponse(session: SessionWithRelations): SessionResponse {
    return {
      id: session.id,
      name: session.name,
      date: session.date,
      description: session.description,
      teacher: {
        id: session.teacher.id,
        firstName: session.teacher.firstName,
        lastName: session.teacher.lastName,
      },
      users: session.participants.map((participation) => participation.user.id),
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
    };
  }

  private async ensureAdmin(userId?: number): Promise<void> {
    if (!userId) {
      throw new AppError(401, "Unauthorized");
    }

    const user = await this.userRepository.findById(userId);

    if (!user || !user.admin) {
      throw new AppError(403, "Admin access required");
    }
  }

  private parseId(value: string, label: string): number {
    if (!value) {
      throw new AppError(400, `${label} ID is required`);
    }

    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new AppError(400, `Invalid ${label.toLowerCase()} ID`);
    }

    return id;
  }

  async getAll(): Promise<SessionResponse[]> {
    const sessions = await this.sessionRepository.findAll();

    return sessions.map((session) => this.toSessionResponse(session));
  }

  async getById(id: string): Promise<SessionResponse> {
    if (!id) {
      throw new AppError(400, "Session ID is required");
    }

    const sessionId = Number(id);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new AppError(400, "Invalid session ID");
    }

    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError(404, "Session not found");
    }

    return this.toSessionResponse(session);
  }

  async create(
    data: CreateSessionData,
    userId?: number,
  ): Promise<SessionResponse> {
    const { name, date, description, teacherId } = data;

    if (!name) {
      throw new AppError(400, "Name is required");
    }

    if (!date) {
      throw new AppError(400, "Date is required");
    }

    if (!description) {
      throw new AppError(400, "Description is required");
    }

    if (!teacherId) {
      throw new AppError(400, "Teacher ID is required");
    }

    await this.ensureAdmin(userId);

    const teacher = await this.teacherRepository.findById(teacherId);

    if (!teacher) {
      throw new AppError(404, "Teacher not found");
    }

    const sessionDate = new Date(date);

    if (Number.isNaN(sessionDate.getTime())) {
      throw new AppError(400, "Invalid session date");
    }

    const session = await this.sessionRepository.create({
      name,
      date: sessionDate,
      description,
      teacherId,
    });

    return this.toSessionResponse(session);
  }

  async update(
    id: string,
    data: UpdateSessionData,
    userId?: number,
  ): Promise<SessionResponse> {
    if (!id) {
      throw new AppError(400, "Session ID is required");
    }

    const sessionId = Number(id);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new AppError(400, "Invalid session ID");
    }

    await this.ensureAdmin(userId);

    const existingSession = await this.sessionRepository.findById(sessionId);

    if (!existingSession) {
      throw new AppError(404, "Session not found");
    }

    const updateData: Prisma.SessionUncheckedUpdateInput = {};

    if (data.name) {
      updateData.name = data.name;
    }

    if (data.date) {
      const sessionDate = new Date(data.date);

      if (Number.isNaN(sessionDate.getTime())) {
        throw new AppError(400, "Invalid session date");
      }

      updateData.date = sessionDate;
    }

    if (data.description) {
      updateData.description = data.description;
    }

    if (data.teacherId) {
      const teacher = await this.teacherRepository.findById(data.teacherId);

      if (!teacher) {
        throw new AppError(404, "Teacher not found");
      }

      updateData.teacherId = data.teacherId;
    }

    const session = await this.sessionRepository.update(sessionId, updateData);

    return this.toSessionResponse(session);
  }

  async delete(id: string, userId?: number): Promise<void> {
    if (!id) {
      throw new AppError(400, "Session ID is required");
    }

    const sessionId = Number(id);

    if (!Number.isInteger(sessionId) || sessionId <= 0) {
      throw new AppError(400, "Invalid session ID");
    }

    await this.ensureAdmin(userId);

    const existingSession = await this.sessionRepository.findById(sessionId);

    if (!existingSession) {
      throw new AppError(404, "Session not found");
    }

    await this.sessionRepository.deleteById(sessionId);
  }

  async participate(
    sessionIdParam: string,
    userIdParam: string,
    authenticatedUserId?: number,
  ): Promise<void> {
    const sessionId = this.parseId(sessionIdParam, "Session");
    const userId = this.parseId(userIdParam, "User");

    if (authenticatedUserId !== userId) {
      throw new AppError(403, "You can only manage your own participation");
    }

    const session = await this.sessionRepository.findById(sessionId);

    if (!session) {
      throw new AppError(404, "Session not found");
    }

    const user = await this.userRepository.findById(userId);

    if (!user) {
      throw new AppError(404, "User not found");
    }

    const existingParticipation =
      await this.sessionRepository.findParticipation(sessionId, userId);

    if (existingParticipation) {
      throw new AppError(400, "User already participating in this session");
    }

    await this.sessionRepository.createParticipation(sessionId, userId);
  }

  async unparticipate(
    sessionIdParam: string,
    userIdParam: string,
    authenticatedUserId?: number,
  ): Promise<void> {
    const sessionId = this.parseId(sessionIdParam, "Session");
    const userId = this.parseId(userIdParam, "User");

    if (authenticatedUserId !== userId) {
      throw new AppError(403, "You can only manage your own participation");
    }

    const participation = await this.sessionRepository.findParticipation(
      sessionId,
      userId,
    );

    if (!participation) {
      throw new AppError(404, "Participation not found");
    }

    await this.sessionRepository.deleteParticipation(sessionId, userId);
  }
}
