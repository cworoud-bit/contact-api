import { describe, it, expect, beforeAll, afterAll } from "vitest";
import request from "supertest";
import pg from "pg";
import { createApp } from "../../src/app.js";
import { createPgContactRepository } from "../../src/repositories/contactRepository.js";

// Prérequis : docker compose up -d --wait && npm run migrate (variables PG* exportées).
describe("Intégration API ↔ PostgreSQL", () => {
  let pool;
  let app;

  beforeAll(() => {
    pool = new pg.Pool();
    app = createApp({ contactRepository: createPgContactRepository(pool) });
  });

  afterAll(async () => {
    await pool.end();
  });

  it("enregistre un contact dans PostgreSQL", async () => {
    const email = `int-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/contact")
      .send({ name: "Ada Lovelace", email, message: "Message d'intégration valide." });
    expect(res.status).toBe(201);
    expect(res.body.status).toBe("received");

    const { rows } = await pool.query("SELECT name, email, message FROM contacts WHERE email = $1", [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Ada Lovelace");
    expect(rows[0].message).toBe("Message d'intégration valide.");
  });

  it("résiste à une tentative d'injection SQL", async () => {
    const attack = "Robert'); DROP TABLE contacts;--";
    const email = `inj-${Date.now()}@example.com`;
    const res = await request(app)
      .post("/api/contact")
      .send({ name: attack, email, message: "Test d'injection SQL dans le nom." });
    expect(res.status).toBe(201);

    // la table existe toujours
    const table = await pool.query("SELECT to_regclass('public.contacts') AS t");
    expect(table.rows[0].t).not.toBeNull();

    // la valeur est stockée telle quelle (requête paramétrée)
    const { rows } = await pool.query("SELECT name FROM contacts WHERE email = $1", [email]);
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe(attack);
  });
});
