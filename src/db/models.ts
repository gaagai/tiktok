/**
 * Mongoose schemas and models
 */

import mongoose, { Schema, Model } from "mongoose";
import {
  VideoDocument,
  RunDocument,
  ReportDocument,
  LockDocument,
} from "../types/index.js";

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
      default: "Latest",
    },
    actorUsed: {
      type: String,
      enum: ["primary", "fallback"],
      required: false,
      default: "primary",
    },
    rawData: {
      type: Schema.Types.Mixed,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "videos",
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
    reportDate: {
      type: String,
      required: false,
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
      enum: ["SUCCEEDED", "FAILED", "PARTIAL"],
      required: true,
    },
    actorUsed: {
      type: String,
      enum: ["primary", "fallback"],
      required: false,
      default: "primary",
    },
    fallbackReason: {
      type: String,
      enum: ["FAILED", "ZERO_RESULTS", "LOW_RESULTS", null],
      required: false,
      default: null,
    },
    circuitBreakerSuppressed: {
      type: Boolean,
      required: false,
      default: false,
    },
    itemsFetchedRaw: {
      type: Number,
      required: false,
      default: 0,
    },
    itemsInRange: {
      type: Number,
      required: false,
      default: 0,
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
    warningFlags: {
      type: [String],
      required: false,
      default: [],
    },
    // Data Quality metrics (v2.1.0)
    missingCreateTimePct: {
      type: Number,
      required: false,
    },
    missingUrlPct: {
      type: Number,
      required: false,
    },
    // Empty Day tracking (v2.1.0)
    emptyDay: {
      type: Boolean,
      required: false,
      default: false,
    },
    emptyDayStreak: {
      type: Number,
      required: false,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "runs",
  }
);

// Create indexes
runSchema.index({ profileHandle: 1, startedAt: -1 });
runSchema.index({ profileHandle: 1, reportDate: -1 });
runSchema.index({ status: 1 });
runSchema.index({ actorUsed: 1 });

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
      enum: ["ok", "warning", "error"],
      required: true,
      default: "ok",
    },
    actorUsed: {
      type: String,
      enum: ["primary", "fallback"],
      required: false,
      default: "primary",
    },
    warningFlags: {
      type: [String],
      required: false,
      default: [],
    },
    // Empty Day tracking (v2.1.0)
    emptyDay: {
      type: Boolean,
      required: false,
      default: false,
    },
    emptyDayStreak: {
      type: Number,
      required: false,
      default: 0,
    },
    // Email tracking (v2.2.0)
    emailStatus: {
      type: String,
      enum: ["PENDING", "SENT", "FAILED"],
      required: false,
    },
    emailSentAt: {
      type: Date,
      required: false,
    },
    emailMessageId: {
      type: String,
      required: false,
    },
    emailError: {
      type: String,
      required: false,
    },
  },
  {
    timestamps: true,
    collection: "reports",
  }
);

// Create compound unique index for reportDate + profileHandle
reportSchema.index({ reportDate: 1, profileHandle: 1 }, { unique: true });

// Lock Schema (v2.1.0 - Concurrency Protection)
const lockSchema = new Schema<LockDocument>(
  {
    _id: {
      type: String,
      required: true,
    },
    lockedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  {
    timestamps: false,
    collection: "locks",
  }
);

// TTL index - automatically removes expired locks
lockSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Export models
export const Video: Model<VideoDocument> = mongoose.model<VideoDocument>(
  "Video",
  videoSchema
);

export const Run: Model<RunDocument> = mongoose.model<RunDocument>(
  "Run",
  runSchema
);

export const Report: Model<ReportDocument> = mongoose.model<ReportDocument>(
  "Report",
  reportSchema
);

export const Lock: Model<LockDocument> = mongoose.model<LockDocument>(
  "Lock",
  lockSchema
);

/**
 * Create all indexes
 */
export async function createIndexes(): Promise<void> {
  console.log("Creating database indexes...");
  await Promise.all([
    Video.createIndexes(),
    Run.createIndexes(),
    Report.createIndexes(),
    Lock.createIndexes(),
  ]);
  console.log("✅ Database indexes created");
}
