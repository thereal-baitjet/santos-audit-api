// Request timing instrumentation for latency analysis.
// Tracks stages: x402 validation, fetch, parse, score, respond.

class TimingTracker {
  constructor() {
    this.stages = {};
    this.startTime = Date.now();
  }

  mark(stageName) {
    if (!this.stages[stageName]) {
      this.stages[stageName] = { start: Date.now() };
    }
    return this;
  }

  end(stageName) {
    if (this.stages[stageName]) {
      this.stages[stageName].end = Date.now();
      this.stages[stageName].ms = this.stages[stageName].end - this.stages[stageName].start;
    }
    return this;
  }

  addHeaders(response) {
    const totalMs = Date.now() - this.startTime;
    response.headers.set('X-Response-Time', `${totalMs}ms`);

    // Build stage timings string: "x402=12ms,fetch=850ms,parse=120ms,score=80ms"
    const stageStr = Object.entries(this.stages)
      .filter(([_, data]) => data.ms !== undefined)
      .map(([name, data]) => `${name}=${data.ms}ms`)
      .join(',');

    if (stageStr) {
      response.headers.set('X-Stage-Timings', stageStr);
    }

    // Expose headers so browsers and agents can read timing data
    response.headers.append('Access-Control-Expose-Headers', 'X-Response-Time, X-Stage-Timings');

    return { totalMs, stages: this.stages };
  }

  getStats() {
    return {
      total: Date.now() - this.startTime,
      stages: Object.entries(this.stages)
        .reduce((acc, [name, data]) => {
          acc[name] = data.ms ?? 0;
          return acc;
        }, {}),
    };
  }
}

// Middleware to create timing tracker for each request
export function withTiming(handler) {
  return async (req, ...args) => {
    const timing = new TimingTracker();
    req.timing = timing;
    const response = await handler(req, ...args);
    timing.addHeaders(response);
    return response;
  };
}

// Helper for async stages
export async function timedStage(timing, stageName, fn) {
  timing.mark(stageName);
  try {
    const result = await fn();
    timing.end(stageName);
    return result;
  } catch (e) {
    timing.end(stageName);
    throw e;
  }
}

export { TimingTracker };
