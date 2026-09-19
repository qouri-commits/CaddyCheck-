import { Router, type IRouter } from "express";
import { randomBytes } from "crypto";
import { eq, lt } from "drizzle-orm";
import { z } from "zod";
import { db, sessionsTable } from "@workspace/db";

// Define schemas locally to avoid cross-package zod instance issues
const SessionBasketItemSchema = z.object({
  id:       z.string(),
  name:     z.string(),
  price:    z.number(),
  quantity: z.number(),
  barcode:  z.string().optional(),
  imageUrl: z.string().optional(),
});

const router: IRouter = Router();

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (b) => CODE_CHARS[b % CODE_CHARS.length]).join("");
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

function sessionExpiry(): Date {
  const d = new Date();
  d.setHours(d.getHours() + 12);
  return d;
}

async function cleanExpired() {
  await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, new Date()));
}

// ─── POST /api/sessions  — create a new session ───────────────────────────────
const CreateSessionBody = z.object({
  hostName: z.string().min(1).max(50),
  currency: z.string().max(5).optional(),
});

router.post("/sessions", async (req, res) => {
  const parsed = CreateSessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  await cleanExpired();

  const code = generateCode();
  const hostToken = generateToken();

  const [session] = await db
    .insert(sessionsTable)
    .values({
      code,
      hostToken,
      hostName: parsed.data.hostName,
      basket: [],
      reminders: [],
      currency: parsed.data.currency ?? "MAD",
      expiresAt: sessionExpiry(),
    })
    .returning();

  res.status(201).json({
    id: session.id,
    code: session.code,
    hostToken: session.hostToken,
    expiresAt: session.expiresAt,
  });
});

// ─── GET /api/sessions/:code  — get session state ────────────────────────────
router.get("/sessions/:code", async (req, res) => {
  await cleanExpired();

  const session = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.code, req.params.code.toUpperCase()),
  });

  if (!session) {
    res.status(404).json({ error: "Session not found or expired" });
    return;
  }

  res.json({
    code: session.code,
    hostName: session.hostName,
    basket: session.basket,
    reminders: session.reminders,
    currency: session.currency,
    updatedAt: session.updatedAt,
    expiresAt: session.expiresAt,
  });
});

// ─── PUT /api/sessions/:code/basket  — host updates basket ───────────────────
const UpdateBasketBody = z.object({
  basket: z.array(SessionBasketItemSchema),
  currency: z.string().max(5).optional(),
});

router.put("/sessions/:code/basket", async (req, res) => {
  const hostToken = req.headers["x-host-token"];
  if (!hostToken || typeof hostToken !== "string") {
    res.status(401).json({ error: "Missing host token" });
    return;
  }

  const parsed = UpdateBasketBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const session = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.code, req.params.code.toUpperCase()),
  });

  if (!session || session.expiresAt <= new Date()) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  if (session.hostToken !== hostToken) {
    res.status(403).json({ error: "Invalid host token" });
    return;
  }

  const [updated] = await db
    .update(sessionsTable)
    .set({
      basket: parsed.data.basket,
      currency: parsed.data.currency ?? session.currency,
      updatedAt: new Date(),
      expiresAt: sessionExpiry(),
    })
    .where(eq(sessionsTable.id, session.id))
    .returning();

  res.json({ updatedAt: updated.updatedAt });
});

// ─── POST /api/sessions/:code/reminders  — viewer adds reminder ──────────────
const AddReminderBody = z.object({
  name: z.string().min(1).max(100),
  addedBy: z.string().max(50).optional(),
});

router.post("/sessions/:code/reminders", async (req, res) => {
  const parsed = AddReminderBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid body" });
    return;
  }

  const newReminder = {
    id: randomBytes(8).toString("hex"),
    name: parsed.data.name,
    addedBy: parsed.data.addedBy,
    addedAt: new Date().toISOString(),
    done: false,
  };

  // Use a row lock (SELECT ... FOR UPDATE) so concurrent viewers appending
  // reminders at the same time can't clobber each other's writes.
  const notFound = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: sessionsTable.id, reminders: sessionsTable.reminders })
      .from(sessionsTable)
      .where(eq(sessionsTable.code, req.params.code.toUpperCase()))
      .for("update");

    if (!locked) return true;

    const current = await tx.query.sessionsTable.findFirst({
      where: eq(sessionsTable.id, locked.id),
    });
    if (!current || current.expiresAt <= new Date()) return true;

    const updatedReminders = [...(locked.reminders ?? []), newReminder];

    await tx
      .update(sessionsTable)
      .set({ reminders: updatedReminders, updatedAt: new Date() })
      .where(eq(sessionsTable.id, locked.id));

    return false;
  });

  if (notFound) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  res.status(201).json(newReminder);
});

// ─── PATCH /api/sessions/:code/reminders/:rid  — mark reminder done ──────────
router.patch("/sessions/:code/reminders/:rid", async (req, res) => {
  const hostToken = req.headers["x-host-token"];
  if (!hostToken || typeof hostToken !== "string") {
    res.status(401).json({ error: "Missing host token" });
    return;
  }

  const forbidden = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({
        id: sessionsTable.id,
        hostToken: sessionsTable.hostToken,
        reminders: sessionsTable.reminders,
        expiresAt: sessionsTable.expiresAt,
      })
      .from(sessionsTable)
      .where(eq(sessionsTable.code, req.params.code.toUpperCase()))
      .for("update");

    if (!locked || locked.hostToken !== hostToken || locked.expiresAt <= new Date()) return true;

    const updatedReminders = (locked.reminders ?? []).map((r) =>
      r.id === req.params.rid ? { ...r, done: true } : r
    );

    await tx
      .update(sessionsTable)
      .set({ reminders: updatedReminders, updatedAt: new Date() })
      .where(eq(sessionsTable.id, locked.id));

    return false;
  });

  if (forbidden) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  res.json({ ok: true });
});

// ─── DELETE /api/sessions/:code  — host ends session ─────────────────────────
router.delete("/sessions/:code", async (req, res) => {
  const hostToken = req.headers["x-host-token"];
  if (!hostToken || typeof hostToken !== "string") {
    res.status(401).json({ error: "Missing host token" });
    return;
  }

  const session = await db.query.sessionsTable.findFirst({
    where: eq(sessionsTable.code, req.params.code.toUpperCase()),
  });

  if (!session || session.hostToken !== hostToken || session.expiresAt <= new Date()) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
  res.json({ ok: true });
});

export default router;
