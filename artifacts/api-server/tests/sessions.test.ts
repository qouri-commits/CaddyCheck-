import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { Router } from "express";
import { createHttpApp } from "../src/http";
import {
  createSessionsRouter,
  tokensEqual,
  type BasketItem,
  type MutationResult,
  type Reminder,
  type SessionRecord,
  type SessionRepository,
} from "../src/routes/sessions-router";

class MemoryRepository implements SessionRepository {
  readonly sessions = new Map<string, SessionRecord>();
  private nextId = 1;

  async cleanExpired(now: Date): Promise<void> {
    for (const [code, session] of this.sessions) {
      if (session.expiresAt <= now) this.sessions.delete(code);
    }
  }

  async create(input: {
    code: string;
    hostToken: string;
    hostName: string;
    currency: string;
    expiresAt: Date;
  }): Promise<SessionRecord> {
    const session: SessionRecord = {
      ...input,
      id: String(this.nextId++),
      basket: [],
      reminders: [],
      updatedAt: new Date(),
    };
    this.sessions.set(session.code, session);
    return session;
  }

  async findByCode(code: string): Promise<SessionRecord | undefined> {
    return this.sessions.get(code);
  }

  async updateBasket(input: {
    code: string;
    hostToken: string;
    basket: BasketItem[];
    currency?: string;
    now: Date;
    expiresAt: Date;
  }): Promise<MutationResult> {
    const session = this.live(input.code, input.now);
    if (!session) return { status: "notFound" };
    if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };
    session.basket = input.basket;
    session.currency = input.currency ?? session.currency;
    session.updatedAt = input.now;
    session.expiresAt = input.expiresAt;
    return { status: "ok", updatedAt: session.updatedAt };
  }

  async addReminder(input: {
    code: string;
    reminder: Reminder;
    now: Date;
    maxReminders: number;
  }): Promise<MutationResult> {
    const session = this.live(input.code, input.now);
    if (!session) return { status: "notFound" };
    if (session.reminders.length >= input.maxReminders) return { status: "limit" };
    session.reminders.push(input.reminder);
    session.updatedAt = input.now;
    return { status: "ok" };
  }

  async completeReminder(input: {
    code: string;
    reminderId: string;
    hostToken: string;
    now: Date;
  }): Promise<MutationResult> {
    const session = this.live(input.code, input.now);
    if (!session) return { status: "notFound" };
    if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };
    const reminder = session.reminders.find((candidate) => candidate.id === input.reminderId);
    if (!reminder) return { status: "notFound" };
    reminder.done = true;
    session.updatedAt = input.now;
    return { status: "ok" };
  }

  async delete(input: {
    code: string;
    hostToken: string;
    now: Date;
  }): Promise<MutationResult> {
    const session = this.live(input.code, input.now);
    if (!session) return { status: "notFound" };
    if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };
    this.sessions.delete(input.code);
    return { status: "ok" };
  }

  private live(code: string, now: Date): SessionRecord | undefined {
    const session = this.sessions.get(code);
    return session && session.expiresAt > now ? session : undefined;
  }
}

const repository = new MemoryRepository();
const api = Router();
api.use(createSessionsRouter(repository));
const server = createHttpApp(api).listen(0);
let baseUrl: string;

before(async () => {
  await new Promise<void>((resolve) => server.listening ? resolve() : server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});

after(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => error ? reject(error) : resolve()),
  );
});

async function jsonRequest(path: string, init?: RequestInit) {
  const response = await fetch(`${baseUrl}${path}`, init);
  const body = await response.json();
  return { response, body };
}

