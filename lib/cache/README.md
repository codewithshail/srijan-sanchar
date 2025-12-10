# Caching Module

This module provides comprehensive caching utilities for the StoryWeave platform to optimize performance and reduce API costs.

## Overview

The caching system consists of four main components:

1. **Redis Cache** - Server-side caching for AI responses, story metadata, and session data
2. **AI Response Cache** - Specialized caching layer for AI service responses
3. **Browser Cache** - Client-side caching using localStorage for drafts and preferences
4. **Audio Cache** - IndexedDB-based caching for audio chapters (see `lib/audio/audio-language-cache.ts`)

## Usage

### Redis Cache (Server-Side)

```typescript
import { getRedisCache, CACHE_TTL, CACHE_PREFIX } from '@/lib/cache';

const cache = getRedisCache();

// Set a value with TTL
await cache.set('my-key', { data: 'value' }, { 
  ttl: CACHE_TTL.MEDIUM,
  prefix: CACHE_PREFIX.STORY 
});

// Get a value
const value = await cache.get<MyType>('my-key', { 
  prefix: CACHE_PREFIX.STORY 
});

// Get or set with callback
const data = await cache.getOrSet('my-key', async () => {
  return await fetchExpensiveData();
}, { ttl: CACHE_TTL.LONG });
```

### AI Response Cache

```typescript
import { getAIResponseCache } from '@/lib/cache';

const aiCache = getAIResponseCache();

// Cache translation
await aiCache.cacheTranslation(text, 'hi', translatedText);

// Get cached translation
const cached = await aiCache.getTranslation(text, 'hi');

// Get or fetch with automatic caching
const result = await aiCache.getOrFetch(
  { operation: 'grammar', input: text, language: 'en' },
  async () => await geminiService.improveGrammar(text, 'en')
);
```

### Browser Cache (Client-Side)

```typescript
import { 
  draftStorage, 
  playbackStorage, 
  preferencesStorage,
  recentStoriesStorage 
} from '@/lib/cache';

// Save and retrieve drafts
draftStorage.saveDraft(storyId, content);
const draft = draftStorage.getDraft(storyId);

// Save playback position
playbackStorage.savePosition(storyId, chapterIndex, position);
const position = playbackStorage.getPosition(storyId);

// User preferences
preferencesStorage.saveLanguage('hi');
const lang = preferencesStorage.getLanguage();

// Recent stories
recentStoriesStorage.addRecent(storyId, title);
const recent = recentStoriesStorage.getRecent();
```

### Cache Manager (Unified Interface)

```typescript
import { getCacheManager } from '@/lib/cache';

const manager = getCacheManager();

// Access different caches
const redis = manager.getServerCache();
const ai = manager.getAICache();
const browser = manager.getBrowserCache();
const audio = manager.getAudioCache();

// Get statistics
const stats = await manager.getStats();

// Clear all caches
await manager.clearAll();
```

## Cache TTL Constants

| Constant | Duration | Use Case |
|----------|----------|----------|
| `SHORT` | 5 minutes | Temporary data |
| `MEDIUM` | 30 minutes | Session data |
| `LONG` | 24 hours | Stable data |
| `AI_RESPONSE` | 24 hours | General AI responses |
| `TRANSLATION` | 30 days | Translations |
| `GRAMMAR` | 7 days | Grammar improvements |
| `DESCRIPTION` | 7 days | Generated descriptions |
| `IMAGE_PROMPTS` | 7 days | Image prompts |

## Cache Prefixes

| Prefix | Purpose |
|--------|---------|
| `ai:translation:` | Translation cache |
| `ai:grammar:` | Grammar improvement cache |
| `ai:rewrite:` | Content rewrite cache |
| `ai:expand:` | Content expansion cache |
| `ai:description:` | Description generation cache |
| `ai:image_prompts:` | Image prompt cache |
| `story:` | Story metadata |
| `user:` | User data |
| `analytics:` | Analytics data |
| `rate_limit:` | Rate limiting |

## Configuration

### Environment Variables

```env
# Redis URL for server-side caching
REDIS_URL=redis://localhost:6379
```

### Next.js Headers (CDN Caching)

The `next.config.ts` includes caching headers for:

- Static assets (images, fonts): 1 year, immutable
- Next.js static files: 1 year, immutable
- Audio files: 7 days with stale-while-revalidate
- Public API responses: 1 minute with stale-while-revalidate
- Story content: 5 minutes with stale-while-revalidate

## Best Practices

1. **Use appropriate TTLs** - Longer for stable data, shorter for dynamic data
2. **Use prefixes** - Organize cache keys by domain
3. **Handle cache misses gracefully** - Always have a fallback
4. **Clear caches on updates** - Invalidate when data changes
5. **Monitor cache stats** - Track hit rates and memory usage

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Cache Manager                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │ Redis Cache │  │  AI Cache   │  │   Browser Cache     │ │
│  │  (Server)   │  │  (Server)   │  │    (Client)         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│         │                │                    │             │
│         ▼                ▼                    ▼             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Redis    │  │    Redis    │  │   localStorage      │ │
│  │   Server    │  │   Server    │  │   IndexedDB         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
