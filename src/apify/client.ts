/**
 * Apify API client
 */

import fetch from 'node-fetch';
import { getConfig } from '../utils/config.js';
import { retryNetwork } from '../utils/retry.js';
import { logInfo, logError } from '../alert/logger.js';
import {
  ApifyActorInput,
  ApifyStartRunResponse,
  ApifyRunStatusResponse,
  ApifyDatasetItem,
  ApifyRunStatus,
  isApifyError,
} from './types.js';

const APIFY_API_BASE = 'https://api.apify.com/v2';

export class ApifyClient {
  private token: string;
  private defaultActorId?: string;

  constructor(token?: string, defaultActorId?: string) {
    const config = getConfig();
    this.token = token || config.apify.token;
    this.defaultActorId = defaultActorId;
  }

  /**
   * Start an actor run
   */
  async startRun(input: ApifyActorInput, actorId?: string): Promise<ApifyStartRunResponse> {
    const targetActorId = actorId || this.defaultActorId;
    if (!targetActorId) {
      throw new Error('Actor ID must be provided either in constructor or method call');
    }

    // Replace / with ~ in actor ID for API URL (e.g., clockworks/actor -> clockworks~actor)
    const actorIdForUrl = targetActorId.replace('/', '~');
    const url = `${APIFY_API_BASE}/acts/${actorIdForUrl}/runs?token=${this.token}`;

    logInfo(`Starting Apify run for actor: ${targetActorId}`, { input });

    return await retryNetwork(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });

      const data = await response.json();

      if (!response.ok || isApifyError(data)) {
        const error = isApifyError(data) 
          ? data.error.message 
          : `HTTP ${response.status}`;
        throw new Error(`Apify API error: ${error}`);
      }

      logInfo(`Run started successfully: ${(data as ApifyStartRunResponse).data.id}`);
      return data as ApifyStartRunResponse;
    }, 'Apify startRun');
  }

  /**
   * Get run status
   */
  async getRunStatus(runId: string): Promise<ApifyRunStatusResponse> {
    const url = `${APIFY_API_BASE}/actor-runs/${runId}?token=${this.token}`;

    return await retryNetwork(async () => {
      const response = await fetch(url);
      const data = await response.json();

      if (!response.ok || isApifyError(data)) {
        const error = isApifyError(data) 
          ? data.error.message 
          : `HTTP ${response.status}`;
        throw new Error(`Apify API error: ${error}`);
      }

      return data as ApifyRunStatusResponse;
    }, 'Apify getRunStatus');
  }

  /**
   * Get dataset items
   */
  async getDatasetItems(datasetId: string): Promise<ApifyDatasetItem[]> {
    const url = `${APIFY_API_BASE}/datasets/${datasetId}/items?token=${this.token}`;

    logInfo(`Fetching dataset items: ${datasetId}`);

    return await retryNetwork(async () => {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Apify API error: HTTP ${response.status}`);
      }

      // The items endpoint returns the array directly, not wrapped
      const data = await response.json();
      
      // Handle both formats: direct array or wrapped in data object
      const items = Array.isArray(data) ? data : ((data as any).data?.items || data);

      if (!Array.isArray(items)) {
        logError('Unexpected dataset response format', undefined, { data });
        throw new Error('Invalid dataset response format');
      }

      logInfo(`Fetched ${items.length} dataset items`);
      return items;
    }, 'Apify getDatasetItems');
  }

  /**
   * Wait for run to complete (helper method)
   */
  async waitForRunCompletion(
    runId: string,
    timeoutMs: number = 600000, // 10 minutes
    pollIntervalMs: number = 5000
  ): Promise<ApifyRunStatus> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const status = await this.getRunStatus(runId);
      const currentStatus = status.data.status;

      logInfo(`Run ${runId} status: ${currentStatus}`);

      // Terminal states
      if (currentStatus === 'SUCCEEDED' || 
          currentStatus === 'FAILED' || 
          currentStatus === 'TIMED-OUT' ||
          currentStatus === 'ABORTED') {
        return currentStatus;
      }

      // Wait before next poll
      await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
    }

    throw new Error(`Run ${runId} timed out after ${timeoutMs}ms`);
  }

  /**
   * Execute a complete scraping run
   */
  async executeScrapeRun(
    profileHandle: string,
    maxVideos: number = 50,
    actorId?: string,
    dateFilter?: { yesterdayDate: string } // Optional date filter for yesterday
  ): Promise<{
    runId: string;
    status: ApifyRunStatus;
    datasetId: string;
    items: ApifyDatasetItem[];
  }> {
    // Determine which actor is being used
    const targetActorId = actorId || this.defaultActorId || '';
    
    // Build input based on actor type
    let input: ApifyActorInput;
    
    if (targetActorId.includes('apidojo')) {
      // apidojo/tiktok-profile-scraper uses: usernames, maxItems, since, until
      input = {
        usernames: [profileHandle.replace('@', '')], // Remove @ if present
        maxItems: maxVideos,
      };
      
      // Add date filters if provided (for yesterday's videos only)
      if (dateFilter?.yesterdayDate) {
        input.since = dateFilter.yesterdayDate;
        input.until = dateFilter.yesterdayDate;
      }
      
      logInfo('Using apidojo actor format', { 
        usernames: input.usernames, 
        maxItems: input.maxItems,
        since: input.since,
        until: input.until,
      });
    } else {
      // clockworks/tiktok-profile-scraper and others use: profiles, resultsPerPage, oldestPostDateUnified, newestPostDate
      input = {
        profiles: [profileHandle.replace('@', '')], // Remove @ if present
        resultsPerPage: maxVideos,
        profileScrapeSections: ['videos'],
      };
      
      // Add date filters if provided (for yesterday's videos only)
      if (dateFilter?.yesterdayDate) {
        input.oldestPostDateUnified = dateFilter.yesterdayDate;
        input.newestPostDate = dateFilter.yesterdayDate;
      }
      
      logInfo('Using clockworks actor format', { 
        profiles: input.profiles, 
        resultsPerPage: input.resultsPerPage,
        oldestPostDateUnified: input.oldestPostDateUnified,
        newestPostDate: input.newestPostDate,
      });
    }

    // Start the run
    const startResponse = await this.startRun(input, actorId);

    const runId = startResponse.data.id;
    const datasetId = startResponse.data.defaultDatasetId;

    // Wait for completion
    const status = await this.waitForRunCompletion(runId);

    // Fetch results if succeeded
    let items: ApifyDatasetItem[] = [];
    if (status === 'SUCCEEDED') {
      items = await this.getDatasetItems(datasetId);
    }

    return {
      runId,
      status,
      datasetId,
      items,
    };
  }
}

/**
 * Create a singleton Apify client instance
 */
let clientInstance: ApifyClient | null = null;

export function getApifyClient(): ApifyClient {
  if (!clientInstance) {
    clientInstance = new ApifyClient();
  }
  return clientInstance;
}
