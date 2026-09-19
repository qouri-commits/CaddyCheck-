import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { Router, type IRouter } from "express";
import { z } from "zod";
import { rateLimit } from "../middlewares/rate-limit";

export interface BasketItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  imageUrl?: string;
}

export interface Reminder {
  id: string;
  name: string;
  addedBy?: string;
  addedAt: string;
  done: boolean;
}

export interface SessionRecord {
  id: string;
  code: string;
  hostToken: string;
  hostName: string;
  basket: BasketItem[];
  reminders: Reminder[];
  currency: string;
  updatedAt: Date;
  expiresAt: Date;
}

export type MutationResult =
  | { status: "ok"; updatedAt?: Date }
  | { status: "notFound" }
  | { status: "forbidden" }
  | { status: "limit" };

export interface SessionRepository {
  cleanExpired(now: Date): Promise<void>;
  create(input: {
    code: string;
    hostToken: string;
    hostName: string;
    currency: string;
    expiresAt: Date;
  }): Promise<SessionRecord>;
  findByCode(code: string): Promise<SessionRecord | undefined>;
  updateBasket(input: {
    code: string;
    hostToken: string;
    basket: BasketItem[];
    currency?: string;
    now: Date;
    expiresAt: Date;
  }): Promise<MutationResult>;
  addReminder(input: {
    code: string;
    reminder: Reminder;
    now: Date;
    maxReminders: number;
  }): Promise<MutationResult>;
  completeReminder(input: {
    code: string;
    reminderId: string;
    hostToken: string;
    now: Date;
  }): Promise<MutationResult>;
  delete(input: { code: string; hostToken: string; now: Date }): Promise<MutationResult>;
}

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const SESSION_HOURS = 12;
const MAX_REMINDERS = 100;

