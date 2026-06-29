# AGENTS.md — UIGen Coding Agent Guidelines

UIGen is an AI-powered React component generator with live preview, built on Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma/SQLite, and the Vercel AI SDK with Anthropic Claude.

---

## Build / Lint / Test Commands

```bash
# Install dependencies and initialise the database (first-time setup)
npm run setup

# Start development server (Turbopack)
npm run dev

# Production build
npm run build

# Run the full test suite (Vitest)
npm test

# Run a single test file
npx vitest run src/lib/__tests__/file-system.test.ts

# Run tests matching a name pattern
npx vitest run --reporter=verbose -t "creates a new file system"

# Run tests in watch mode
npx vitest

# Lint
npm run lint

# Reset database
npm run db:reset
```

> **Do NOT run `npm audit fix`.** Dependencies are pinned to specific versions.

---

## Project Structure

```
src/
  actions/          # Next.js Server Actions ("use server")
  app/              # Next.js App Router (pages, layouts, API routes)
  components/
    auth/           # Auth dialogs and forms
    chat/           # Chat UI components + __tests__/
    editor/         # Monaco editor + file tree + __tests__/
    preview/        # iframe live-preview component
    ui/             # shadcn/ui primitives (button, dialog, tabs, …)
  hooks/            # Reusable React hooks (e.g. use-auth.ts)
  lib/
    __tests__/      # Unit tests for lib utilities
    contexts/       # React contexts + providers + __tests__/
    prompts/        # System prompt strings
    tools/          # Zod-defined AI tool schemas (str-replace, file-manager)
    transform/      # Babel JSX transform pipeline + __tests__/
    auth.ts         # JWT session helpers (jose + httpOnly cookies)
    file-system.ts  # VirtualFileSystem class (in-memory, no disk writes)
    prisma.ts       # Prisma singleton
    provider.ts     # Anthropic model + MockLanguageModel fallback
    utils.ts        # cn() helper (clsx + tailwind-merge)
  middleware.ts     # Route-protection middleware
prisma/
  schema.prisma     # User + Project models (SQLite)
```

---

## TypeScript

- **`strict: true`** is enforced — no implicit `any`, strict null checks, etc.
- Target is `ES2017`; `moduleResolution` is `"bundler"`.
- Use `@/*` path alias for all internal imports (`@/*` → `src/*`).
- Prefer `interface` for component props and data shapes; use `type` only for unions/intersections.
- Always annotate return types on async functions and context values where the inferred type would be ambiguous.
- Use `z.infer<typeof Schema>` for parameters validated by Zod schemas.
- Avoid `as` type assertions except `as const` or when bridging untyped external data (`as unknown as T`).

---

## Code Style & Formatting

- **No separate Prettier config** — follow the existing indentation (2-space soft tabs).
- `"use client"` / `"use server"` directives must appear on **line 1** of the file.
- React's automatic JSX runtime is used — **do not import React** in JSX files.
- Keep files focused; large utilities should be split into smaller modules.
- Prefer named exports over default exports (the codebase uses named exports throughout).

---

## Import Conventions

```ts
// 1. Framework / runtime directives (line 1 if needed)
"use client";

// 2. External packages
import { streamText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

// 3. Internal aliases (always use @/)
import { VirtualFileSystem } from "@/lib/file-system";
import { cn } from "@/lib/utils";

// 4. Relative imports (only within the same feature directory)
import { MessageList } from "./MessageList";
```

- Use `"server-only"` at the top of any module that must never run on the client.
- Do not barrel-export from `index.ts` files unless one already exists in that directory.

---

## Naming Conventions

| Item | Convention | Example |
|---|---|---|
| React components | PascalCase | `ChatInterface`, `PreviewFrame` |
| Component files | PascalCase `.tsx` | `MessageInput.tsx` |
| Utility/lib files | kebab-case `.ts` | `file-system.ts`, `jsx-transformer.ts` |
| Hooks | `useCamelCase` | `useFileSystem`, `useAuth` |
| Server Actions | camelCase | `createProject`, `signIn` |
| Context exports | `FooProvider` + `useFoo` | `FileSystemProvider`, `useFileSystem` |
| Module-level constants | SCREAMING_SNAKE_CASE | `JWT_SECRET`, `MODEL` |
| Test files | `*.test.ts` / `*.test.tsx` in `__tests__/` | `file-system.test.ts` |

