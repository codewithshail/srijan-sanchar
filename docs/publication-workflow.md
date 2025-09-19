# Story Publication Workflow

This document describes the new story publication workflow implemented in task 6.

## Overview

The publication workflow allows users to publish their completed stories with AI-generated banner and thumbnail images. It supports both life stories (from the 7-stage wizard) and blog stories (from the rich text editor).

## Components Implemented

### 1. API Endpoints

#### `/api/stories/[storyId]/publish` (POST)
- Publishes a story with selected images and visibility settings
- Validates input data using Zod schema
- Updates story status and publication metadata
- Returns success response with updated story data

#### `/api/stories/[storyId]/images` (POST)
- Generates AI-powered banner and thumbnail images
- Creates image prompts using Google Gemini AI
- Generates multiple image options using Replicate
- Returns arrays of generated images with prompts

### 2. React Components

#### `PublicationWorkflow` Component
- Main component for the publication interface
- Handles image generation and selection
- Manages publication settings (title, description, visibility)
- Provides loading states and error handling
- Supports image regeneration

#### Publication Page (`/publish/[storyId]`)
- Server-side rendered page for story publication
- Validates user authentication and story ownership
- Renders the PublicationWorkflow component

### 3. Navigation Integration

#### Story Page Updates
- Replaced simple publish dialog with navigation to publication workflow
- Removed old publication logic in favor of new workflow

#### Blog Editor Updates
- Added "Publish Story" button to header
- Integrated with publication workflow navigation

## Features

### AI-Generated Images
- **Banner Images**: 16:9 aspect ratio, cinematic style
- **Thumbnail Images**: Square aspect ratio, social media optimized
- **Multiple Options**: 3 variations of each image type
- **Regeneration**: Users can regenerate images if not satisfied

### Publication Settings
- **Title**: Required field for story identification
- **Description**: Optional field for story summary
- **Visibility Options**:
  - Private: Only visible to the author
  - Public Summary: Others can see story summary
  - Public Long: Others can see full story content

### User Experience
- **Loading States**: Visual feedback during image generation
- **Error Handling**: Graceful fallbacks and user notifications
- **Responsive Design**: Works on desktop and mobile devices
- **Image Selection**: Click to select from generated options

## Usage Flow

1. **Complete Story**: User finishes writing their story (wizard or blog editor)
2. **Navigate to Publication**: Click "Publish Story" button
3. **Image Generation**: System automatically generates banner and thumbnail options
4. **Image Selection**: User selects preferred images from generated options
5. **Publication Settings**: User sets title, description, and visibility
6. **Publish**: Story is published with selected settings and images

## Technical Details

### Image Generation Process
1. Extract story content (from content field or summary)
2. Generate AI prompts using Google Gemini based on story content
3. Create multiple images using Replicate API
4. Present options to user for selection

### Error Handling
- Network failures: Retry mechanisms and user notifications
- AI service failures: Fallback prompts and error messages
- Validation errors: Clear feedback and input validation
- Image generation failures: Retry options and default handling

### Performance Considerations
- Concurrent image generation for faster loading
- Loading states to improve perceived performance
- Error boundaries to prevent crashes
- Optimized image delivery and caching

## Environment Variables Required

```env
GOOGLE_GENERATIVE_AI_API_KEY=your_gemini_api_key
REPLICATE_API_TOKEN=your_replicate_token
REPLICATE_MODEL=black-forest-labs/flux-dev  # Optional, defaults to flux-dev
```

## Database Schema

The publication workflow uses existing database fields:
- `stories.bannerImageUrl`: URL of selected banner image
- `stories.thumbnailImageUrl`: URL of selected thumbnail image
- `stories.publishedAt`: Timestamp when story was published
- `stories.status`: Updated to "published" when made public
- `stories.visibility`: Controls who can see the story

## Future Enhancements

- Image editing capabilities (crop, filter, etc.)
- Custom image upload option
- Social media sharing integration
- Publication scheduling
- Analytics tracking for published stories