CREATE TYPE "public"."appointment_status" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."content_flag_reason" AS ENUM('spam', 'inappropriate', 'harassment', 'hate_speech', 'violence', 'misinformation', 'copyright', 'other');--> statement-breakpoint
CREATE TYPE "public"."content_flag_status" AS ENUM('pending', 'approved', 'rejected', 'auto_removed');--> statement-breakpoint
CREATE TYPE "public"."content_type" AS ENUM('story', 'comment');--> statement-breakpoint
CREATE TYPE "public"."job_status" AS ENUM('pending', 'processing', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_type" AS ENUM('story_generation', 'image_generation', 'audio_generation');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."story_status" AS ENUM('draft', 'completed', 'pending_review', 'published', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."story_type" AS ENUM('life_story', 'blog_story');--> statement-breakpoint
CREATE TYPE "public"."story_visibility" AS ENUM('private', 'public_summary', 'public_long');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'psychiatrist', 'admin');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"psychiatrist_id" uuid,
	"status" "appointment_status" DEFAULT 'pending' NOT NULL,
	"appointment_date" timestamp,
	"appointment_time" timestamp,
	"google_meet_link" text,
	"notes" text,
	"psychiatrist_feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audio_chapters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"chapter_index" integer NOT NULL,
	"language" text NOT NULL,
	"audio_url" text NOT NULL,
	"duration" integer,
	"start_position" integer,
	"end_position" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"parent_comment_id" uuid,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_flags" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" "content_type" NOT NULL,
	"content_id" uuid NOT NULL,
	"reporter_id" uuid,
	"reason" "content_flag_reason" NOT NULL,
	"description" text,
	"status" "content_flag_status" DEFAULT 'pending' NOT NULL,
	"moderator_id" uuid,
	"moderator_notes" text,
	"auto_detected" boolean DEFAULT false NOT NULL,
	"confidence_score" integer,
	"resolved_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"job_type" "job_type" NOT NULL,
	"status" "job_status" DEFAULT 'pending' NOT NULL,
	"config" jsonb,
	"result" jsonb,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"url" text NOT NULL,
	"prompt" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "images_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
CREATE TABLE "life_stage_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stage_name" text NOT NULL,
	"content" text,
	"language" text DEFAULT 'en',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "likes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "print_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"order_status" "order_status" DEFAULT 'pending' NOT NULL,
	"book_size" text NOT NULL,
	"cover_type" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"total_amount" integer NOT NULL,
	"razorpay_order_id" text,
	"razorpay_payment_id" text,
	"shipping_address" jsonb NOT NULL,
	"tracking_number" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"stage_index" integer NOT NULL,
	"selection" text,
	"options" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text,
	"story_type" "story_type" DEFAULT 'life_story' NOT NULL,
	"content" text,
	"description" text,
	"status" "story_status" DEFAULT 'draft' NOT NULL,
	"visibility" "story_visibility" DEFAULT 'private' NOT NULL,
	"banner_image_url" text,
	"thumbnail_image_url" text,
	"published_at" timestamp,
	"view_count" integer DEFAULT 0 NOT NULL,
	"listen_count" integer DEFAULT 0 NOT NULL,
	"share_count" integer DEFAULT 0 NOT NULL,
	"generation_config" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"language_code" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "story_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"stage_index" integer NOT NULL,
	"stage_name" text NOT NULL,
	"content" text,
	"audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"story_id" uuid NOT NULL,
	"user_summary" text NOT NULL,
	"psy_summary" text NOT NULL,
	"actionable_steps" jsonb NOT NULL,
	"long_form_story" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "summaries_story_id_unique" UNIQUE("story_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_id" text NOT NULL,
	"first_name" text,
	"last_name" text,
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"has_completed_onboarding" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_clerk_id_unique" UNIQUE("clerk_id")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_psychiatrist_id_users_id_fk" FOREIGN KEY ("psychiatrist_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audio_chapters" ADD CONSTRAINT "audio_chapters_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_comment_id_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_reporter_id_users_id_fk" FOREIGN KEY ("reporter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_flags" ADD CONSTRAINT "content_flags_moderator_id_users_id_fk" FOREIGN KEY ("moderator_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "generation_jobs" ADD CONSTRAINT "generation_jobs_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "images" ADD CONSTRAINT "images_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_stage_templates" ADD CONSTRAINT "life_stage_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "likes" ADD CONSTRAINT "likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stages" ADD CONSTRAINT "stages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stories" ADD CONSTRAINT "stories_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_analytics" ADD CONSTRAINT "story_analytics_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "story_stages" ADD CONSTRAINT "story_stages_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_story_id_stories_id_fk" FOREIGN KEY ("story_id") REFERENCES "public"."stories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audio_chapters_story_id_idx" ON "audio_chapters" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "audio_chapters_language_idx" ON "audio_chapters" USING btree ("language");--> statement-breakpoint
CREATE INDEX "audio_chapters_story_language_idx" ON "audio_chapters" USING btree ("story_id","language");--> statement-breakpoint
CREATE INDEX "comments_story_id_idx" ON "comments" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "comments_user_id_idx" ON "comments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "comments_parent_comment_id_idx" ON "comments" USING btree ("parent_comment_id");--> statement-breakpoint
CREATE INDEX "comments_created_at_idx" ON "comments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "content_flags_content_type_idx" ON "content_flags" USING btree ("content_type");--> statement-breakpoint
CREATE INDEX "content_flags_content_id_idx" ON "content_flags" USING btree ("content_id");--> statement-breakpoint
CREATE INDEX "content_flags_status_idx" ON "content_flags" USING btree ("status");--> statement-breakpoint
CREATE INDEX "content_flags_reason_idx" ON "content_flags" USING btree ("reason");--> statement-breakpoint
CREATE INDEX "content_flags_created_at_idx" ON "content_flags" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "content_flags_content_status_idx" ON "content_flags" USING btree ("content_type","content_id","status");--> statement-breakpoint
CREATE INDEX "generation_jobs_story_id_idx" ON "generation_jobs" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "generation_jobs_status_idx" ON "generation_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "generation_jobs_job_type_idx" ON "generation_jobs" USING btree ("job_type");--> statement-breakpoint
CREATE INDEX "generation_jobs_created_at_idx" ON "generation_jobs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "life_stage_templates_user_id_idx" ON "life_stage_templates" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "life_stage_templates_stage_name_idx" ON "life_stage_templates" USING btree ("stage_name");--> statement-breakpoint
CREATE INDEX "likes_story_id_idx" ON "likes" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "likes_user_id_idx" ON "likes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "likes_story_user_idx" ON "likes" USING btree ("story_id","user_id");--> statement-breakpoint
CREATE INDEX "print_orders_user_id_idx" ON "print_orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "print_orders_story_id_idx" ON "print_orders" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "print_orders_order_status_idx" ON "print_orders" USING btree ("order_status");--> statement-breakpoint
CREATE INDEX "print_orders_razorpay_order_id_idx" ON "print_orders" USING btree ("razorpay_order_id");--> statement-breakpoint
CREATE INDEX "print_orders_created_at_idx" ON "print_orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "story_analytics_story_id_idx" ON "story_analytics" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_analytics_event_type_idx" ON "story_analytics" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "story_analytics_created_at_idx" ON "story_analytics" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "story_analytics_story_event_idx" ON "story_analytics" USING btree ("story_id","event_type");--> statement-breakpoint
CREATE INDEX "story_stages_story_id_idx" ON "story_stages" USING btree ("story_id");--> statement-breakpoint
CREATE INDEX "story_stages_stage_index_idx" ON "story_stages" USING btree ("stage_index");