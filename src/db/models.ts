/**
 * Mongoose schemas and models
 */

import mongoose, { Schema, Model } from 'mongoose';
import { VideoDocument, RunDocument, ReportDocument } from '../types/index.js';

// Video Schema
const videoSchema = new Schema<VideoDocument>(
  {
    videoId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    profileHandle: {
      type: String,
      required: true,
      index: true,
    },
    text: {
      type: String,
      required: true,
    },
    webVideoUrl: {
      type: String,
      required: true,
    },
    createTimeISO: {
      type: String,
      required: true,
      index: true,
    },
    scrapedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    runId: {
      type: String,
      required: true,
    },
    metrics: {
      playCount: { type: Number, default: 0 },
      diggCount: { type: Number, default: 0 },
      commentCount: { type: Number, default: 0 },
      shareCount: { type: Number, default: 0 },
    },
    category: {
      type: String,
      required: true,
      default: 'Latest',
    },
    rawData: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'videos',
  }
);

// Create indexes
videoSchema.index({ profileHandle: 1, createTimeISO: -1 });
videoSchema.index({ runId: 1 });

// Run Schema
const runSchema = new Schema<RunDocument>(
  {
    runId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actorId: {
      type: String,
      required: true,
    },
    profileHandle: {
      type: String,
      required: true,
      index: true,
    },
    startedAt: {
      type: Date,
      required: true,
      index: true,
    },
    finishedAt: {
      type: Date,
      required: false,
    },
    status: {
      type: String,
      enum: ['SUCCEEDED', 'FAILED', 'PARTIAL'],
      required: true,
    },
    itemsFetched: {
      type: Number,
      required: true,
      default: 0,
    },
    itemsInserted: {
      type: Number,
      required: true,
      default: 0,
    },
    itemsUpdated: {
      type: Number,
      required: true,
      default: 0,
    },
    error: {
      type: String,
      required: false,
    },
    datasetId: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
    collection: 'runs',
  }
);

// Create indexes
runSchema.index({ profileHandle: 1, startedAt: -1 });
runSchema.index({ status: 1 });

// Report Schema
const reportSchema = new Schema<ReportDocument>(
  {
    reportDate: {
      type: String,
      required: true,
      index: true,
    },
    profileHandle: {
      type: String,
      required: true,
      index: true,
    },
    windowHours: {
      type: Number,
      required: true,
    },
    maxPosts: {
      type: Number,
      required: true,
    },
    generatedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    text: {
      type: String,
      required: true,
    },
    videoIds: {
      type: [String],
      required: true,
      default: [],
    },
    status: {
      type: String,
      enum: ['ok', 'warning', 'error'],
      required: true,
      default: 'ok',
    },
    warningMessage: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: 'reports',
  }
);

// Create compound unique index for reportDate + profileHandle
reportSchema.index({ reportDate: 1, profileHandle: 1 }, { unique: true });

// Export models
export const Video: Model<VideoDocument> = mongoose.model<VideoDocument>(
  'Video',
  videoSchema
);

export const Run: Model<RunDocument> = mongoose.model<RunDocument>(
  'Run',
  runSchema
);

export const Report: Model<ReportDocument> = mongoose.model<ReportDocument>(
  'Report',
  reportSchema
);

/**
 * Create all indexes
 */
export async function createIndexes(): Promise<void> {
  console.log('Creating database indexes...');
  await Promise.all([
    Video.createIndexes(),
    Run.createIndexes(),
    Report.createIndexes(),
  ]);
  console.log('✅ Database indexes created');
}
