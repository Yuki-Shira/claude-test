import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

vi.mock("server-only", () => ({}));

const mockGet = vi.fn();
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => Promise.resolve({ get: mockGet })),
}));

import { getSession } from "@/lib/auth";

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

beforeEach(() => {
  vi.clearAllMocks();
});

test("returns null when no auth cookie is present", async () => {
  mockGet.mockReturnValue(undefined);
  expect(await getSession()).toBeNull();
});

test("returns session payload from a valid token", async () => {
  const token = await new SignJWT({ userId: "user_1", email: "a@b.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(JWT_SECRET);

  mockGet.mockReturnValue({ value: token });

  const session = await getSession();
  expect(session?.userId).toBe("user_1");
  expect(session?.email).toBe("a@b.com");
});

test("returns null for a malformed token", async () => {
  mockGet.mockReturnValue({ value: "not.a.jwt" });
  expect(await getSession()).toBeNull();
});

test("returns null for an expired token", async () => {
  const token = await new SignJWT({ userId: "user_1", email: "a@b.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
    .setIssuedAt()
    .sign(JWT_SECRET);

  mockGet.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});

test("returns null for a token signed with a different secret", async () => {
  const wrongSecret = new TextEncoder().encode("wrong-secret");
  const token = await new SignJWT({ userId: "user_1", email: "a@b.com" })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("7d")
    .setIssuedAt()
    .sign(wrongSecret);

  mockGet.mockReturnValue({ value: token });
  expect(await getSession()).toBeNull();
});