test("anonymous read and reminder sharing preserve host-only mutations", async () => {
  const created = await jsonRequest("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "  Host  ", currency: "usd" }),
  });
  assert.equal(created.response.status, 201);
  assert.match(created.body.code, /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/);
  assert.match(created.body.hostToken, /^[a-f0-9]{64}$/);
  const { code, hostToken } = created.body;

  const anonymous = await jsonRequest(`/sessions/${code.toLowerCase()}`);
  assert.equal(anonymous.response.status, 200);
  assert.equal(anonymous.body.hostName, "Host");
  assert.equal(anonymous.body.currency, "USD");
  assert.equal("hostToken" in anonymous.body, false);

  const missingAuth = await jsonRequest(`/sessions/${code}/basket`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ basket: [] }),
  });
  assert.equal(missingAuth.response.status, 401);

  const badAuth = await jsonRequest(`/sessions/${code}/basket`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-host-token": "0".repeat(64) },
    body: JSON.stringify({ basket: [] }),
  });
  assert.equal(badAuth.response.status, 403);

  const updated = await jsonRequest(`/sessions/${code}/basket`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-host-token": hostToken },
    body: JSON.stringify({
      basket: [{ id: "item-1", name: "Milk", price: 8.5, quantity: 2 }],
    }),
  });
  assert.equal(updated.response.status, 200);

  const added = await jsonRequest(`/sessions/${code}/reminders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "  Bread  ", addedBy: "Viewer" }),
  });
  assert.equal(added.response.status, 201);
  assert.equal(added.body.name, "Bread");

  const badComplete = await jsonRequest(`/sessions/${code}/reminders/${added.body.id}`, {
    method: "PATCH",
    headers: { "x-host-token": "f".repeat(64) },
  });
  assert.equal(badComplete.response.status, 403);

  const missingReminder = await jsonRequest(`/sessions/${code}/reminders/${"a".repeat(16)}`, {
    method: "PATCH",
    headers: { "x-host-token": hostToken },
  });
  assert.equal(missingReminder.response.status, 404);

  const completed = await jsonRequest(`/sessions/${code}/reminders/${added.body.id}`, {
    method: "PATCH",
    headers: { "x-host-token": hostToken },
  });
  assert.equal(completed.response.status, 200);

  const shared = await jsonRequest(`/sessions/${code}`);
  assert.equal(shared.body.basket[0].name, "Milk");
  assert.equal(shared.body.reminders[0].done, true);

  const badDelete = await jsonRequest(`/sessions/${code}`, {
    method: "DELETE",
    headers: { "x-host-token": "0".repeat(64) },
  });
  assert.equal(badDelete.response.status, 403);

  const deleted = await jsonRequest(`/sessions/${code}`, {
    method: "DELETE",
    headers: { "x-host-token": hostToken },
  });
  assert.equal(deleted.response.status, 200);
  assert.equal((await jsonRequest(`/sessions/${code}`)).response.status, 404);
});

test("malformed, oversized, and invalid requests return bounded errors", async () => {
  const malformed = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: '{"hostName":',
  });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: "Malformed JSON" });

  const oversized = await fetch(`${baseUrl}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "x", padding: "a".repeat(50_000) }),
  });
  assert.equal(oversized.status, 413);

  assert.equal((await jsonRequest("/sessions/not-a-code")).response.status, 400);
  const blankName = await jsonRequest("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "   " }),
  });
  assert.equal(blankName.response.status, 400);

  const created = await jsonRequest("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Validation" }),
  });
  const invalidBasket = await jsonRequest(`/sessions/${created.body.code}/basket`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-host-token": created.body.hostToken,
    },
    body: JSON.stringify({
      basket: [{ id: "x", name: "", price: -1, quantity: 0 }],
      unexpected: true,
    }),
  });
  assert.equal(invalidBasket.response.status, 400);
});

test("expired sessions are consistently unavailable", async () => {
  const created = await jsonRequest("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Expired" }),
  });
  repository.sessions.get(created.body.code)!.expiresAt = new Date(0);

  assert.equal((await jsonRequest(`/sessions/${created.body.code}`)).response.status, 404);
  const update = await jsonRequest(`/sessions/${created.body.code}/basket`, {
    method: "PUT",
    headers: {
      "content-type": "application/json",
      "x-host-token": created.body.hostToken,
    },
    body: JSON.stringify({ basket: [] }),
  });
  assert.equal(update.response.status, 404);
  const reminder = await jsonRequest(`/sessions/${created.body.code}/reminders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "No" }),
  });
  assert.equal(reminder.response.status, 404);
  const deletion = await jsonRequest(`/sessions/${created.body.code}`, {
    method: "DELETE",
    headers: { "x-host-token": created.body.hostToken },
  });
  assert.equal(deletion.response.status, 404);
});

test("anonymous reminders have a per-session storage cap", async () => {
  const created = await jsonRequest("/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Capped" }),
  });
  const session = repository.sessions.get(created.body.code)!;
  session.reminders = Array.from({ length: 100 }, (_, index) => ({
    id: index.toString(16).padStart(16, "0"),
    name: `Reminder ${index}`,
    addedAt: new Date().toISOString(),
    done: false,
  }));

  const capped = await jsonRequest(`/sessions/${created.body.code}/reminders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name: "One too many" }),
  });
  assert.equal(capped.response.status, 409);
  assert.deepEqual(capped.body, { error: "Reminder limit reached" });
});

test("rate limits return 429 without relying on Origin", async () => {
  const limitedRepository = new MemoryRepository();
  const limitedApi = Router();
  limitedApi.use(createSessionsRouter(limitedRepository, {
    create: { windowMs: 60_000, max: 1 },
    read: { windowMs: 60_000, max: 10 },
    write: { windowMs: 60_000, max: 10 },
    reminder: { windowMs: 60_000, max: 10 },
  }));
  const limitedServer = createHttpApp(limitedApi).listen(0);
  await new Promise<void>((resolve) =>
    limitedServer.listening ? resolve() : limitedServer.once("listening", resolve),
  );
  const url = `http://127.0.0.1:${(limitedServer.address() as AddressInfo).port}/api/sessions`;
  const init = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ hostName: "Mobile" }),
  };
  assert.equal((await fetch(url, init)).status, 201);
  const limited = await fetch(url, init);
  assert.equal(limited.status, 429);
  assert.ok(limited.headers.get("retry-after"));
  await new Promise<void>((resolve, reject) =>
    limitedServer.close((error) => error ? reject(error) : resolve()),
  );
});

test("token comparison accepts only equal values", () => {
  assert.equal(tokensEqual("a".repeat(64), "a".repeat(64)), true);
  assert.equal(tokensEqual("a".repeat(64), "b"), false);
});