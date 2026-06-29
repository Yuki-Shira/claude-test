import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, cleanup } from "@testing-library/react";

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/actions", () => ({
  signIn: vi.fn(),
  signUp: vi.fn(),
}));

vi.mock("@/lib/anon-work-tracker", () => ({
  getAnonWorkData: vi.fn(),
  clearAnonWork: vi.fn(),
}));

vi.mock("@/actions/get-projects", () => ({
  getProjects: vi.fn(),
}));

vi.mock("@/actions/create-project", () => ({
  createProject: vi.fn(),
}));

import { signIn as signInAction, signUp as signUpAction } from "@/actions";
import { getAnonWorkData, clearAnonWork } from "@/lib/anon-work-tracker";
import { getProjects } from "@/actions/get-projects";
import { createProject } from "@/actions/create-project";
import { useAuth } from "@/hooks/use-auth";

const mockSignIn = signInAction as ReturnType<typeof vi.fn>;
const mockSignUp = signUpAction as ReturnType<typeof vi.fn>;
const mockGetAnonWorkData = getAnonWorkData as ReturnType<typeof vi.fn>;
const mockClearAnonWork = clearAnonWork as ReturnType<typeof vi.fn>;
const mockGetProjects = getProjects as ReturnType<typeof vi.fn>;
const mockCreateProject = createProject as ReturnType<typeof vi.fn>;

