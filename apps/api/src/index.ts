// Serverless entry (e.g. Vercel): default-export the app, never call listen().
import "./env"; // fail fast on a bad environment
import { app } from "./app";

export default app;
