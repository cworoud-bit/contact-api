import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { healthRouter } from "./routes/health.js";
import { contactRouter } from "./routes/contact.js";
import { errorHandler } from "./middlewares/errorHandler.js";

/**
 * Fabrique de l'application. Le repository est injecté : les tests de routes
 * passent un repository en mémoire, server.js passe le repository PostgreSQL.
 */
export function createApp({ contactRepository }) {
  const app = express();

  app.disable("x-powered-by");
  app.use(helmet());
  // Derrière un reverse proxy (Nginx, Ingress) : app.set("trust proxy", 1);

  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "TOO_MANY_REQUESTS" },
  });
  app.use("/api/contact", contactLimiter);

  app.use(express.json({ limit: "10kb" }));

  app.use("/api/health", healthRouter);
  app.use("/api/contact", contactRouter({ contactRepository }));

  app.use((req, res) => {
    res.status(404).json({ error: "NOT_FOUND" });
  });

  // Le middleware d'erreur doit être déclaré EN DERNIER.
  app.use(errorHandler);
  return app;
}
