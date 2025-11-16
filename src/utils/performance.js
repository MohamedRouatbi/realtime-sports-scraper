/**
 * Performance monitoring utilities
 */

/**
 * Measure execution time of async function
 */
export async function measureAsync(fn, label = 'Operation') {
  const start = Date.now();
  try {
    const result = await fn();
    const duration = Date.now() - start;
    return { result, duration, label };
  } catch (error) {
    const duration = Date.now() - start;
    throw { error, duration, label };
  }
}

/**
 * Measure execution time of sync function
 */
export function measureSync(fn, label = 'Operation') {
  const start = Date.now();
  try {
    const result = fn();
    const duration = Date.now() - start;
    return { result, duration, label };
  } catch (error) {
    const duration = Date.now() - start;
    throw { error, duration, label };
  }
}

/**
 * Performance monitor class
 */
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }

  /**
   * Start timing
   */
  start(label) {
    this.metrics.set(label, {
      startTime: Date.now(),
      count: (this.metrics.get(label)?.count || 0) + 1,
    });
  }

  /**
   * End timing and record
   */
  end(label) {
    const metric = this.metrics.get(label);
    if (!metric) {
      return null;
    }

    const duration = Date.now() - metric.startTime;
    const existing = this.metrics.get(label);

    this.metrics.set(label, {
      ...existing,
      lastDuration: duration,
      totalDuration: (existing.totalDuration || 0) + duration,
      avgDuration: ((existing.totalDuration || 0) + duration) / existing.count,
      minDuration: Math.min(existing.minDuration || Infinity, duration),
      maxDuration: Math.max(existing.maxDuration || 0, duration),
    });

    return duration;
  }

  /**
   * Get metrics for label
   */
  getMetrics(label) {
    return this.metrics.get(label);
  }

  /**
   * Get all metrics
   */
  getAllMetrics() {
    const result = {};
    for (const [label, metric] of this.metrics) {
      result[label] = {
        count: metric.count,
        avgDuration: metric.avgDuration?.toFixed(2),
        minDuration: metric.minDuration,
        maxDuration: metric.maxDuration,
        totalDuration: metric.totalDuration,
      };
    }
    return result;
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics.clear();
  }
}

/**
 * Global performance monitor instance
 */
export const perfMonitor = new PerformanceMonitor();
