import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderCircuitBreaker } from '../src/lib/platforms/core/circuit-breaker';
import { TempelinkError } from '../src/lib/types/errors';
import { serverConfig } from '../src/lib/config';

describe('Phase 9 — Provider Circuit Breaker Engine', () => {
  const TEST_PLATFORM = 'test_platform';

  beforeEach(() => {
    ProviderCircuitBreaker.reset();
    serverConfig.circuitBreaker.failureThreshold = 3;
    serverConfig.circuitBreaker.cooldownSeconds = 1; // 1s for fast testing
    serverConfig.circuitBreaker.enabled = true;
  });

  it('starts in CLOSED state and allows execution', () => {
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');
    expect(ProviderCircuitBreaker.canExecute(TEST_PLATFORM)).toBe(true);
  });

  it('executes successful actions and remains CLOSED', async () => {
    const result = await ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
      return 'success_payload';
    });

    expect(result).toBe('success_payload');
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');
  });

  it('does NOT trip circuit on non-trippable client errors (e.g. INVALID_URL)', async () => {
    for (let i = 0; i < 5; i++) {
      try {
        await ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
          throw new TempelinkError('INVALID_URL', 'Invalid link syntax');
        });
      } catch {
        // Expected
      }
    }

    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');
    expect(ProviderCircuitBreaker.canExecute(TEST_PLATFORM)).toBe(true);
  });

  it('trips from CLOSED to OPEN after 3 consecutive provider failures', async () => {
    const error = new TempelinkError('PROVIDER_UNAVAILABLE', 'Upstream 503');

    // Attempt 1
    await expect(
      ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
        throw error;
      })
    ).rejects.toThrow('Upstream 503');
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');

    // Attempt 2
    await expect(
      ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
        throw error;
      })
    ).rejects.toThrow('Upstream 503');
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');

    // Attempt 3: Hits threshold (3) -> Trips to OPEN
    await expect(
      ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
        throw error;
      })
    ).rejects.toThrow('Upstream 503');
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('OPEN');
    expect(ProviderCircuitBreaker.canExecute(TEST_PLATFORM)).toBe(false);
  });

  it('fast-fails immediately with CIRCUIT_BREAKER_OPEN (503) without executing action when OPEN', async () => {
    // Force trip to OPEN
    for (let i = 0; i < 3; i++) {
      ProviderCircuitBreaker.recordFailure(TEST_PLATFORM, new Error('timeout'));
    }
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('OPEN');

    let actionExecuted = false;
    try {
      await ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
        actionExecuted = true;
        return 'should_not_run';
      });
      expect.unreachable('Should have thrown');
    } catch (err) {
      expect(actionExecuted).toBe(false);
      expect(err).toBeInstanceOf(TempelinkError);
      const tempelinkErr = err as TempelinkError;
      expect(tempelinkErr.code).toBe('CIRCUIT_BREAKER_OPEN');
      expect(tempelinkErr.httpStatus).toBe(503);
    }
  });

  it('transitions to HALF_OPEN after cooldown and recovers to CLOSED upon successful probe', async () => {
    // 1. Force trip to OPEN with 1s cooldown
    for (let i = 0; i < 3; i++) {
      ProviderCircuitBreaker.recordFailure(TEST_PLATFORM, new Error('500'));
    }
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('OPEN');

    // 2. Wait for cooldown to expire (1.1s)
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // 3. State transitions to HALF_OPEN
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('HALF_OPEN');
    expect(ProviderCircuitBreaker.canExecute(TEST_PLATFORM)).toBe(true);

    // 4. Successful probe closes the circuit
    const result = await ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
      return 'recovered';
    });

    expect(result).toBe('recovered');
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('CLOSED');
  });

  it('re-trips to OPEN if probe request fails during HALF_OPEN', async () => {
    // 1. Force trip
    for (let i = 0; i < 3; i++) {
      ProviderCircuitBreaker.recordFailure(TEST_PLATFORM, new Error('500'));
    }

    // 2. Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 1100));
    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('HALF_OPEN');

    // 3. Failed probe trips immediately back to OPEN
    try {
      await ProviderCircuitBreaker.execute(TEST_PLATFORM, async () => {
        throw new TempelinkError('TEMPORARY_FAILURE', 'Gateway timeout');
      });
    } catch {
      // Expected
    }

    expect(ProviderCircuitBreaker.getState(TEST_PLATFORM)).toBe('OPEN');
  });
});
