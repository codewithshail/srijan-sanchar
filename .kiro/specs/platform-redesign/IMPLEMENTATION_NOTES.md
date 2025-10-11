# Background Job Processing System - Implementation Notes

## Overview
Implemented a complete background job processing system using BullMQ and Redis for handling story generation, image generation, and audio generation tasks.

## Key Features Implemented

### 1. Job Queue System (`lib/jobs/queue.ts`)
- Three separate queues for different job types:
  - Story Generation Queue
  - Image Generation Queue
  - Audio Generation Queue
- Automatic retry with exponential backoff
- Job status tracking and monitoring
- Queue statistics and management

### 2. Job Processors

#### Story Generation Processor (`lib/jobs/processors/story-generation.ts`)
- Handles both life stories (7 stages) and creative stories
- **Page-based generation**: Generates stories with exact page count (4, 8, 12, 16, 20, custom)
- Calculates target word count: ~250 words per page
- Uses Gemini AI to expand raw content into full narrative
- Optional grammar improvement
- Configurable tone and target audience
- Stores generation config with story

#### Image Generation Processor (`lib/jobs/processors/image-generation.ts`)
- Generates contextual images using Google Imagen-4
- Creates image prompts from story content using Gemini
- **Uses Cloudinary for storage** (not S3)
- Supports multiple image styles (realistic, artistic, minimalist)
- Handles failures gracefully (continues with other images)
- Sets first image as story banner/thumbnail

#### Audio Generation Processor (`lib/jobs/processors/audio-generation.ts`)
- Splits stories into 1-minute audio chapters
- Uses Sarvam Bulbul TTS for audio generation
- **Uses Cloudinary for audio storage**
- Supports multiple Indian languages
- Tracks chapter metadata (duration, position)
- Handles long stories efficiently

### 3. Worker System (`lib/jobs/worker.ts`)
- Three dedicated workers for each job type
- Configurable concurrency:
  - Story Generation: 2 concurrent jobs
  - Image Generation: 1 concurrent job (resource-intensive)
  - Audio Generation: 2 concurrent jobs
- Rate limiting per queue
- Graceful shutdown handling
- Event logging for monitoring

### 4. API Endpoints

#### Job Management
- `POST /api/jobs/create` - Create new job
- `GET /api/jobs/[jobId]/status` - Get job status
- `POST /api/jobs/[jobId]/cancel` - Cancel job

#### Admin Monitoring
- `GET /api/admin/jobs/stats` - Get queue statistics
- `GET /api/admin/jobs/list` - List all jobs with filters

### 5. Admin UI (`app/admin/jobs/page.tsx`)
- Real-time job monitoring dashboard
- Queue statistics display
- Recent jobs table with status
- Auto-refresh every 10 seconds
- Manual refresh button

### 6. Storage Integration (`lib/storage/cloudinary.ts`)
- Cloudinary service for image and audio uploads
- Organized folder structure: `stories/{storyId}/images/` and `stories/{storyId}/audio/{language}/`
- Image optimization support
- Asset deletion for cleanup

### 7. Enhanced AI Services

#### Gemini Service Updates
- `generateStoryFromContent()` method with page-based generation
- Understands target word count and page requirements
- Expands raw content into full narrative with proper structure
- Maintains tone, audience, and style preferences

#### Imagen Service Updates
- `generateImage()` convenience method
- Removed S3 upload logic (using Cloudinary instead)

## Environment Variables Required

```env
# Redis (for BullMQ)
REDIS_URL=redis://localhost:6379

# Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# AI Services (already configured)
GOOGLE_GENERATIVE_AI_API_KEY=...
```

## Running the System

### Start Workers
```bash
npm run workers
```

This starts all three workers listening for jobs.

### Create a Job
```typescript
// From your application code
const jobId = await JobQueue.addJob(JobType.STORY_GENERATION, {
  storyId: 'story-uuid',
  config: {
    numberOfPages: 8,
    tone: 'narrative',
    targetAudience: 'adults',
    improveGrammar: true,
    includeAIImages: true,
  },
});
```

### Monitor Jobs
Visit `/admin/jobs` to see the monitoring dashboard.

## Key Design Decisions

1. **Page-Based Generation**: The system generates stories with exact page counts by calculating target word count (250 words/page) and instructing Gemini to expand content accordingly.

2. **No Context Service**: Based on requirements review, no separate context/summary service was needed. The AI directly transforms raw content into full stories.

3. **Cloudinary Over S3**: Using Cloudinary for both images and audio provides simpler integration and built-in optimization features.

4. **Separate Queues**: Each job type has its own queue for better resource management and monitoring.

5. **Graceful Failures**: Image and audio generation continue even if individual items fail, ensuring partial success.

## Testing

Basic tests included in `lib/jobs/__tests__/queue.test.ts`:
- Job creation
- Status checking
- Queue statistics
- Error handling

## Next Steps

To use this system in production:
1. Set up Redis instance
2. Configure Cloudinary account
3. Start workers in production environment
4. Monitor job queues via admin dashboard
5. Set up alerts for failed jobs
