"use client";

/**
 * Resource throttling and backpressure utilities
 * Manages rate limiting for high-frequency operations
 */

/**
 * Message queue with backpressure handling
 * Queues messages when rate exceeds threshold
 * Processes queued messages at controlled rate
 */
export class MessageQueue<T> {
  private queue: T[] = [];
  private processing = false;
  private processedCount = 0;
  private readonly maxQueueSize: number;
  private readonly batchSize: number;
  private readonly delayMs: number;

  constructor(options: {
    maxQueueSize?: number;
    batchSize?: number;
    delayMs?: number;
  } = {}) {
    this.maxQueueSize = options.maxQueueSize || 500;
    this.batchSize = options.batchSize || 10;
    this.delayMs = options.delayMs || 50;
  }

  enqueue(item: T): boolean {
    if (this.queue.length >= this.maxQueueSize) {
      console.warn(`MessageQueue: Queue full (${this.maxQueueSize} items), dropping oldest`);
      this.queue.shift();
    }
    this.queue.push(item);
    return true;
  }

  async process(handler: (items: T[]) => Promise<void> | void): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.splice(0, this.batchSize);
        await handler(batch);
        this.processedCount += batch.length;

        // Delay between batches to prevent overwhelming the system
        if (this.queue.length > 0) {
          await new Promise(resolve => setTimeout(resolve, this.delayMs));
        }
      }
    } finally {
      this.processing = false;
    }
  }

  clear(): void {
    this.queue = [];
    this.processedCount = 0;
  }

  size(): number {
    return this.queue.length;
  }

  stats() {
    return {
      queueSize: this.queue.length,
      processedCount: this.processedCount,
      isProcessing: this.processing,
    };
  }
}

/**
 * Rate limiter for high-frequency operations
 * Prevents > N operations per second
 */
export class RateLimiter {
  private timestamps: number[] = [];
  private readonly maxPerSecond: number;

  constructor(maxPerSecond: number = 100) {
    this.maxPerSecond = maxPerSecond;
  }

  allow(): boolean {
    const now = Date.now();
    // Remove timestamps older than 1 second
    this.timestamps = this.timestamps.filter(t => now - t < 1000);

    if (this.timestamps.length < this.maxPerSecond) {
      this.timestamps.push(now);
      return true;
    }

    return false;
  }

  reset(): void {
    this.timestamps = [];
  }

  getUsage(): number {
    const now = Date.now();
    this.timestamps = this.timestamps.filter(t => now - t < 1000);
    return this.timestamps.length;
  }
}

/**
 * Virtual list renderer (virtualization)
 * Only renders visible items to save memory/CPU
 */
export interface VirtualListOptions {
  itemHeight: number;
  containerHeight: number;
  overscan?: number;
}

export function calculateVisibleRange(
  scrollTop: number,
  totalItems: number,
  options: VirtualListOptions
): { startIndex: number; endIndex: number } {
  const { itemHeight, containerHeight, overscan = 5 } = options;

  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
  const endIndex = Math.min(
    totalItems,
    Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
  );

  return { startIndex, endIndex };
}

/**
 * Bounded array with max size
 * Automatically removes oldest items when limit reached
 */
export class BoundedArray<T> {
  private items: T[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  push(item: T): void {
    this.items.push(item);
    if (this.items.length > this.maxSize) {
      // Remove oldest item
      this.items.shift();
    }
  }

  pushMany(items: T[]): void {
    for (const item of items) {
      this.push(item);
    }
  }

  getAll(): T[] {
    return this.items;
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  slice(start: number, end?: number): T[] {
    return this.items.slice(start, end);
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  isFull(): boolean {
    return this.items.length >= this.maxSize;
  }
}

/**
 * Adaptive frame rate controller
 * Reduces frame rate when CPU usage is high
 */
export class AdaptiveFrameRateController {
  private targetFps: number;
  private minFps: number = 5;
  private maxFps: number;
  private lastFrameTime: number = 0;

  constructor(targetFps: number = 30, maxFps: number = 60) {
    this.targetFps = targetFps;
    this.maxFps = maxFps;
  }

  shouldRender(): boolean {
    const now = performance.now();
    const timeSinceLastFrame = now - this.lastFrameTime;
    const minTimeBetweenFrames = 1000 / this.targetFps;

    if (timeSinceLastFrame >= minTimeBetweenFrames) {
      this.lastFrameTime = now;
      return true;
    }

    return false;
  }

  adjustFps(cpuUsagePercent: number): void {
    // If CPU > 90%, reduce target FPS
    if (cpuUsagePercent > 90) {
      this.targetFps = Math.max(this.minFps, this.targetFps - 5);
    }
    // If CPU < 30%, increase target FPS back toward max
    else if (cpuUsagePercent < 30) {
      this.targetFps = Math.min(this.maxFps, this.targetFps + 5);
    }
  }

  getCurrentFps(): number {
    return this.targetFps;
  }

  reset(): void {
    this.lastFrameTime = 0;
  }
}

/**
 * Exponential backoff for retries
 * Used for network retry logic
 */
export class ExponentialBackoff {
  private attempt: number = 0;
  private readonly initialDelay: number;
  private readonly maxDelay: number;
  private readonly maxAttempts: number;

  constructor(
    initialDelay: number = 1000,
    maxDelay: number = 30000,
    maxAttempts: number = 5
  ) {
    this.initialDelay = initialDelay;
    this.maxDelay = maxDelay;
    this.maxAttempts = maxAttempts;
  }

  getDelay(): number {
    const delay = Math.min(
      this.maxDelay,
      this.initialDelay * Math.pow(2, this.attempt)
    );
    return delay + Math.random() * 1000; // Add jitter
  }

  async waitAndRetry<T>(fn: () => Promise<T>): Promise<T> {
    while (this.attempt < this.maxAttempts) {
      try {
        return await fn();
      } catch (error) {
        if (this.attempt >= this.maxAttempts - 1) {
          throw error;
        }
        const delay = this.getDelay();
        console.warn(`Retry attempt ${this.attempt + 1}/${this.maxAttempts} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
        this.attempt++;
      }
    }

    throw new Error(`Max retries (${this.maxAttempts}) exceeded`);
  }

  reset(): void {
    this.attempt = 0;
  }
}
