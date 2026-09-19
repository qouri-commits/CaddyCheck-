import { eq, lt } from "drizzle-orm";
import { db, sessionsTable } from "@workspace/db";
import {
  createSessionsRouter,
  tokensEqual,
  type MutationResult,
  type SessionRecord,
  type SessionRepository,
} from "./sessions-router";

function asRecord(session: typeof sessionsTable.$inferSelect): SessionRecord {
  return session;
}

const repository: SessionRepository = {
  async cleanExpired(now) {
    await db.delete(sessionsTable).where(lt(sessionsTable.expiresAt, now));
  },

  async create(input) {
    const [session] = await db
      .insert(sessionsTable)
      .values({ ...input, basket: [], reminders: [] })
      .returning();
    return asRecord(session);
  },

  async findByCode(code) {
    const session = await db.query.sessionsTable.findFirst({
      where: eq(sessionsTable.code, code),
    });
    return session ? asRecord(session) : undefined;
  },

  async updateBasket(input): Promise<MutationResult> {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.code, input.code))
        .for("update");
      if (!session || session.expiresAt <= input.now) return { status: "notFound" };
      if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };

      const [updated] = await tx
        .update(sessionsTable)
        .set({
          basket: input.basket,
          currency: input.currency ?? session.currency,
          updatedAt: input.now,
          expiresAt: input.expiresAt,
        })
        .where(eq(sessionsTable.id, session.id))
        .returning();
      return { status: "ok", updatedAt: updated.updatedAt };
    });
  },

  async addReminder(input): Promise<MutationResult> {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.code, input.code))
        .for("update");
      if (!session || session.expiresAt <= input.now) return { status: "notFound" };
      if (session.reminders.length >= input.maxReminders) return { status: "limit" };

      await tx
        .update(sessionsTable)
        .set({ reminders: [...session.reminders, input.reminder], updatedAt: input.now })
        .where(eq(sessionsTable.id, session.id));
      return { status: "ok" };
    });
  },

  async completeReminder(input): Promise<MutationResult> {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.code, input.code))
        .for("update");
      if (!session || session.expiresAt <= input.now) return { status: "notFound" };
      if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };
      if (!session.reminders.some((reminder) => reminder.id === input.reminderId)) {
        return { status: "notFound" };
      }

      await tx
        .update(sessionsTable)
        .set({
          reminders: session.reminders.map((reminder) =>
            reminder.id === input.reminderId ? { ...reminder, done: true } : reminder,
          ),
          updatedAt: input.now,
        })
        .where(eq(sessionsTable.id, session.id));
      return { status: "ok" };
    });
  },

  async delete(input): Promise<MutationResult> {
    return db.transaction(async (tx) => {
      const [session] = await tx
        .select()
        .from(sessionsTable)
        .where(eq(sessionsTable.code, input.code))
        .for("update");
      if (!session || session.expiresAt <= input.now) return { status: "notFound" };
      if (!tokensEqual(session.hostToken, input.hostToken)) return { status: "forbidden" };
      await tx.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
      return { status: "ok" };
    });
  },
};

export default createSessionsRouter(repository);