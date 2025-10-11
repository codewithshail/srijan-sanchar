import { v2 as cloudinary } from "cloudinary";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  /**
   * Upload image to Cloudinary
   */
  async uploadImage(
    imageBytes: string,
    storyId: string,
    index: number
  ): Promise<string> {
    try {
      // Convert base64 to buffer if needed
      const imageData = imageBytes.startsWith("data:")
        ? imageBytes
        : `data:image/png;base64,${imageBytes}`;

      const result = await cloudinary.uploader.upload(imageData, {
        folder: `stories/${storyId}/images`,
        public_id: `image-${index}`,
        resource_type: "image",
        overwrite: true,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Error uploading image to Cloudinary:", error);
      throw new Error("Failed to upload image");
    }
  }

  /**
   * Upload audio to Cloudinary
   */
  async uploadAudio(
    audioData: ArrayBuffer,
    storyId: string,
    chapterIndex: number,
    language: string
  ): Promise<string> {
    try {
      // Convert ArrayBuffer to base64
      const buffer = Buffer.from(audioData);
      const base64Audio = buffer.toString("base64");
      const audioDataUri = `data:audio/mpeg;base64,${base64Audio}`;

      const result = await cloudinary.uploader.upload(audioDataUri, {
        folder: `stories/${storyId}/audio/${language}`,
        public_id: `chapter-${chapterIndex}`,
        resource_type: "video", // Cloudinary uses 'video' for audio files
        overwrite: true,
      });

      return result.secure_url;
    } catch (error) {
      console.error("Error uploading audio to Cloudinary:", error);
      throw new Error("Failed to upload audio");
    }
  }

  /**
   * Delete story assets
   */
  async deleteStoryAssets(storyId: string): Promise<void> {
    try {
      await cloudinary.api.delete_resources_by_prefix(`stories/${storyId}/`);
      await cloudinary.api.delete_folder(`stories/${storyId}`);
    } catch (error) {
      console.error("Error deleting story assets:", error);
      // Don't throw - deletion is best effort
    }
  }

  /**
   * Get optimized image URL
   */
  getOptimizedImageUrl(
    publicId: string,
    options: {
      width?: number;
      height?: number;
      quality?: number;
      format?: string;
    } = {}
  ): string {
    return cloudinary.url(publicId, {
      transformation: [
        {
          width: options.width || 1200,
          height: options.height,
          crop: "limit",
          quality: options.quality || "auto",
          fetch_format: options.format || "auto",
        },
      ],
    });
  }
}

export const cloudinaryService = new CloudinaryService();
