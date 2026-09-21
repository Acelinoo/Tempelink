import { serverConfig } from '../../config';
import { TempelinkError } from '../../types/errors';
import { Logger } from '../../telemetry/logger';

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

interface PlatformCircuitInfo {
  state: CircuitState;
  consecutiveFailures: number;
  lastFailureTime: number;
  cooldownUntil: number;
}

/**
 * Provider Circuit Breaker Engine
 * Protects third-party upstream providers from cascading failures, request storms,
 * and rapid API quota exhaustion when upstream services degrade.
 *
 * States:
 * - CLOSED: Normal healthy traffic.
 * - OPEN: Trips after N consecutive failures; fast-fails requests immediately with 503.
 * - HALF_OPEN: Cooldown expired; allows 1 probe request to test upstream health.
 */
export class ProviderCircuitBreaker {
  private static platforms = new Map<string, PlatformCircuitInfo>();

  private static getInfo(platformId: string): PlatformCircuitInfo {
    let info = this.platforms.get(platformId);
    if (!info) {
      info = {
        state: 'CLOSED',
        consecutiveFailures: 0,
        lastFailureTime: 0,
        cooldownUntil: 0,
      };
      this.platforms.set(platformId, info);
    }
    return info;
  }

  public static getState(platformId: string): CircuitState {
    if (!serverConfig.circuitBreaker.enabled) {
      return 'CLOSED';
    }

    const info = this.getInfo(platformId);
    const now = Date.now();

    if (info.state === 'OPEN' && now >= info.cooldownUntil) {
      info.state = 'HALF_OPEN';
    }

    return info.state;
  }

  public static canExecute(platformId: string): boolean {
    if (!serverConfig.circuitBreaker.enabled) {
      return true;
    }

    const state = this.getState(platformId);
    if (state === 'CLOSED') {
      return true;
    }

    if (state === 'HALF_OPEN') {
      return true;
    }

    return false; // OPEN
  }

  public static recordSuccess(platformId: string): void {
    const info = this.getInfo(platformId);
    if (info.state !== 'CLOSED' || info.consecutiveFailures > 0) {
      Logger.info(`[CircuitBreaker] Provider ${platformId} recovered. Circuit CLOSED.`, {
        platform: platformId,
        previousState: info.state,
      });
    }

    info.state = 'CLOSED';
    info.consecutiveFailures = 0;
    info.cooldownUntil = 0;
  }

  public static recordFailure(platformId: string, error?: unknown): void {
    const info = this.getInfo(platformId);
    const now = Date.now();
    info.consecutiveFailures += 1;
    info.lastFailureTime = now;

    const threshold = serverConfig.circuitBreaker.failureThreshold;
    const cooldownMs = serverConfig.circuitBreaker.cooldownSeconds * 1000;

    if (info.state === 'HALF_OPEN' || info.consecutiveFailures >= threshold) {
      info.state = 'OPEN';
      info.cooldownUntil = now + cooldownMs;

      Logger.warn(
        `[CircuitBreaker] Provider ${platformId} tripped. Circuit OPEN for ${serverConfig.circuitBreaker.cooldownSeconds}s.`,
        {
          platform: platformId,
          consecutiveFailures: info.consecutiveFailures,
          cooldownSeconds: serverConfig.circuitBreaker.cooldownSeconds,
          error: error instanceof Error ? error.message : String(error),
        }
      );
    }
  }

  public static isTrippableError(error: unknown): boolean {
    if (error instanceof TempelinkError) {
      return (
        error.code === 'PROVIDER_UNAVAILABLE' ||
        error.code === 'TEMPORARY_FAILURE' ||
        error.code === 'RATE_LIMITED'
      );
    }

    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      const name = error.name.toLowerCase();
      return (
        name.includes('abort') ||
        name.includes('timeout') ||
        msg.includes('timeout') ||
        msg.includes('econnreset') ||
        msg.includes('fetch failed')
      );
    }

    return false;
  }

  public static async execute<T>(
    platformId: string,
    fn: () => Promise<T>
  ): Promise<T> {
    if (!this.canExecute(platformId)) {
      const info = this.getInfo(platformId);
      const remainingSeconds = Math.max(
        1,
        Math.ceil((info.cooldownUntil - Date.now()) / 1000)
      );

      throw new TempelinkError(
        'CIRCUIT_BREAKER_OPEN',
        `Penyedia ${platformId} sedang mengalami gangguan dan dalam masa pemulihan (coba lagi dalam ${remainingSeconds} detik).`,
        {
          platformId,
          remainingSeconds,
          circuitState: 'OPEN',
        }
      );
    }

    try {
      const result = await fn();
      this.recordSuccess(platformId);
      return result;
    } catch (err: unknown) {
      if (this.isTrippableError(err)) {
        this.recordFailure(platformId, err);
      }
      throw err;
    }
  }

  public static reset(): void {
    this.platforms.clear();
  }
}
