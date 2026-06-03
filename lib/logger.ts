// lib/logger.ts
// Structured logging pipeline for Conferly
// Provides consistent, structured logging across server and client

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
}

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: number;
  context?: Record<string, unknown>;
  component?: string;
  userId?: string;
  meetingId?: string;
  requestId?: string;
}

export interface LoggerOptions {
  component?: string;
  context?: Record<string, unknown>;
  userId?: string;
  meetingId?: string;
  requestId?: string;
}

/**
 * Core logger class
 */
class Logger {
  private isServer: boolean;
  
  constructor() {
    this.isServer = typeof window === 'undefined';
  }
  
  /**
   * Create a structured log entry
   */
  private createEntry(
    level: LogLevel,
    message: string,
    options: LoggerOptions = {}
  ): LogEntry {
    return {
      level,
      message,
      timestamp: Date.now(),
      ...options,
    };
  }
  
  /**
   * Format log entry for output
   */
  private formatEntry(entry: LogEntry): string {
    const parts = [
      `[${entry.level.toUpperCase()}]`,
      `[${new Date(entry.timestamp).toISOString()}]`,
      entry.component ? `[${entry.component}]` : '',
      entry.message,
    ].filter(Boolean);
    
    const base = parts.join(' ');
    
    if (entry.context && Object.keys(entry.context).length > 0) {
      return `${base} ${JSON.stringify(entry.context)}`;
    }
    
    return base;
  }
  
  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    const formatted = this.formatEntry(entry);
    
    switch (entry.level) {
      case LogLevel.DEBUG:
        if (process.env.NODE_ENV === 'development') {
           
          console.debug(formatted);
        }
        break;
      case LogLevel.INFO:
         
        console.info(formatted);
        break;
      case LogLevel.WARN:
         
        console.warn(formatted);
        break;
      case LogLevel.ERROR:
         
        console.error(formatted);
        break;
    }
  }
  
  /**
   * Log at debug level
   */
  debug(message: string, options?: LoggerOptions): void {
    this.output(this.createEntry(LogLevel.DEBUG, message, options));
  }
  
  /**
   * Log at info level
   */
  info(message: string, options?: LoggerOptions): void {
    this.output(this.createEntry(LogLevel.INFO, message, options));
  }
  
  /**
   * Log at warn level
   */
  warn(message: string, options?: LoggerOptions): void {
    this.output(this.createEntry(LogLevel.WARN, message, options));
  }
  
  /**
   * Log at error level
   */
  error(message: string, error?: Error, options?: LoggerOptions): void {
    const entry = this.createEntry(LogLevel.ERROR, message, options);
    
    if (error) {
      entry.context = {
        ...entry.context,
        error: error.message,
        stack: error.stack,
      };
    }
    
    this.output(entry);
  }
  
  /**
   * Create a child logger with preset context
   */
  child(options: LoggerOptions): Logger {
    const child = new Logger();
    child.debug = (message: string, opts?: LoggerOptions) => 
      this.debug(message, { ...options, ...opts });
    child.info = (message: string, opts?: LoggerOptions) => 
      this.info(message, { ...options, ...opts });
    child.warn = (message: string, opts?: LoggerOptions) => 
      this.warn(message, { ...options, ...opts });
    child.error = (message: string, error?: Error, opts?: LoggerOptions) => 
      this.error(message, error, { ...options, ...opts });
    return child;
  }
}

// Singleton instance
const logger = new Logger();

export default logger;

/**
 * Convenience function to create a scoped logger
 */
export function createLogger(component: string): Logger {
  return logger.child({ component });
}
