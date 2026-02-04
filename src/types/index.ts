/**
 * Shared TypeScript types for the TikTok scraper system
 */

// Actor Types
export type ActorType = 'primary' | 'fallback';
export type FallbackReason = 'FAILED' | 'ZERO_RESULTS' | 'LOW_RESULTS' | null;

// Apify Types
export interface ApifyRunInput {
  profiles: string[];
  maxVideos: number;
  resultsPerPage?: number;
}

export interface ApifyRunResponse {
  data: {
    id: string;
    actId: string;
    status: string;
    startedAt: string;
    finishedAt?: string;
    defaultDatasetId: string;
  };
}

export interface ApifyRunStatus {
  data: {
    id: string;
    status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMED-OUT' | 'ABORTED';
    startedAt: string;
    finishedAt?: string;
    defaultDatasetId: string;
  };
}

export interface TikTokVideo {
  id: string;
  text: string;
  createTime: number;
  createTimeISO: string;
  webVideoUrl: string;
  videoMeta?: {
    height?: number;
    width?: number;
    duration?: number;
  };
  authorMeta?: {
    id?: string;
    name?: string;
    nickName?: string;
  };
  diggCount?: number;
  shareCount?: number;
  playCount?: number;
  commentCount?: number;
  musicMeta?: {
    musicName?: string;
    musicAuthor?: string;
  };
  hashtags?: Array<{ id: string; name: string; }>;
  mentions?: string[];
}

// Normalized Video (after normalization layer)
export interface NormalizedVideo {
  videoId: string;
  text: string;
  webVideoUrl: string;
  createTimeISO: string;
  metrics: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  category: string;
  actorUsed: ActorType;
  warningFlags: string[];
  rawData: any;
}

// Database Types
export interface VideoDocument {
  videoId: string;
  profileHandle: string;
  text: string;
  webVideoUrl: string;
  createTimeISO: string;
  scrapedAt: Date;
  runId: string;
  metrics: {
    playCount: number;
    diggCount: number;
    commentCount: number;
    shareCount: number;
  };
  category: string;
  actorUsed: ActorType;
  rawData?: TikTokVideo;
}

export interface RunDocument {
  runId: string;
  actorId: string;
  profileHandle: string;
  reportDate: string; // YYYY-MM-DD (critical for Circuit Breaker)
  startedAt: Date;
  finishedAt?: Date;
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
  actorUsed: ActorType;
  fallbackReason: FallbackReason;
  circuitBreakerSuppressed: boolean;
  itemsFetchedRaw: number; // Before filtering
  itemsInRange: number; // After filtering to yesterday
  itemsFetched: number; // Deprecated, kept for backward compatibility
  itemsInserted: number;
  itemsUpdated: number;
  error?: string;
  datasetId: string;
  warningFlags?: string[];
  // Data Quality metrics (v2.1.0)
  missingCreateTimePct?: number;
  missingUrlPct?: number;
  // Empty Day tracking (v2.1.0)
  emptyDay?: boolean;
  emptyDayStreak?: number;
}

export interface ReportDocument {
  reportDate: string; // YYYY-MM-DD
  profileHandle: string;
  windowHours: number;
  maxPosts: number;
  generatedAt: Date;
  text: string;
  videoIds: string[];
  status: 'ok' | 'warning' | 'error';
  actorUsed: ActorType;
  warningFlags: string[];
  // Empty Day tracking (v2.1.0)
  emptyDay?: boolean;
  emptyDayStreak?: number;
  // Email tracking (v2.2.0)
  emailStatus?: 'PENDING' | 'SENT' | 'FAILED';
  emailSentAt?: Date;
  emailMessageId?: string;
  emailError?: string;
}

// Configuration Type
export interface Config {
  apify: {
    token: string;
    primaryActorId: string;
    fallbackActorId: string;
  };
  mongodb: {
    uri: string;
  };
  scraper: {
    profileHandle: string;
    maxPosts: number;
    windowHours: number;
    timezone: string;
    lowResultsThreshold: number;
  };
  system: {
    nodeEnv: string;
    logLevel: string;
    backupRetentionDays: number;
    runTimeoutMinutes: number;
    pollIntervalSeconds: number;
    maxRetries: number;
    lockTtlMinutes: number;
  };
  circuitBreaker: {
    fallbackMaxPer48Hours: number;
  };
  dataQuality: {
    maxMissingCreateTimePct: number;
    maxMissingUrlPct: number;
  };
  email?: {
    provider: string;
    brevoApiKey: string;
    from: string;
    fromName: string;
    to: string;
    cc?: string;
    bcc?: string;
    subjectPrefix: string;
  };
}

// Pipeline Result
export interface PipelineResult {
  success: boolean;
  runId?: string;
  actorUsed: ActorType;
  fallbackReason: FallbackReason;
  circuitBreakerSuppressed: boolean;
  itemsFetchedRaw: number;
  itemsInRange: number;
  itemsInserted: number;
  itemsUpdated: number;
  reportGenerated: boolean;
  warningFlags: string[];
  error?: string;
}

// Actor Run Result
export interface ActorRunResult {
  runId: string;
  status: 'READY' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'TIMING-OUT' | 'TIMED-OUT' | 'ABORTING' | 'ABORTED';
  datasetId: string;
  items: any[];
  actorId: string;
}

// Lock Document (v2.1.0 - Concurrency Protection)
export interface LockDocument {
  _id: string; // Format: ${profileHandle}:${reportDate}
  lockedAt: Date;
  expiresAt: Date;
}

// Data Quality Check Result (v2.1.0)
export interface DataQualityResult {
  missingCreateTimeCount: number;
  missingUrlCount: number;
  itemsFetchedRaw: number;
  itemsInRange: number;
  missingCreateTimePct: number;
  missingUrlPct: number;
  hasIssue: boolean;
}

// Email Types (v2.2.0)
export interface BrevoEmailRequest {
  sender: {
    name: string;
    email: string;
  };
  to: Array<{ email: string; name?: string }>;
  cc?: Array<{ email: string; name?: string }>;
  bcc?: Array<{ email: string; name?: string }>;
  subject: string;
  textContent: string;
  attachment?: Array<{
    name: string;
    content: string; // base64
  }>;
}

export interface BrevoEmailResponse {
  messageId: string;
}

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}
