import crypto from 'crypto';

export interface LogContext {
  correlationId?: string;
  platform?: string;
  action?: string;
  ip?: string;
  [key: string]: unknown;
}

/**
 * Sanitizes log parameters to avoid accidental credential or PII leaks.
 */
function sanitizeLogData(data?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!data) return undefined;
  const safe: Record<string, unknown> = {};
  const sensitiveKeys = new Set([
    'cookie',
    'authorization',
    'token',
    'password',
    'secret',
    'key',
    'access_token',
  ]);

  for (const [k, v] of Object.entries(data)) {
    if (sensitiveKeys.has(k.toLowerCase())) {
      safe[k] = '[REDACTED]';
    } else {
      safe[k] = v;
    }
  }
  return safe;
}

export class Logger {
  public static generateCorrelationId(): string {
    return crypto.randomUUID();
  }

  public static info(message: string, context?: LogContext): void {
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeLogData(context),
      })
    );
  }

  public static warn(message: string, context?: LogContext): void {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        message,
        ...sanitizeLogData(context),
      })
    );
  }

  public static error(message: string, error?: unknown, context?: LogContext): void {
    const errorDetails =
      error instanceof Error
        ? { errorName: error.name, errorMessage: error.message, stack: error.stack }
        : { rawError: String(error) };

    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        message,
        ...errorDetails,
        ...sanitizeLogData(context),
      })
    );
  }
}
