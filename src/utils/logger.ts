type LogLevel = 'info' | 'warn' | 'error' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

class Logger {
  private serializeMetadata(metadata?: Record<string, unknown>): string {
    return metadata ? ` ${JSON.stringify(metadata)}` : '';
  }
  
  private log(level: LogLevel, message: string, metadata?: Record<string, unknown>): void {
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      metadata,
    };
    
    const output = process.env.NODE_ENV === 'production' 
      ? JSON.stringify(entry)
      : `[${entry.timestamp}] [${level.toUpperCase()}] ${message}${this.serializeMetadata(metadata)}`;
    
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  }
  
  info(message: string, metadata?: Record<string, unknown>): void {
    this.log('info', message, metadata);
  }
  
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.log('warn', message, metadata);
  }
  
  error(message: string, metadata?: Record<string, unknown>): void {
    this.log('error', message, metadata);
  }
  
  debug(message: string, metadata?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      this.log('debug', message, metadata);
    }
  }
}

const logger = new Logger();

export default logger;