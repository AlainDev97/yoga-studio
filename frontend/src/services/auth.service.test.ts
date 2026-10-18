import { beforeEach, describe, expect, it, vi } from "vitest";

import api from "./api";
import { authService } from "./auth.service";
import type { AuthResponse, LoginCredentials, RegisterData } from "../types";

vi.mock("./api", () => ({
  default: {
    post: vi.fn(),
  },
}));

const mockAuthResponse: AuthResponse = {
  id: 1,
  email: "test@example.com",
  firstName: "Test",
  lastName: "User",
  admin: false,
  token: "fake-jwt-token",
};

describe("authService", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    localStorage.clear();
  });

  describe("login", () => {
    const credentials: LoginCredentials = {
      email: "test@example.com",
      password: "Password123",
    };

    it("connecte un utilisateur et enregistre ses informations", async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: mockAuthResponse,
      });

      const result = await authService.login(credentials);

      expect(api.post).toHaveBeenCalledWith("/auth/login", credentials);

      expect(result).toEqual(mockAuthResponse);
      expect(localStorage.getItem("token")).toBe("fake-jwt-token");
      expect(JSON.parse(localStorage.getItem("user")!)).toEqual(
        mockAuthResponse,
      );
    });

    it("n'enregistre rien si la réponse ne contient pas de token", async () => {
      const response = { ...mockAuthResponse, token: "" };

      vi.mocked(api.post).mockResolvedValue({
        data: response,
      });

      const result = await authService.login(credentials);

      expect(result).toEqual(response);
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("propage une erreur de connexion", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Invalid credentials"));

      await expect(authService.login(credentials)).rejects.toThrow(
        "Invalid credentials",
      );

      expect(localStorage.getItem("token")).toBeNull();
    });
  });

  describe("register", () => {
    const registerData: RegisterData = {
      firstName: "Test",
      lastName: "User",
      email: "test@example.com",
      password: "Password123",
    };

    it("inscrit un utilisateur et sauvegarde son authentification", async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: mockAuthResponse,
      });

      const result = await authService.register(registerData);

      expect(api.post).toHaveBeenCalledWith("/auth/register", registerData);

      expect(result).toEqual(mockAuthResponse);
      expect(localStorage.getItem("token")).toBe("fake-jwt-token");
      expect(authService.getCurrentUser()).toEqual(mockAuthResponse);
    });

    it("n'enregistre rien si l'inscription ne renvoie pas de token", async () => {
      vi.mocked(api.post).mockResolvedValue({
        data: { ...mockAuthResponse, token: "" },
      });

      await authService.register(registerData);

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });

    it("propage une erreur d'inscription", async () => {
      vi.mocked(api.post).mockRejectedValue(new Error("Email already exists"));

      await expect(authService.register(registerData)).rejects.toThrow(
        "Email already exists",
      );
    });
  });

  describe("logout", () => {
    it("supprime le token et les informations utilisateur", () => {
      localStorage.setItem("token", "fake-jwt-token");
      localStorage.setItem("user", JSON.stringify(mockAuthResponse));

      authService.logout();

      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("getCurrentUser", () => {
    it("retourne l'utilisateur enregistré", () => {
      localStorage.setItem("user", JSON.stringify(mockAuthResponse));

      expect(authService.getCurrentUser()).toEqual(mockAuthResponse);
    });

    it("retourne null si aucun utilisateur n'est enregistré", () => {
      expect(authService.getCurrentUser()).toBeNull();
    });
  });

  describe("updateCurrentUser", () => {
    it("met à jour les informations sans perdre les autres propriétés", () => {
      localStorage.setItem("user", JSON.stringify(mockAuthResponse));

      const result = authService.updateCurrentUser({
        admin: true,
      });

      expect(result).toEqual({
        ...mockAuthResponse,
        admin: true,
      });

      expect(authService.getCurrentUser()?.admin).toBe(true);
      expect(authService.getToken()).toBeNull();
    });

    it("retourne null si aucun utilisateur n'est enregistré", () => {
      expect(authService.updateCurrentUser({ admin: true })).toBeNull();

      expect(localStorage.getItem("user")).toBeNull();
    });
  });

  describe("getToken", () => {
    it("retourne le token enregistré", () => {
      localStorage.setItem("token", "fake-jwt-token");

      expect(authService.getToken()).toBe("fake-jwt-token");
    });

    it("retourne null lorsqu'aucun token n'existe", () => {
      expect(authService.getToken()).toBeNull();
    });
  });

  describe("isAuthenticated", () => {
    it("retourne true si un token existe", () => {
      localStorage.setItem("token", "fake-jwt-token");

      expect(authService.isAuthenticated()).toBe(true);
    });

    it("retourne false si aucun token n'existe", () => {
      expect(authService.isAuthenticated()).toBe(false);
    });
  });
});
