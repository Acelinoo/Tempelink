import { Capability } from './capability';
import { MediaAuthor } from './media';

export type BatchStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'COMPLETED'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'CANCELLED';

export type JobStatus =
  | 'PENDING'
  | 'RESOLVING'
  | 'READY'
  | 'DOWNLOADING'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface JobMediaMetadata {
  title?: string;
  thumbnailUrl?: string;
  durationSeconds?: number | null;
  author?: MediaAuthor | null;
  availableCapabilitiesCount: number;
}

export interface QueueJob {
  id: string;
  batchId: string;
  sourceUrl: string;
  canonicalUrl?: string;
  platform: string;
  status: JobStatus;
  capabilityId?: string;
  selectedCapability?: Capability;
  mediaMetadata?: JobMediaMetadata;
  attempts: number;
  maxAttempts: number;
  errorCode?: string;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Batch {
  id: string;
  clientIp: string;
  status: BatchStatus;
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  cancelledJobs: number;
  createdAt: string;
  updatedAt: string;
  jobs: QueueJob[];
}

export interface BatchCreateInput {
  urls: string[];
}

export interface BatchSummaryResponse {
  batchId: string;
  status: BatchStatus;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
  createdAt: string;
  updatedAt: string;
  jobs: QueueJob[];
  storageDriver?: 'file' | 'postgres' | 'memory';
}
