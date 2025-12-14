import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  boolean,
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

export const jobStatusEnum = pgEnum("job_status", [
  "pending",
  "processing",
  "completed",
  "failed",
]);

export const jobTypeEnum = pgEnum("job_type", [
  "story_generation",
  "image_generation",
  "audio_generation",
]);

export const contentFlagStatusEnum = pgEnum("content_flag_status", [
  "pending",
  "approved",
  "rejected",
  "auto_removed",
]);

export const contentFlagReasonEnum = pgEnum("content_flag_reason", [
  "spam",
  "inappropriate",
  "harassment",
  "hate_speech",
  "violence",
  "misinformation",
  "copyright",
  "other",
]);

export const contentTypeEnum = pgEnum("content_type", [
  "story",
  "comment",
]);

export const orderStatusEnum = pgEnum("order_status", [
  "pending",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  clerkId: text("clerk_id").notNull().unique(),
  firstName: text("first_name"),
  lastName: text("last_name"),
  role: userRoleEnum("role").notNull().default("user"),
  hasCompletedOnboarding: boolean("has_completed_onboarding").default(false).notNull(),
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
  description: text("description"), // Story description for SEO and sharing
  status: storyStatusEnum("status").notNull().default("draft"),
  visibility: storyVisibilityEnum("visibility").notNull().default("private"),
  bannerImageUrl: text("banner_image_url"),
  thumbnailImageUrl: text("thumbnail_image_url"),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").notNull().default(0),
  listenCount: integer("listen_count").notNull().default(0),
  shareCount: integer("share_count").notNull().default(0),
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

export const storyAnalytics = pgTable(
  "story_analytics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(), // 'view', 'listen', 'share'
    languageCode: text("language_code"), // for TTS events
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("story_analytics_story_id_idx").on(table.storyId),
    eventTypeIdx: index("story_analytics_event_type_idx").on(table.eventType),
    createdAtIdx: index("story_analytics_created_at_idx").on(table.createdAt),
    // Composite index for common query patterns
    storyEventIdx: index("story_analytics_story_event_idx").on(
      table.storyId,
      table.eventType
    ),
  })
);

// Life Stage Templates - stores user's saved stage content for reuse
export const lifeStageTemplates = pgTable(
  "life_stage_templates",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    stageName: text("stage_name").notNull(), // "childhood", "teenage", etc.
    content: text("content"),
    language: text("language").default("en"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("life_stage_templates_user_id_idx").on(table.userId),
    stageNameIdx: index("life_stage_templates_stage_name_idx").on(
      table.stageName
    ),
  })
);

// Story Stages - stores individual life story stages
export const storyStages = pgTable(
  "story_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    stageIndex: integer("stage_index").notNull(),
    stageName: text("stage_name").notNull(),
    content: text("content"),
    audioUrl: text("audio_url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("story_stages_story_id_idx").on(table.storyId),
    stageIndexIdx: index("story_stages_stage_index_idx").on(table.stageIndex),
  })
);

// Comments - supports nested replies
export const comments: any = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parentCommentId: uuid("parent_comment_id").references(() => comments.id, {
      onDelete: "cascade",
    }),
    content: text("content").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("comments_story_id_idx").on(table.storyId),
    userIdIdx: index("comments_user_id_idx").on(table.userId),
    parentCommentIdIdx: index("comments_parent_comment_id_idx").on(
      table.parentCommentId
    ),
    createdAtIdx: index("comments_created_at_idx").on(table.createdAt),
  })
);

// Likes - tracks story likes
export const likes = pgTable(
  "likes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("likes_story_id_idx").on(table.storyId),
    userIdIdx: index("likes_user_id_idx").on(table.userId),
    // Composite unique index to prevent duplicate likes
    storyUserIdx: index("likes_story_user_idx").on(table.storyId, table.userId),
  })
);

// Audio Chapters - stores 1-minute audio chapters for stories
export const audioChapters = pgTable(
  "audio_chapters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    chapterIndex: integer("chapter_index").notNull(),
    language: text("language").notNull(),
    audioUrl: text("audio_url").notNull(),
    duration: integer("duration"), // in seconds
    startPosition: integer("start_position"), // character position in story
    endPosition: integer("end_position"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("audio_chapters_story_id_idx").on(table.storyId),
    languageIdx: index("audio_chapters_language_idx").on(table.language),
    // Composite index for fetching chapters by story and language
    storyLanguageIdx: index("audio_chapters_story_language_idx").on(
      table.storyId,
      table.language
    ),
  })
);