const CodeSchema = z.string().toUpperCase().regex(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
const ReminderIdSchema = z.string().regex(/^[a-f0-9]{16}$/);
const HostTokenSchema = z.string().regex(/^[a-f0-9]{64}$/);
const CurrencySchema = z.string().trim().toUpperCase().regex(/^[A-Z]{3,5}$/);
const NonBlankName = (max: number) => z.string().trim().min(1).max(max);

const SessionBasketItemSchema = z.object({
  id: z.string().min(1).max(128),
  name: NonBlankName(200),
  price: z.number().finite().min(0).max(1_000_000_000),
  quantity: z.number().int().min(1).max(10_000),
  barcode: z.string().max(128).optional(),
  imageUrl: z.string().max(2_048).optional(),
}).strict();

const CreateSessionBody = z.object({
  hostName: NonBlankName(50),
  currency: CurrencySchema.optional(),
}).strict();

const UpdateBasketBody = z.object({
  basket: z.array(SessionBasketItemSchema).max(200),
  currency: CurrencySchema.optional(),
}).strict();

const AddReminderBody = z.object({
  name: NonBlankName(100),
  addedBy: NonBlankName(50).optional(),
}).strict();

function generateCode(): string {
  const bytes = randomBytes(6);
  return Array.from(bytes, (byte) => CODE_CHARS[byte % CODE_CHARS.length]).join("");
}

function sessionExpiry(now = new Date()): Date {
  return new Date(now.getTime() + SESSION_HOURS * 60 * 60 * 1_000);
}

/** Hash first so comparisons have identical lengths even for malformed input. */
export function tokensEqual(expected: string, provided: string): boolean {
  const expectedDigest = createHash("sha256").update(expected).digest();
  const providedDigest = createHash("sha256").update(provided).digest();
  return timingSafeEqual(expectedDigest, providedDigest);
}

function parseCode(raw: string | string[] | undefined): string | undefined {
  const parsed = CodeSchema.safeParse(Array.isArray(raw) ? raw[0] : raw);
  return parsed.success ? parsed.data : undefined;
}

function hostTokenFrom(headers: string | string[] | undefined): string | undefined {
  const parsed = HostTokenSchema.safeParse(headers);
  return parsed.success ? parsed.data : undefined;
}

function invalidBody(res: Parameters<Parameters<IRouter["post"]>[1]>[1]): void {
  res.status(400).json({ error: "Invalid request body" });
}

export function createSessionsRouter(
  repository: SessionRepository,
  limits = {
    create: { windowMs: 15 * 60_000, max: 10 },
    read: { windowMs: 60_000, max: 120 },
    write: { windowMs: 60_000, max: 60 },
    reminder: { windowMs: 60_000, max: 30 },
  },
): IRouter {
  const router = Router();
  const createLimiter = rateLimit(limits.create);
  const readLimiter = rateLimit(limits.read);
  const writeLimiter = rateLimit(limits.write);
  const reminderLimiter = rateLimit(limits.reminder);

  router.post("/sessions", createLimiter, async (req, res): Promise<void> => {
    const parsed = CreateSessionBody.safeParse(req.body);
    if (!parsed.success) {
      invalidBody(res);
      return;
    }

    const now = new Date();
    await repository.cleanExpired(now);
    const session = await repository.create({
      code: generateCode(),
      hostToken: randomBytes(32).toString("hex"),
      hostName: parsed.data.hostName,
      currency: parsed.data.currency ?? "MAD",
      expiresAt: sessionExpiry(now),
    });

    res.status(201).json({
      id: session.id,
      code: session.code,
      hostToken: session.hostToken,
      expiresAt: session.expiresAt,
    });
  });

  router.get("/sessions/:code", readLimiter, async (req, res): Promise<void> => {
    const code = parseCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: "Invalid session code" });
      return;
    }

    const now = new Date();
    const session = await repository.findByCode(code);
    if (!session || session.expiresAt <= now) {
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

  router.put("/sessions/:code/basket", writeLimiter, async (req, res): Promise<void> => {
    const code = parseCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: "Invalid session code" });
      return;
    }
    const hostToken = hostTokenFrom(req.headers["x-host-token"]);
    if (!hostToken) {
      res.status(req.headers["x-host-token"] == null ? 401 : 403).json({
        error: req.headers["x-host-token"] == null ? "Missing host token" : "Forbidden",
      });
      return;
    }
    const parsed = UpdateBasketBody.safeParse(req.body);
    if (!parsed.success) {
      invalidBody(res);
      return;
    }

    const now = new Date();
    const result = await repository.updateBasket({
      code,
      hostToken,
      basket: parsed.data.basket,
      currency: parsed.data.currency,
      now,
      expiresAt: sessionExpiry(now),
    });
    if (result.status === "notFound") {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }
    if (result.status !== "ok") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({ updatedAt: result.updatedAt });
  });

  router.post("/sessions/:code/reminders", reminderLimiter, async (req, res): Promise<void> => {
    const code = parseCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: "Invalid session code" });
      return;
    }
    const parsed = AddReminderBody.safeParse(req.body);
    if (!parsed.success) {
      invalidBody(res);
      return;
    }

    const now = new Date();
    const reminder: Reminder = {
      id: randomBytes(8).toString("hex"),
      name: parsed.data.name,
      addedBy: parsed.data.addedBy,
      addedAt: now.toISOString(),
      done: false,
    };
    const result = await repository.addReminder({
      code,
      reminder,
      now,
      maxReminders: MAX_REMINDERS,
    });
    if (result.status === "notFound") {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }
    if (result.status === "limit") {
      res.status(409).json({ error: "Reminder limit reached" });
      return;
    }
    res.status(201).json(reminder);
  });

  router.patch("/sessions/:code/reminders/:rid", writeLimiter, async (req, res): Promise<void> => {
    const code = parseCode(req.params.code);
    const reminderId = ReminderIdSchema.safeParse(req.params.rid);
    if (!code || !reminderId.success) {
      res.status(400).json({ error: "Invalid path parameters" });
      return;
    }
    const hostToken = hostTokenFrom(req.headers["x-host-token"]);
    if (!hostToken) {
      res.status(req.headers["x-host-token"] == null ? 401 : 403).json({
        error: req.headers["x-host-token"] == null ? "Missing host token" : "Forbidden",
      });
      return;
    }

    const result = await repository.completeReminder({
      code,
      reminderId: reminderId.data,
      hostToken,
      now: new Date(),
    });
    if (result.status === "notFound") {
      res.status(404).json({ error: "Session or reminder not found" });
      return;
    }
    if (result.status !== "ok") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({ ok: true });
  });

  router.delete("/sessions/:code", writeLimiter, async (req, res): Promise<void> => {
    const code = parseCode(req.params.code);
    if (!code) {
      res.status(400).json({ error: "Invalid session code" });
      return;
    }
    const hostToken = hostTokenFrom(req.headers["x-host-token"]);
    if (!hostToken) {
      res.status(req.headers["x-host-token"] == null ? 401 : 403).json({
        error: req.headers["x-host-token"] == null ? "Missing host token" : "Forbidden",
      });
      return;
    }

    const result = await repository.delete({ code, hostToken, now: new Date() });
    if (result.status === "notFound") {
      res.status(404).json({ error: "Session not found or expired" });
      return;
    }
    if (result.status !== "ok") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.json({ ok: true });
  });

  return router;
}