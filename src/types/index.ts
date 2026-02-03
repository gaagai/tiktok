/**
 * Shared TypeScript types for the TikTok scraper system
 */

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
  rawData?: TikTokVideo;
}

export interface RunDocument {
  runId: string;
  actorId: string;
  profileHandle: string;
  startedAt: Date;
  finishedAt?: Date;
  status: 'SUCCEEDED' | 'FAILED' | 'PARTIAL';
  itemsFetched: number;
  itemsInserted: number;
  itemsUpdated: number;
  error?: string;
  datasetId: string;
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
  warningMessage?: string;
}

// Configuration Type
export interface Config {
  apify: {
    token: string;
    actorId: string;
  };
  mongodb: {
    uri: string;
  };
  scraper: {
    profileHandle: string;
    maxPosts: number;
    windowHours: number;
    timezone: string;
  };
  system: {
    nodeEnv: string;
    logLevel: string;
    backupRetentionDays: number;
  };
}

// Pipeline Result
export interface PipelineResult {
  success: boolean;
  runId?: string;
  itemsFetched: number;
  itemsInserted: number;
  itemsUpdated: number;
  reportGenerated: boolean;
  error?: string;
}
