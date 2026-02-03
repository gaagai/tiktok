/**
 * Apify-specific type definitions
 */

export interface ApifyActorInput {
  profiles: string[];
  maxVideos: number;
  resultsPerPage?: number;
  sections?: string[];
}

export interface ApifyStartRunResponse {
  data: {
    id: string;
    actId: string;
    userId: string;
    startedAt: string;
    finishedAt?: string;
    status: ApifyRunStatus;
    defaultDatasetId: string;
    defaultKeyValueStoreId: string;
    buildId: string;
    buildNumber: string;
  };
}

export type ApifyRunStatus = 
  | 'READY'
  | 'RUNNING'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'TIMING-OUT'
  | 'TIMED-OUT'
  | 'ABORTING'
  | 'ABORTED';

export interface ApifyRunStatusResponse {
  data: {
    id: string;
    actId: string;
    status: ApifyRunStatus;
    startedAt: string;
    finishedAt?: string;
    defaultDatasetId: string;
    stats: {
      inputBodyLen?: number;
      restartCount?: number;
      resurrectCount?: number;
    };
    meta?: {
      origin?: string;
      clientIp?: string;
      userAgent?: string;
    };
  };
}

export interface ApifyDatasetItem {
  [key: string]: any;
}

export interface ApifyDatasetResponse {
  data: {
    items: ApifyDatasetItem[];
    total: number;
    offset: number;
    count: number;
    limit: number;
  };
}

export interface ApifyError {
  error: {
    type: string;
    message: string;
  };
}

export function isApifyError(obj: any): obj is ApifyError {
  return obj && obj.error && typeof obj.error.message === 'string';
}
