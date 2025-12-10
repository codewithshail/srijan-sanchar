/**
 * Content Moderation Service
 * Provides spam detection, content filtering, and moderation utilities
 */

export interface ModerationResult {
  isClean: boolean;
  flagged: boolean;
  reason?: 'spam' | 'inappropriate' | 'harassment' | 'hate_speech' | 'violence' | 'misinformation' | 'copyright' | 'other';
  confidenceScore: number; // 0-100
  details?: string;
}

export interface SpamIndicators {
  hasExcessiveLinks: boolean;
  hasRepeatedPatterns: boolean;
  hasSpamKeywords: boolean;
  hasExcessiveCaps: boolean;
  hasShortContent: boolean;
  linkCount: number;
  capsRatio: number;
}

// Common spam patterns and keywords
const SPAM_KEYWORDS = [
  'buy now', 'click here', 'free money', 'act now', 'limited time',
  'winner', 'congratulations', 'claim your prize', 'earn money fast',
  'work from home', 'make money online', 'get rich quick', 'casino',
  'lottery', 'viagra', 'cialis', 'weight loss', 'diet pills',
  'crypto investment', 'guaranteed returns', 'double your money',
];

// Inappropriate content patterns (basic detection)
const INAPPROPRIATE_PATTERNS = [
  // Hate speech indicators
  /\b(hate|kill|die|death\s+to)\s+(all\s+)?(jews|muslims|christians|blacks|whites|asians|gays|lesbians|trans)/gi,
  // Violence indicators
  /\b(bomb|shoot|murder|massacre|terrorist|attack)\s+(the|a|all)/gi,
  // Harassment patterns
  /\b(you\s+should\s+die|kill\s+yourself|kys|go\s+die)\b/gi,
];

// URL pattern for link detection
const URL_PATTERN = /https?:\/\/[^\s]+|www\.[^\s]+/gi;

// Repeated character pattern
const REPEATED_CHAR_PATTERN = /(.)\1{4,}/g;

// Repeated word pattern
const REPEATED_WORD_PATTERN = /\b(\w+)\s+\1\s+\1\b/gi;

export class ContentModerationService {
  private spamKeywords: Set<string>;

  constructor() {
    this.spamKeywords = new Set(SPAM_KEYWORDS.map(k => k.toLowerCase()));
  }

  /**
   * Main moderation function - checks content for various issues
   */
  async moderateContent(content: string, contentType: 'story' | 'comment'): Promise<ModerationResult> {
    if (!content || content.trim().length === 0) {
      return {
        isClean: true,
        flagged: false,
        confidenceScore: 100,
      };
    }

    const normalizedContent = content.toLowerCase();

    // Check for spam
    const spamResult = this.detectSpam(content);
    if (spamResult.flagged) {
      return spamResult;
    }

    // Check for inappropriate content
    const inappropriateResult = this.detectInappropriateContent(content);
    if (inappropriateResult.flagged) {
      return inappropriateResult;
    }

    // Check for harassment
    const harassmentResult = this.detectHarassment(content);
    if (harassmentResult.flagged) {
      return harassmentResult;
    }

    // Content-type specific checks
    if (contentType === 'comment') {
      const commentResult = this.moderateComment(content);
      if (commentResult.flagged) {
        return commentResult;
      }
    }

    return {
      isClean: true,
      flagged: false,
      confidenceScore: 100,
    };
  }

  /**
   * Detect spam content
   */
  detectSpam(content: string): ModerationResult {
    const indicators = this.getSpamIndicators(content);
    let score = 0;
    const issues: string[] = [];

    // Calculate spam score based on indicators
    if (indicators.hasExcessiveLinks) {
      score += 30;
      issues.push(`Excessive links (${indicators.linkCount})`);
    }

    if (indicators.hasSpamKeywords) {
      score += 40;
      issues.push('Contains spam keywords');
    }

    if (indicators.hasRepeatedPatterns) {
      score += 20;
      issues.push('Repeated patterns detected');
    }

    if (indicators.hasExcessiveCaps) {
      score += 15;
      issues.push(`Excessive caps (${Math.round(indicators.capsRatio * 100)}%)`);
    }

    if (indicators.hasShortContent && indicators.hasExcessiveLinks) {
      score += 25;
      issues.push('Short content with links');
    }

    const flagged = score >= 50;

    return {
      isClean: !flagged,
      flagged,
      reason: flagged ? 'spam' : undefined,
      confidenceScore: Math.min(score, 100),
      details: issues.length > 0 ? issues.join('; ') : undefined,
    };
  }

