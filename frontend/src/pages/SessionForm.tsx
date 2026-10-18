import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import api from "../services/api";
import { authService } from "../services/auth.service";
import { Teacher, Session, SessionFormData } from "../types";
import type { ChangeEvent, FormEvent } from "react";
import axios from "axios";

function SessionForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditMode = !!id;

  const [formData, setFormData] = useState<SessionFormData>({
    name: "",
    date: "",
    description: "",
    teacherId: "",
  });
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const user = authService.getCurrentUser();
  const token = authService.getToken();

  // Redirect if not admin
  useEffect(() => {
    if (!user?.admin) {
      navigate("/sessions");
    }
  }, [user?.admin, navigate]);

  useEffect(() => {
    if (!user?.admin) {
      return;
    }

    const controller = new AbortController();

    const fetchData = async (): Promise<void> => {
      try {
        setError("");

        const teachersResponse = await api.get<Teacher[]>("/teacher", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          signal: controller.signal,
        });

        if (controller.signal.aborted) return;

        setTeachers(teachersResponse.data);

        if (isEditMode && id) {
          const sessionResponse = await api.get<Session>(`/session/${id}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
            signal: controller.signal,
          });

          if (controller.signal.aborted) return;

          const session = sessionResponse.data;

          setFormData({
            name: session.name,
            date: new Date(session.date).toISOString().split("T")[0],
            description: session.description,
            teacherId: session.teacher.id,
          });
        }
      } catch (err: unknown) {
        if (!axios.isCancel(err) && !controller.signal.aborted) {
          setError("Failed to load form data");
          console.error(err);
        }
      }
    };

    void fetchData();

    return () => {
      controller.abort();
    };
  }, [id, isEditMode, token, user?.admin]);

  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ): void => {
    const { name, value } = e.target;

    if (name === "teacherId") {
      setFormData((prev) => ({
        ...prev,
        teacherId: value === "" ? "" : Number(value),
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!user?.admin) {
      setError("Unauthorized");
      return;
    }

    if (formData.teacherId === "") {
      setError("Please select a teacher");
      return;
    }

    setError("");
    setLoading(true);

    const payload: SessionFormData = {
      ...formData,
      teacherId: formData.teacherId,
    };

    try {
      if (isEditMode) {
        await api.put(`/session/${id}`, payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      } else {
        await api.post("/session", payload, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }

      navigate("/sessions");
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        const message = err.response?.data?.message;

        setError(
          typeof message === "string" ? message : "Failed to save session",
        );
      } else {
        setError("An unexpected error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="bg-white rounded-lg shadow-md p-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-8">
            {isEditMode ? "Edit Session" : "Create New Session"}
          </h1>

          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="name"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Session Name
              </label>
              <input
                id="name"
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="date"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="mb-4">
              <label
                htmlFor="teacherId"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Teacher
              </label>
              <select
                id="teacherId"
                name="teacherId"
                value={formData.teacherId}
                onChange={handleChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                required
              >
                <option value="">Select a teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.firstName} {teacher.lastName}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label
                htmlFor="description"
                className="block text-gray-700 text-sm font-bold mb-2"
              >
                Description
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-indigo-500"
                required
              />
            </div>

            <div className="flex space-x-4">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400"
              >
                {loading
                  ? "Saving..."
                  : isEditMode
                    ? "Update Session"
                    : "Create Session"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/sessions")}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default SessionForm;
