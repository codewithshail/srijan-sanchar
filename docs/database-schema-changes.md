# Database Schema Changes - Enhanced Story Platform

## Overview
This document outlines the database schema enhancements made to support the enhanced story platform features.

## Changes Made

### 1. Enhanced Stories Table
Added new fields to support dual story types and publication workflow:

- `story_type` (enum): Distinguishes between 'life_story' and 'blog_story'
- `content` (text): Stores blog story content (rich text)
- `banner_image_url` (text): URL for story banner image
- `thumbnail_image_url` (text): URL for story thumbnail image
- `published_at` (timestamp): Publication timestamp
- `view_count` (integer): Number of times story has been viewed
- `listen_count` (integer): Number of times story has been listened to via TTS

### 2. Enhanced Story Status Enum
Extended `story_status` enum with new values:
- `pending_review`: Story submitted for publication review
- `published`: Story approved and publicly visible
- `rejected`: Story rejected during review process

### 3. New Story Type Enum
Created `story_type` enum with values:
- `life_story`: Traditional 7-stage therapeutic stories
- `blog_story`: Free-form creative writing stories

### 4. New Story Analytics Table
Created `story_analytics` table for tracking engagement:
- `id` (uuid): Primary key
- `story_id` (uuid): Reference to stories table
- `event_type` (text): Type of event ('view', 'listen', 'share')
- `language_code` (text): Language used for TTS events
- `created_at` (timestamp): Event timestamp

### 5. Enhanced Appointments Table
Added new fields for improved psychiatrist functionality:
- `appointment_date` (timestamp): Scheduled appointment date/time
- `notes` (text): Appointment notes
- `psychiatrist_feedback` (text): Structured feedback from psychiatrist

## Database Relations
- Stories have many analytics events (one-to-many)
- Analytics events belong to one story (many-to-one)
- Existing relations maintained for backward compatibility

## Migration Strategy
- Used `drizzle-kit push` to apply schema changes directly
- All changes are backward compatible with existing data
- New fields have appropriate defaults or allow null values

## Verification
Schema changes have been verified through:
1. Successful `drizzle-kit push` execution
2. TypeScript compilation of schema definitions
3. Field existence validation in schema objects

## Scripts Added
- `npm run db:push`: Apply schema changes to database
- `npm run db:generate`: Generate migration files (when working)
- `npm run db:studio`: Open Drizzle Studio for database inspection
- `npm run db:verify`: Verify schema changes (custom script)

## Next Steps
The enhanced schema supports all requirements for:
- Dual story creation modes (Requirements 2.5)
- Story publication workflow (Requirements 4.5)
- Analytics and engagement tracking (Requirements 8.2, 8.3)
- Enhanced psychiatrist functionality