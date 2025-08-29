import { pgTable, uuid, text, timestamp, integer, jsonb, pgEnum } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const userRoleEnum = pgEnum("user_role", ["user", "psychiatrist", "admin"]);
export const storyVisibilityEnum = pgEnum("story_visibility", ["private", "public_summary", "public_long"]);
export const storyStatusEnum = pgEnum("story_status", ["draft", "completed"]);

export const users = pgTable("users", {
	id: uuid("id").primaryKey().defaultRandom(),
	clerkId: text("clerk_id").notNull().unique(),
	role: userRoleEnum("role").notNull().default("user"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stories = pgTable("stories", {
	id: uuid("id").primaryKey().defaultRandom(),
	ownerId: uuid("owner_id").notNull().references(() => users.id, { onDelete: 'cascade' }),
	title: text("title"),
    status: storyStatusEnum("status").notNull().default("draft"),
	visibility: storyVisibilityEnum("visibility").notNull().default("private"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const stages = pgTable("stages", {
	id: uuid("id").primaryKey().defaultRandom(),
	storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: 'cascade' }),
	stageIndex: integer("stage_index").notNull(),
	selection: text("selection"),
	options: jsonb("options").$type<string[]>(),
	regenerationCount: integer("regen_count").notNull().default(0),
});

export const summaries = pgTable("summaries", {
	id: uuid("id").primaryKey().defaultRandom(),
	storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: 'cascade' }).unique(),
	userSummary: text("user_summary"),
	psySummary: text("psy_summary"),
	longForm: text("long_form"),
    actionableSteps: jsonb("actionable_steps").$type<string[]>(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const images = pgTable("images", {
	id: uuid("id").primaryKey().defaultRandom(),
	storyId: uuid("story_id").notNull().references(() => stories.id, { onDelete: 'cascade' }).unique(),
	prompt: text("prompt"),
	url: text("url"),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
	stories: many(stories),
}));

export const storiesRelations = relations(stories, ({ one, many }) => ({
	owner: one(users, { fields: [stories.ownerId], references: [users.id] }),
	stages: many(stages),
	summary: one(summaries, { fields: [stories.id], references: [summaries.storyId] }),
	image: one(images, { fields: [stories.id], references: [images.storyId] }),
}));