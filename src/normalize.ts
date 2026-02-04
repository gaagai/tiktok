/**
 * Normalization layer for different Apify Actor outputs
 * 
 * Handles differences between:
 * - Primary Actor: apidojo/tiktok-profile-scraper
 * - Fallback Actor: clockworks/tiktok-profile-scraper
 */

import { NormalizedVideo, ActorType } from './types/index.js';
import { logWarning } from './alert/logger.js';

/**
 * Determine actor type based on actorId
 */
export function getActorType(actorId: string): ActorType {
  if (actorId.includes('apidojo')) {
    return 'primary';
  }
  if (actorId.includes('clockworks')) {
    return 'fallback';
  }
  // Default to primary if unknown
  return 'primary';
}

/**
 * Build TikTok video URL from videoId
 */
function buildVideoUrl(videoId: string): string {
  return `https://www.tiktok.com/@unknown/video/${videoId}`;
}

/**
 * Normalize a raw item from any actor to internal format
 */
export function normalizeItem(raw: any, actorId: string): NormalizedVideo {
  const actorType = getActorType(actorId);
  const warningFlags: string[] = [];

  // Extract videoId (both actors should have 'id')
  const videoId = raw.id || raw.videoId;
  if (!videoId) {
    warningFlags.push('MISSING_VIDEO_ID');
    throw new Error('Cannot normalize item without videoId');
  }

  // Extract text/description
  let text = raw.text || raw.desc || raw.description || '';
  if (!text) {
    warningFlags.push('MISSING_TEXT');
  }

  // Extract webVideoUrl
  let webVideoUrl = raw.webVideoUrl || raw.videoUrl || raw.url || '';
  if (!webVideoUrl && videoId) {
    // Try to build URL from videoId
    webVideoUrl = buildVideoUrl(videoId);
    warningFlags.push('URL_BUILT_FROM_ID');
  }
  if (!webVideoUrl) {
    warningFlags.push('MISSING_VIDEO_URL');
  }

  // Extract createTimeISO
  let createTimeISO = raw.createTimeISO || raw.createTime;
  
  // Handle different time formats
  if (!createTimeISO) {
    // Try timestamp formats
    if (raw.createTime && typeof raw.createTime === 'number') {
      createTimeISO = new Date(raw.createTime * 1000).toISOString();
    } else if (raw.timestamp) {
      createTimeISO = new Date(raw.timestamp * 1000).toISOString();
    }
  }

  // If createTimeISO is not in ISO format, try to convert
  if (createTimeISO && typeof createTimeISO === 'number') {
    createTimeISO = new Date(createTimeISO * 1000).toISOString();
  }

  if (!createTimeISO) {
    warningFlags.push('MISSING_CREATE_TIME');
    // Use current time as fallback (will be filtered out by date range)
    createTimeISO = new Date().toISOString();
  }

  // Extract metrics
  const metrics = {
    playCount: raw.playCount || raw.plays || raw.stats?.playCount || 0,
    diggCount: raw.diggCount || raw.likes || raw.stats?.diggCount || 0,
    commentCount: raw.commentCount || raw.comments || raw.stats?.commentCount || 0,
    shareCount: raw.shareCount || raw.shares || raw.stats?.shareCount || 0,
  };

  // Extract category (fallback actor specific)
  let category = 'Latest';
  if (actorType === 'fallback' && raw.category) {
    category = raw.category;
  }

  // Log warnings if any
  if (warningFlags.length > 0) {
    logWarning(`Normalization warnings for video ${videoId}`, {
      actorType,
      actorId,
      warningFlags,
    });
  }

  return {
    videoId,
    text,
    webVideoUrl,
    createTimeISO,
    metrics,
    category,
    actorUsed: actorType,
    warningFlags,
    rawData: raw,
  };
}

/**
 * Normalize a batch of items
 */
export function normalizeItems(items: any[], actorId: string): NormalizedVideo[] {
  const normalized: NormalizedVideo[] = [];
  const failed: string[] = [];

  for (const item of items) {
    try {
      const normalizedItem = normalizeItem(item, actorId);
      normalized.push(normalizedItem);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      failed.push(`Item failed: ${err.message}`);
      logWarning('Failed to normalize item', { error: err.message, item });
    }
  }

  if (failed.length > 0) {
    logWarning(`Failed to normalize ${failed.length} items out of ${items.length}`, {
      failed: failed.slice(0, 5), // Log only first 5 failures
    });
  }

  return normalized;
}
