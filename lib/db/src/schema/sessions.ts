import { jsonb, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { z } from "zod/v4";

export const SessionBasketItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.number(),
  quantity: z.number(),
  barcode: z.string().optional(),
  imageUrl: z.string().optional(),
});

export const SessionReminderSchema = z.object({
  id: z.string(),
  name: z.string(),
  addedBy: z.string().optional(),
  addedAt: z.string(),
  done: z.boolean(),
});

export type SessionBasketItem = z.infer<typeof SessionBasketItemSchema>;
export type SessionReminder = z.infer<typeof SessionReminderSchema>;

export const sessionsTable = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: varchar("code", { length: 6 }).notNull().unique(),
  hostToken: varchar("host_token", { length: 64 }).notNull(),
  hostName: varchar("host_name", { length: 50 }).notNull(),
  basket: jsonb("basket").notNull().$type<SessionBasketItem[]>(),
  reminders: jsonb("reminders").notNull().$type<SessionReminder[]>(),
  currency: varchar("currency", { length: 5 }).notNull().default("MAD"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

export type Session = typeof sessionsTable.$inferSelect;
