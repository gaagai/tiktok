/**
 * Database operations with retry logic
 */

import { Video, Run, Report } from './models.js';
import { VideoDocument, RunDocument, ReportDocument, TikTokVideo } from '../types/index.js';
import { retryDatabase } from '../utils/retry.js';
import { alertDatabaseOperationFailed, logInfo } from '../alert/logger.js';

/**
 * Upsert video (insert or update)
 */
export async function upsertVideo(
  videoData: Partial<VideoDocument>
): Promise<{ inserted: boolean; updated: boolean }> {
  try {
    const result = await retryDatabase(async () => {
      const existing = await Video.findOne({ videoId: videoData.videoId });

      if (existing) {
        // Update existing video
        await Video.updateOne(
          { videoId: videoData.videoId },
          { $set: videoData }
        );
        return { inserted: false, updated: true };
      } else {
        // Insert new video
        await Video.create(videoData);
        return { inserted: true, updated: false };
      }
    }, 'upsert video');

    return result;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('upsertVideo', err);
    throw err;
  }
}

/**
 * Batch upsert videos
 */
export async function batchUpsertVideos(
  videos: Partial<VideoDocument>[]
): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;

  try {
    for (const video of videos) {
      const result = await upsertVideo(video);
      if (result.inserted) inserted++;
      if (result.updated) updated++;
    }

    logInfo(`Upserted videos: ${inserted} inserted, ${updated} updated`);
    return { inserted, updated };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('batchUpsertVideos', err);
    throw err;
  }
}

/**
 * Save run record
 */
export async function saveRun(runData: RunDocument): Promise<void> {
  try {
    await retryDatabase(async () => {
      await Run.create(runData);
    }, 'save run');

    logInfo(`Run record saved: ${runData.runId}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('saveRun', err);
    throw err;
  }
}

/**
 * Update run status
 */
export async function updateRunStatus(
  runId: string,
  updates: Partial<RunDocument>
): Promise<void> {
  try {
    await retryDatabase(async () => {
      await Run.updateOne({ runId }, { $set: updates });
    }, 'update run status');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('updateRunStatus', err);
    throw err;
  }
}

/**
 * Save or update report
 */
export async function saveReport(reportData: ReportDocument): Promise<void> {
  try {
    await retryDatabase(async () => {
      await Report.findOneAndUpdate(
        {
          reportDate: reportData.reportDate,
          profileHandle: reportData.profileHandle,
        },
        reportData,
        { upsert: true, new: true }
      );
    }, 'save report');

    logInfo(`Report saved: ${reportData.reportDate} for @${reportData.profileHandle}`);
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('saveReport', err);
    throw err;
  }
}

/**
 * Get videos by profile and date range
 */
export async function getVideosByDateRange(
  profileHandle: string,
  startDate: Date,
  endDate?: Date
): Promise<VideoDocument[]> {
  try {
    const query: any = {
      profileHandle,
      createTimeISO: { $gte: startDate.toISOString() },
    };

    if (endDate) {
      query.createTimeISO.$lte = endDate.toISOString();
    }

    return await retryDatabase(async () => {
      return await Video.find(query).sort({ createTimeISO: -1 }).lean();
    }, 'get videos by date range');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('getVideosByDateRange', err);
    throw err;
  }
}

/**
 * Get latest run for profile
 */
export async function getLatestRun(profileHandle: string): Promise<RunDocument | null> {
  try {
    return await retryDatabase(async () => {
      return await Run.findOne({ profileHandle })
        .sort({ startedAt: -1 })
        .lean();
    }, 'get latest run');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('getLatestRun', err);
    throw err;
  }
}

/**
 * Get report by date
 */
export async function getReportByDate(
  profileHandle: string,
  reportDate: string
): Promise<ReportDocument | null> {
  try {
    return await retryDatabase(async () => {
      return await Report.findOne({ profileHandle, reportDate }).lean();
    }, 'get report by date');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('getReportByDate', err);
    throw err;
  }
}

/**
 * Get database statistics
 */
export async function getDatabaseStats(): Promise<{
  totalVideos: number;
  totalRuns: number;
  totalReports: number;
}> {
  try {
    return await retryDatabase(async () => {
      const [totalVideos, totalRuns, totalReports] = await Promise.all([
        Video.countDocuments(),
        Run.countDocuments(),
        Report.countDocuments(),
      ]);

      return { totalVideos, totalRuns, totalReports };
    }, 'get database stats');
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    alertDatabaseOperationFailed('getDatabaseStats', err);
    throw err;
  }
}

/**
 * Convert TikTok API video to VideoDocument
 */
export function convertTikTokVideoToDocument(
  video: TikTokVideo,
  profileHandle: string,
  runId: string,
  category: string = 'Latest'
): Partial<VideoDocument> {
  return {
    videoId: video.id,
    profileHandle,
    text: video.text || '',
    webVideoUrl: video.webVideoUrl,
    createTimeISO: video.createTimeISO,
    scrapedAt: new Date(),
    runId,
    metrics: {
      playCount: video.playCount || 0,
      diggCount: video.diggCount || 0,
      commentCount: video.commentCount || 0,
      shareCount: video.shareCount || 0,
    },
    category,
    rawData: video,
  };
}
