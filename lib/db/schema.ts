import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", [
  "user",
  "psychiatrist",
  "admin",
]);
export const storyVisibilityEnum = pgEnum("story_visibility", [
  "private",
  "public_summary",
  "public_long",
]);
export const storyStatusEnum = pgEnum("story_status", [
  "draft", 
  "completed", 
  "pending_review", 
  "published", 
  "rejected"
]);

export const storyTypeEnum = pgEnum("story_type", [
  "life_story",
  "blog_story"
]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "pending",
  "confirmed",
  "completed",
  "cancelled",
  "rejected",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("user"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: uuid("owner_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: text("title"),
  storyType: storyTypeEnum("story_type").notNull().default("life_story"),
  content: text("content"), // For blog stories
  status: storyStatusEnum("status").notNull().default("draft"),
  visibility: storyVisibilityEnum("visibility").notNull().default("private"),
  bannerImageUrl: text("banner_image_url"),
  thumbnailImageUrl: text("thumbnail_image_url"),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").notNull().default(0),
  listenCount: integer("listen_count").notNull().default(0),
  generationConfig: jsonb("generation_config"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stages = pgTable("stages", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  stageIndex: integer("stage_index").notNull(),
  selection: text("selection"),
  options: jsonb("options"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const summaries = pgTable("summaries", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" })
    .unique(),
  userSummary: text("user_summary").notNull(),
  psySummary: text("psy_summary").notNull(),
  actionableSteps: jsonb("actionable_steps").notNull(),
  longFormStory: text("long_form_story"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const images = pgTable("images", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" })
    .unique(),
  url: text("url").notNull(),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const appointments = pgTable("appointments", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  psychiatristId: uuid("psychiatrist_id")
    .references(() => users.id, { onDelete: "set null" }),
  status: appointmentStatusEnum("status").notNull().default("pending"),
  appointmentDate: timestamp("appointment_date"),
  appointmentTime: timestamp("appointment_time"),
  googleMeetLink: text("google_meet_link"),
  notes: text("notes"),
  psychiatristFeedback: text("psychiatrist_feedback"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const storyAnalytics = pgTable("story_analytics", {
  id: uuid("id").primaryKey().defaultRandom(),
  storyId: uuid("story_id")
    .notNull()
    .references(() => stories.id, { onDelete: "cascade" }),
  eventType: text("event_type").notNull(), // 'view', 'listen', 'share'
  languageCode: text("language_code"), // for TTS events
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
  appointments: many(appointments),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
  owner: one(users, { fields: [stories.ownerId], references: [users.id] }),
  stages: many(stages),
  summary: one(summaries, {
    fields: [stories.id],
    references: [summaries.storyId],
  }),
  image: one(images, { fields: [stories.id], references: [images.storyId] }),
  analytics: many(storyAnalytics),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  user: one(users, { fields: [appointments.userId], references: [users.id] }),
  psychiatrist: one(users, { fields: [appointments.psychiatristId], references: [users.id] }),
  story: one(stories, {
    fields: [appointments.storyId],
    references: [stories.id],
  }),
}));

export const storyAnalyticsRelations = relations(storyAnalytics, ({ one }) => ({
  story: one(stories, {
    fields: [storyAnalytics.storyId],
    references: [stories.id],
  }),
}));
