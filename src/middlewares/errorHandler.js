// Middleware d'erreur centralisé : jamais de stack trace ni de message interne côté client.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({ error: "INVALID_JSON" });
  }
  if (err.type === "entity.too.large") {
    return res.status(413).json({ error: "PAYLOAD_TOO_LARGE" });
  }
  console.error(err); // journalisé côté serveur uniquement
  return res.status(500).json({ error: "INTERNAL_ERROR" });
}