// Print Orders - tracks print-on-demand orders
export const printOrders = pgTable(
  "print_orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    orderStatus: orderStatusEnum("order_status").notNull().default("pending"),
    bookSize: text("book_size").notNull(), // A5, A4, custom
    coverType: text("cover_type").notNull(), // hardcover, paperback
    quantity: integer("quantity").notNull().default(1),
    totalAmount: integer("total_amount").notNull(), // in paise
    razorpayOrderId: text("razorpay_order_id"),
    razorpayPaymentId: text("razorpay_payment_id"),
    shippingAddress: jsonb("shipping_address").notNull(),
    trackingNumber: text("tracking_number"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    userIdIdx: index("print_orders_user_id_idx").on(table.userId),
    storyIdIdx: index("print_orders_story_id_idx").on(table.storyId),
    orderStatusIdx: index("print_orders_order_status_idx").on(
      table.orderStatus
    ),
    razorpayOrderIdIdx: index("print_orders_razorpay_order_id_idx").on(
      table.razorpayOrderId
    ),
    createdAtIdx: index("print_orders_created_at_idx").on(table.createdAt),
  })
);

// Generation Jobs - tracks background processing jobs
export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    storyId: uuid("story_id")
      .notNull()
      .references(() => stories.id, { onDelete: "cascade" }),
    jobType: jobTypeEnum("job_type").notNull(),
    status: jobStatusEnum("status").notNull().default("pending"),
    config: jsonb("config"),
    result: jsonb("result"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    storyIdIdx: index("generation_jobs_story_id_idx").on(table.storyId),
    statusIdx: index("generation_jobs_status_idx").on(table.status),
    jobTypeIdx: index("generation_jobs_job_type_idx").on(table.jobType),
    createdAtIdx: index("generation_jobs_created_at_idx").on(table.createdAt),
  })
);

export const usersRelations = relations(users, ({ many }) => ({
  stories: many(stories),
  appointments: many(appointments),
  lifeStageTemplates: many(lifeStageTemplates),
  comments: many(comments),
  likes: many(likes),
  printOrders: many(printOrders),
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
  storyStages: many(storyStages),
  comments: many(comments),
  likes: many(likes),
  audioChapters: many(audioChapters),
  printOrders: many(printOrders),
  generationJobs: many(generationJobs),
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

export const lifeStageTemplatesRelations = relations(
  lifeStageTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [lifeStageTemplates.userId],
      references: [users.id],
    }),
  })
);

export const storyStagesRelations = relations(storyStages, ({ one }) => ({
  story: one(stories, {
    fields: [storyStages.storyId],
    references: [stories.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  story: one(stories, {
    fields: [comments.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  parentComment: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: "replies",
  }),
  replies: many(comments, { relationName: "replies" }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  story: one(stories, {
    fields: [likes.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
}));

export const audioChaptersRelations = relations(audioChapters, ({ one }) => ({
  story: one(stories, {
    fields: [audioChapters.storyId],
    references: [stories.id],
  }),
}));

export const printOrdersRelations = relations(printOrders, ({ one }) => ({
  story: one(stories, {
    fields: [printOrders.storyId],
    references: [stories.id],
  }),
  user: one(users, {
    fields: [printOrders.userId],
    references: [users.id],
  }),
}));

export const generationJobsRelations = relations(generationJobs, ({ one }) => ({
  story: one(stories, {
    fields: [generationJobs.storyId],
    references: [stories.id],
  }),
}));

// Content Flags - tracks flagged content for moderation
export const contentFlags = pgTable(
  "content_flags",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    contentType: contentTypeEnum("content_type").notNull(),
    contentId: uuid("content_id").notNull(), // story_id or comment_id
    reporterId: uuid("reporter_id").references(() => users.id, { onDelete: "set null" }), // null for auto-detected
    reason: contentFlagReasonEnum("reason").notNull(),
    description: text("description"),
    status: contentFlagStatusEnum("status").notNull().default("pending"),
    moderatorId: uuid("moderator_id").references(() => users.id, { onDelete: "set null" }),
    moderatorNotes: text("moderator_notes"),
    autoDetected: boolean("auto_detected").default(false).notNull(),
    confidenceScore: integer("confidence_score"), // 0-100 for auto-detection
    resolvedAt: timestamp("resolved_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    contentTypeIdx: index("content_flags_content_type_idx").on(table.contentType),
    contentIdIdx: index("content_flags_content_id_idx").on(table.contentId),
    statusIdx: index("content_flags_status_idx").on(table.status),
    reasonIdx: index("content_flags_reason_idx").on(table.reason),
    createdAtIdx: index("content_flags_created_at_idx").on(table.createdAt),
    // Composite index for common queries
    contentStatusIdx: index("content_flags_content_status_idx").on(
      table.contentType,
      table.contentId,
      table.status
    ),
  })
);

export const contentFlagsRelations = relations(contentFlags, ({ one }) => ({
  reporter: one(users, {
    fields: [contentFlags.reporterId],
    references: [users.id],
    relationName: "flagReporter",
  }),
  moderator: one(users, {
    fields: [contentFlags.moderatorId],
    references: [users.id],
    relationName: "flagModerator",
  }),
}));