---

## Component Patterns

**Client component:**
```tsx
"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

interface MyComponentProps {
  value: string;
  onChange: (v: string) => void;
}

export function MyComponent({ value, onChange }: MyComponentProps) {
  // ...
}
```

**Server component (async data fetch):**
```tsx
import { getProject } from "@/actions/get-project";
import { redirect } from "next/navigation";

export default async function ProjectPage({ params }: { params: { projectId: string } }) {
  const project = await getProject(params.projectId);
  if (!project) redirect("/");
  // ...
}
```

**Context pattern** — co-locate `createContext`, `Provider`, and `useFoo` hook in one file:
```tsx
const FooContext = createContext<FooContextType | undefined>(undefined);

export function FooProvider({ children }: { children: React.ReactNode }) { ... }

export function useFoo() {
  const ctx = useContext(FooContext);
  if (!ctx) throw new Error("useFoo must be used within FooProvider");
  return ctx;
}
```

---

## Error Handling

- **Server Actions** must return `{ success: boolean; error?: string }` — never throw to the client.
- Auth helpers (`getSession`, `verifySession`) catch JWT errors and return `null`; do not propagate.
- In API routes and server actions, use `try/catch` + `console.error` for logging.
- In client code, pattern-match errors: `error instanceof Error ? error.message : "Unknown error"`.
- `VirtualFileSystem` methods return `null` / `false` / error strings rather than throwing.
- Page-level data fetches that fail should call `redirect("/")` inside a `try/catch`.

---

## Styling

- **Tailwind CSS v4** — configuration lives entirely in `src/app/globals.css` (no `tailwind.config.js`).
- Use the `cn()` helper from `@/lib/utils` to merge conditional classes.
- Use shadcn/ui components from `@/components/ui/` for all UI primitives; follow the "new-york" style.
- Icons come from `lucide-react`.
- CSS custom properties (design tokens) are defined in `globals.css` — prefer them over hard-coded values.

---

## Testing

- **Framework**: Vitest + `@testing-library/react` + jsdom.
- Tests live in `__tests__/` subdirectories adjacent to the code they test.
- Use flat `test()` for simple unit tests; wrap related cases in `describe()` blocks.
- Mock modules with `vi.mock()`, functions with `vi.fn()`, and typed mocks with `vi.mocked()`.
- Always call `cleanup()` in `afterEach` for component tests.
- Query the DOM using `screen.getByTestId()` or semantic queries (`getByRole`, `getByText`).
- Clear mocks in `beforeEach` with `vi.clearAllMocks()`.
- The `@/*` alias works in tests (resolved by `vite-tsconfig-paths`).

```ts
// Unit test example
import { test, expect } from "vitest";
import { VirtualFileSystem } from "@/lib/file-system";

test("creates root directory on init", () => {
  const fs = new VirtualFileSystem();
  expect(fs.getNode("/")?.type).toBe("directory");
});
```

---

## Key Architecture Notes

- **Virtual File System**: All AI-generated code lives in an in-memory `VirtualFileSystem` — nothing is written to disk during generation.
- **AI Tools**: Two Zod-validated tools are exposed to Claude — `str_replace_editor` (`src/lib/tools/str-replace.ts`) and `file_manager` (`src/lib/tools/file-manager.ts`).
- **Live Preview**: JSX is compiled client-side via `@babel/standalone`; an import map resolves module paths to blob URLs; Tailwind is loaded from CDN inside the preview iframe.
- **Mock Provider**: If `ANTHROPIC_API_KEY` is absent, the app falls back to `MockLanguageModel` in `src/lib/provider.ts` — tests and local dev work without an API key.
- **Anonymous Users**: Anonymous work is persisted in `sessionStorage` via `src/lib/anon-work-tracker.ts` and migrated to the user's account on sign-up/sign-in.
- **Database**: Only `User` and `Project` models exist; messages and file-system state are stored as JSON strings inside `Project`.
