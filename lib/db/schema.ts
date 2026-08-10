import { sqliteTable, text, integer, primaryKey } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";

const TONES = ["forest", "coral", "butter", "sage", "peri", "rose", "ink", "plum"] as const;
const PRIORITIES = ["p1", "p2", "p3", "p4"] as const;

const now = sql`(unixepoch())`;
const uuid = () => crypto.randomUUID();

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(uuid),
  email: text("email").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey().$defaultFn(uuid),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey().$defaultFn(uuid),
  spaceId: text("space_id")
    .notNull()
    .references(() => spaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  tagline: text("tagline").notNull().default(""),
  color: text("color").notNull().default("#2A8C7A"),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey().$defaultFn(uuid),
  projectId: text("project_id")
    .notNull()
    .references(() => projects.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  summary: text("summary").notNull().default(""),
  tone: text("tone", { enum: TONES }).notNull().default("ink"),
  priority: text("priority", { enum: PRIORITIES }),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
  collapsed: integer("collapsed", { mode: "boolean" }).notNull().default(false),
  position: integer("position").notNull().default(0),
  startDate: text("start_date"),
  endDate: text("end_date"),
  issueUrl: text("issue_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const decisions = sqliteTable("decisions", {
  id: text("id").primaryKey().$defaultFn(uuid),
  topicId: text("topic_id")
    .notNull()
    .references(() => topics.id, { onDelete: "cascade" }),
  title: text("title").notNull().default(""),
  note: text("note").notNull().default(""),
  position: integer("position").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
});

export const links = sqliteTable(
  "links",
  {
    outbound: text("outbound")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
    inbound: text("inbound")
      .notNull()
      .references(() => topics.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.outbound, t.inbound] })],
);

export const chats = sqliteTable("chats", {
  id: text("id").primaryKey().$defaultFn(uuid),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New chat"),
  mode: text("mode").notNull().default("plan"),
  messages: text("messages", { mode: "json" }).$type<unknown[]>().notNull().default(sql`'[]'`),
  inputTokens: integer("input_tokens").notNull().default(0),
  outputTokens: integer("output_tokens").notNull().default(0),
  cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
  cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
  costMicros: integer("cost_micros").notNull().default(0),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(now),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const config = sqliteTable("config", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(now),
});

export const usersRelations = relations(users, ({ many }) => ({
  spaces: many(spaces),
}));

export const spacesRelations = relations(spaces, ({ one, many }) => ({
  user: one(users, { fields: [spaces.userId], references: [users.id] }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  space: one(spaces, { fields: [projects.spaceId], references: [spaces.id] }),
  topics: many(topics),
}));

export const topicsRelations = relations(topics, ({ one, many }) => ({
  project: one(projects, { fields: [topics.projectId], references: [projects.id] }),
  decisions: many(decisions),
}));

export const decisionsRelations = relations(decisions, ({ one }) => ({
  topic: one(topics, { fields: [decisions.topicId], references: [topics.id] }),
}));
