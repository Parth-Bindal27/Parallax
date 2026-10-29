export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogContext {
  missionId?: string;
  nodeId?: string;
  actionId?: string;
  sourceId?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel = (process.env.LOG_LEVEL as LogLevel) || 'info';

  private readonly levels: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  private redact(obj: unknown): unknown {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.redact(item));
    }

    const sensitiveKeys = ['key', 'token', 'secret', 'password', 'authorization', 'cookie', 'api_key'];
    const redacted: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
        redacted[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        redacted[k] = this.redact(v);
      } else {
        redacted[k] = v;
      }
    }
    return redacted;
  }

  private log(level: LogLevel, message: string, context?: LogContext) {
    if (this.levels[level] < this.levels[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const safeContext = context ? this.redact(context) : {};

    const entry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(typeof safeContext === 'object' && safeContext !== null ? safeContext : {})
    };

    const formatted = `[${timestamp}] [${level.toUpperCase()}] ${message} ${
      context && Object.keys(context).length > 0 ? JSON.stringify(safeContext) : ''
    }`;

    if (level === 'error') {
      console.error(formatted);
    } else if (level === 'warn') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }

  debug(message: string, context?: LogContext) {
    this.log('debug', message, context);
  }

  info(message: string, context?: LogContext) {
    this.log('info', message, context);
  }

  warn(message: string, context?: LogContext) {
    this.log('warn', message, context);
  }

  error(message: string, context?: LogContext) {
    this.log('error', message, context);
  }
}

export const logger = new Logger();
