import { Logger } from './logger';

export type TelemetryEventType =
  | 'resolve_started'
  | 'resolve_success'
  | 'resolve_failed'
  | 'platform_detected'
  | 'download_started'
  | 'download_completed'
  | 'download_failed'
  | 'batch_created'
  | 'batch_completed'
  | 'batch_failed'
  | 'cache_hit'
  | 'cache_miss'
  | 'cache_coalesced';

export interface TelemetryPayload {
  correlationId: string;
  eventType: TelemetryEventType;
  platform?: string;
  mediaType?: string;
  durationMs?: number;
  errorCode?: string;
  capabilityId?: string;
  urlCount?: number;
  cacheStatus?: 'HIT' | 'MISS' | 'COALESCED';
}

/**
 * Privacy-conscious event dispatcher.
 * Never stores full raw URLs, private tokens, or personal identifiers.
 */
export function trackEvent(payload: TelemetryPayload): void {
  Logger.info(`[Telemetry] ${payload.eventType}`, {
    ...payload,
  });
}