const ANON_WORK_WITH_MESSAGES = {
  messages: [{ role: "user", content: "Make a button" }],
  fileSystemData: { "/App.jsx": { type: "file", content: "export default function App() {}" } },
};

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAnonWorkData.mockReturnValue(null);
  });

  afterEach(() => {
    cleanup();
  });

  test("initial state has isLoading as false", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.isLoading).toBe(false);
  });

  test("exposes signIn, signUp, and isLoading", () => {
    const { result } = renderHook(() => useAuth());
    expect(typeof result.current.signIn).toBe("function");
    expect(typeof result.current.signUp).toBe("function");
    expect(typeof result.current.isLoading).toBe("boolean");
  });

  describe("signIn", () => {
    describe("happy path — redirects after success", () => {
      test("redirects to most recent existing project when user has projects", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([{ id: "project-1" }, { id: "project-2" }]);

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signIn("test@example.com", "password123");
        });

        expect(signInAction).toHaveBeenCalledWith("test@example.com", "password123");
        expect(mockPush).toHaveBeenCalledWith("/project-1");
        expect(returnValue).toEqual({ success: true });
      });

      test("creates and redirects to a new project when user has no projects", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "new-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/new-project");
      });

      test("new project name matches 'New Design #<number>'", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "p1" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        const name: string = mockCreateProject.mock.calls[0][0].name;
        expect(name).toMatch(/^New Design #\d+$/);
        const num = parseInt(name.replace("New Design #", ""), 10);
        expect(num).toBeGreaterThanOrEqual(0);
        expect(num).toBeLessThan(100000);
      });
    });

    describe("anonymous work migration", () => {
      test("migrates anonymous work with messages into a new project", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK_WITH_MESSAGES);
        mockCreateProject.mockResolvedValue({ id: "migrated-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: ANON_WORK_WITH_MESSAGES.messages,
          data: ANON_WORK_WITH_MESSAGES.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-project");
      });

      test("skips migration when anon work has no messages", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/existing-project");
      });

      test("skips migration when getAnonWorkData returns null", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(null);
        mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
      });
    });

    describe("failure states", () => {
      test("returns failure result without redirecting", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signIn("test@example.com", "wrong");
        });

        expect(returnValue).toEqual({ success: false, error: "Invalid credentials" });
        expect(mockPush).not.toHaveBeenCalled();
      });

      test("does not call handlePostSignIn on failure", async () => {
        mockSignIn.mockResolvedValue({ success: false, error: "Invalid credentials" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "wrong");
        });

        expect(mockGetAnonWorkData).not.toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockCreateProject).not.toHaveBeenCalled();
      });

      test("resets isLoading to false even when signInAction throws", async () => {
        mockSignIn.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });

      test("resets isLoading to false when post-sign-in redirect throws", async () => {
        mockSignIn.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK_WITH_MESSAGES);
        mockCreateProject.mockRejectedValue(new Error("DB error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signIn("test@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("isLoading state", () => {
      test("sets isLoading to true while request is pending, false after", async () => {
        let resolveSignIn!: (v: unknown) => void;
        const pendingSignIn = new Promise((resolve) => {
          resolveSignIn = resolve;
        });
        mockSignIn.mockReturnValue(pendingSignIn);

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        act(() => {
          result.current.signIn("test@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignIn({ success: false, error: "Invalid" });
          await pendingSignIn;
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe("signUp", () => {
    describe("happy path — redirects after success", () => {
      test("redirects to most recent existing project", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([{ id: "project-abc" }]);

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signUp("new@example.com", "password123");
        });

        expect(signUpAction).toHaveBeenCalledWith("new@example.com", "password123");
        expect(mockPush).toHaveBeenCalledWith("/project-abc");
        expect(returnValue).toEqual({ success: true });
      });

      test("creates and redirects to a new project when user has no projects", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetProjects.mockResolvedValue([]);
        mockCreateProject.mockResolvedValue({ id: "fresh-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith(
          expect.objectContaining({ messages: [], data: {} })
        );
        expect(mockPush).toHaveBeenCalledWith("/fresh-project");
      });
    });

    describe("anonymous work migration", () => {
      test("migrates anonymous work with messages into a new project", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue(ANON_WORK_WITH_MESSAGES);
        mockCreateProject.mockResolvedValue({ id: "migrated-signup-project" });

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).toHaveBeenCalledWith({
          name: expect.stringContaining("Design from"),
          messages: ANON_WORK_WITH_MESSAGES.messages,
          data: ANON_WORK_WITH_MESSAGES.fileSystemData,
        });
        expect(mockClearAnonWork).toHaveBeenCalled();
        expect(mockGetProjects).not.toHaveBeenCalled();
        expect(mockPush).toHaveBeenCalledWith("/migrated-signup-project");
      });

      test("skips migration when anon work has no messages", async () => {
        mockSignUp.mockResolvedValue({ success: true });
        mockGetAnonWorkData.mockReturnValue({ messages: [], fileSystemData: {} });
        mockGetProjects.mockResolvedValue([{ id: "existing-project" }]);

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123");
        });

        expect(mockCreateProject).not.toHaveBeenCalled();
        expect(mockClearAnonWork).not.toHaveBeenCalled();
      });
    });

    describe("failure states", () => {
      test("returns failure result without redirecting", async () => {
        mockSignUp.mockResolvedValue({ success: false, error: "Email already registered" });

        const { result } = renderHook(() => useAuth());

        let returnValue: unknown;
        await act(async () => {
          returnValue = await result.current.signUp("existing@example.com", "password123");
        });

        expect(returnValue).toEqual({ success: false, error: "Email already registered" });
        expect(mockPush).not.toHaveBeenCalled();
      });

      test("resets isLoading to false even when signUpAction throws", async () => {
        mockSignUp.mockRejectedValue(new Error("Network error"));

        const { result } = renderHook(() => useAuth());

        await act(async () => {
          await result.current.signUp("new@example.com", "password123").catch(() => {});
        });

        expect(result.current.isLoading).toBe(false);
      });
    });

    describe("isLoading state", () => {
      test("sets isLoading to true while request is pending, false after", async () => {
        let resolveSignUp!: (v: unknown) => void;
        const pendingSignUp = new Promise((resolve) => {
          resolveSignUp = resolve;
        });
        mockSignUp.mockReturnValue(pendingSignUp);

        const { result } = renderHook(() => useAuth());

        expect(result.current.isLoading).toBe(false);

        act(() => {
          result.current.signUp("new@example.com", "password123");
        });

        expect(result.current.isLoading).toBe(true);

        await act(async () => {
          resolveSignUp({ success: false, error: "Invalid" });
          await pendingSignUp;
        });

        expect(result.current.isLoading).toBe(false);
      });
    });
  });
});
