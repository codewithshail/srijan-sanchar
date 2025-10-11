import { db } from "../lib/db";
import { sql } from "drizzle-orm";

async function verifySchema() {
  console.log("🔍 Verifying database schema...\n");

  try {
    // Check all required tables exist
    const tables = [
      "users",
      "stories",
      "stages",
      "summaries",
      "images",
      "appointments",
      "story_analytics",
      "life_stage_templates",
      "story_stages",
      "comments",
      "likes",
      "audio_chapters",
      "print_orders",
      "generation_jobs",
    ];

    console.log("📋 Checking tables...");
    for (const table of tables) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${table}
        );
      `);
      const exists = result.rows[0]?.exists;
      console.log(`  ${exists ? "✅" : "❌"} ${table}`);
    }

    // Check indexes
    console.log("\n📊 Checking indexes...");
    const indexes = [
      "life_stage_templates_user_id_idx",
      "life_stage_templates_stage_name_idx",
      "story_stages_story_id_idx",
      "story_stages_stage_index_idx",
      "comments_story_id_idx",
      "comments_user_id_idx",
      "comments_parent_comment_id_idx",
      "comments_created_at_idx",
      "likes_story_id_idx",
      "likes_user_id_idx",
      "likes_story_user_idx",
      "audio_chapters_story_id_idx",
      "audio_chapters_language_idx",
      "audio_chapters_story_language_idx",
      "print_orders_user_id_idx",
      "print_orders_story_id_idx",
      "print_orders_order_status_idx",
      "print_orders_razorpay_order_id_idx",
      "print_orders_created_at_idx",
      "generation_jobs_story_id_idx",
      "generation_jobs_status_idx",
      "generation_jobs_job_type_idx",
      "generation_jobs_created_at_idx",
    ];

    for (const index of indexes) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM pg_indexes 
          WHERE schemaname = 'public' 
          AND indexname = ${index}
        );
      `);
      const exists = result.rows[0]?.exists;
      console.log(`  ${exists ? "✅" : "❌"} ${index}`);
    }

    // Check enums
    console.log("\n🏷️  Checking enums...");
    const enums = [
      "user_role",
      "story_visibility",
      "story_status",
      "story_type",
      "appointment_status",
      "job_status",
      "job_type",
      "order_status",
    ];

    for (const enumName of enums) {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM pg_type 
          WHERE typname = ${enumName}
        );
      `);
      const exists = result.rows[0]?.exists;
      console.log(`  ${exists ? "✅" : "❌"} ${enumName}`);
    }

    console.log("\n✨ Schema verification complete!");
  } catch (error) {
    console.error("❌ Error verifying schema:", error);
    process.exit(1);
  }

  process.exit(0);
}

verifySchema();