  /**
   * Get spam indicators for content
   */
  getSpamIndicators(content: string): SpamIndicators {
    const normalizedContent = content.toLowerCase();
    const links = content.match(URL_PATTERN) || [];
    const words = content.split(/\s+/).filter(w => w.length > 0);
    const letters = content.replace(/[^a-zA-Z]/g, '');
    const upperLetters = letters.replace(/[^A-Z]/g, '');

    // Check for spam keywords
    const hasSpamKeywords = SPAM_KEYWORDS.some(keyword => 
      normalizedContent.includes(keyword.toLowerCase())
    );

    // Check for repeated patterns
    const hasRepeatedChars = REPEATED_CHAR_PATTERN.test(content);
    const hasRepeatedWords = REPEATED_WORD_PATTERN.test(content);

    // Calculate caps ratio
    const capsRatio = letters.length > 0 ? upperLetters.length / letters.length : 0;

    return {
      hasExcessiveLinks: links.length > 3,
      hasRepeatedPatterns: hasRepeatedChars || hasRepeatedWords,
      hasSpamKeywords,
      hasExcessiveCaps: capsRatio > 0.5 && letters.length > 20,
      hasShortContent: words.length < 5,
      linkCount: links.length,
      capsRatio,
    };
  }

  /**
   * Detect inappropriate content
   */
  detectInappropriateContent(content: string): ModerationResult {
    for (const pattern of INAPPROPRIATE_PATTERNS) {
      if (pattern.test(content)) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        
        return {
          isClean: false,
          flagged: true,
          reason: 'inappropriate',
          confidenceScore: 85,
          details: 'Content matches inappropriate patterns',
        };
      }
    }

    return {
      isClean: true,
      flagged: false,
      confidenceScore: 100,
    };
  }

  /**
   * Detect harassment
   */
  detectHarassment(content: string): ModerationResult {
    const harassmentPatterns = [
      /\b(you('re|\s+are)\s+(stupid|idiot|moron|dumb|worthless|pathetic))\b/gi,
      /\b(shut\s+up|stfu|gtfo)\b/gi,
      /\b(nobody\s+(likes|cares\s+about)\s+you)\b/gi,
    ];

    for (const pattern of harassmentPatterns) {
      if (pattern.test(content)) {
        pattern.lastIndex = 0;
        
        return {
          isClean: false,
          flagged: true,
          reason: 'harassment',
          confidenceScore: 75,
          details: 'Content contains harassment',
        };
      }
    }

    return {
      isClean: true,
      flagged: false,
      confidenceScore: 100,
    };
  }

  /**
   * Comment-specific moderation
   */
  moderateComment(content: string): ModerationResult {
    // Check for very short meaningless comments
    const trimmed = content.trim();
    if (trimmed.length < 3) {
      return {
        isClean: false,
        flagged: true,
        reason: 'spam',
        confidenceScore: 60,
        details: 'Comment too short',
      };
    }

    // Check for gibberish (random characters)
    const alphanumericRatio = (content.match(/[a-zA-Z0-9]/g) || []).length / content.length;
    if (alphanumericRatio < 0.3 && content.length > 10) {
      return {
        isClean: false,
        flagged: true,
        reason: 'spam',
        confidenceScore: 70,
        details: 'Content appears to be gibberish',
      };
    }

    return {
      isClean: true,
      flagged: false,
      confidenceScore: 100,
    };
  }

  /**
   * Check if content should be auto-removed (high confidence spam/inappropriate)
   */
  shouldAutoRemove(result: ModerationResult): boolean {
    if (!result.flagged) return false;
    
    // Auto-remove high confidence spam or inappropriate content
    if (result.reason === 'spam' && result.confidenceScore >= 80) {
      return true;
    }
    
    if (result.reason === 'inappropriate' && result.confidenceScore >= 85) {
      return true;
    }
    
    if (result.reason === 'harassment' && result.confidenceScore >= 80) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize content by removing potentially harmful elements
   */
  sanitizeContent(content: string): string {
    // Remove excessive whitespace
    let sanitized = content.replace(/\s+/g, ' ').trim();
    
    // Remove repeated characters (more than 3)
    sanitized = sanitized.replace(/(.)\1{3,}/g, '$1$1$1');
    
    return sanitized;
  }
}

// Export singleton instance
export const contentModerationService = new ContentModerationService();
