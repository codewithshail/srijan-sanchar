export type UserRole = "user" | "psychiatrist" | "admin";

export type StoryType = "life_story" | "blog_story";

export type StoryStatus = 
  | "draft" 
  | "completed" 
  | "pending_review" 
  | "published" 
  | "rejected";

export type StoryVisibility = "private" | "public_summary" | "public_long";

export type AppointmentStatus = 
  | "pending" 
  | "confirmed" 
  | "completed" 
  | "cancelled";

export type AnalyticsEventType = "view" | "listen" | "share";

export interface Story {
  id: string;
  ownerId: string;
  title: string | null;
  storyType: StoryType;
  content: string | null;
  status: StoryStatus;
  visibility: StoryVisibility;
  bannerImageUrl: string | null;
  thumbnailImageUrl: string | null;
  publishedAt: Date | null;
  viewCount: number;
  listenCount: number;
  generationConfig: any;
  createdAt: Date;
  updatedAt: Date;
}

export interface StoryAnalytics {
  id: string;
  storyId: string;
  eventType: AnalyticsEventType;
  languageCode: string | null;
  createdAt: Date;
}

export interface EnhancedAppointment {
  id: string;
  storyId: string;
  userId: string;
  status: AppointmentStatus;
  appointmentDate: Date | null;
  notes: string | null;
  psychiatristFeedback: string | null;
  createdAt: Date;
}

export interface PublicStory {
  id: string;
  title: string;
  thumbnailUrl: string | null;
  authorName: string;
  publishedAt: string;
  viewCount: number;
  storyType: StoryType;
}

export interface Language {
  code: string; // e.g., 'hi-IN', 'en-IN'
  name: string; // e.g., 'Hindi', 'English'
  nativeName: string; // e.g., 'हिंदी', 'English'
}