import { Elysia } from "elysia";

export const app = new Elysia({ prefix: "/api/v1" }).get("/health", () => ({
  status: "ok" as const,
}));

export type App = typeof app;
