/**
 * MilkFlow 2.0 Observability 2.0 Metrics Engine
 * In-memory sliding telemetry registry tracking HTTP, DB, Payments, Webhooks, AI, and Queues.
 */

interface MetricsData {
  httpRequestsTotal: number;
  http5xxErrorsTotal: number;
  apiLatencySumMs: number;
  apiRequestsCount: number;
  dbLatencyMs: number;
  dbConnectionsActive: number;
  webhookFailuresTotal: number;
  paymentFailuresTotal: number;
  queueBacklog: number;
  activeSseConnections: number;
  offlineSyncFailuresTotal: number;
  aiRequestsTotal: number;
  aiLatencySumMs: number;
  aiErrorsTotal: number;
}

class ObservabilityRegistry {
  private metrics: MetricsData = {
    httpRequestsTotal: 0,
    http5xxErrorsTotal: 0,
    apiLatencySumMs: 0,
    apiRequestsCount: 0,
    dbLatencyMs: 0,
    dbConnectionsActive: 0,
    webhookFailuresTotal: 0,
    paymentFailuresTotal: 0,
    queueBacklog: 0,
    activeSseConnections: 0,
    offlineSyncFailuresTotal: 0,
    aiRequestsTotal: 0,
    aiLatencySumMs: 0,
    aiErrorsTotal: 0,
  };

  public recordHttpRequest(durationMs: number, is5xx = false) {
    this.metrics.httpRequestsTotal++;
    this.metrics.apiLatencySumMs += durationMs;
    this.metrics.apiRequestsCount++;
    if (is5xx) {
      this.metrics.http5xxErrorsTotal++;
    }
  }

  public recordDbLatency(latencyMs: number, activeConnections = 0) {
    this.metrics.dbLatencyMs = latencyMs;
    this.metrics.dbConnectionsActive = activeConnections;
  }

  public recordWebhookFailure() {
    this.metrics.webhookFailuresTotal++;
  }

  public recordPaymentFailure() {
    this.metrics.paymentFailuresTotal++;
  }

  public setQueueBacklog(count: number) {
    this.metrics.queueBacklog = count;
  }

  public trackSseConnection(delta: number) {
    this.metrics.activeSseConnections = Math.max(0, this.metrics.activeSseConnections + delta);
  }

  public recordOfflineSyncFailure() {
    this.metrics.offlineSyncFailuresTotal++;
  }

  public recordAiRequest(durationMs: number, isError = false) {
    this.metrics.aiRequestsTotal++;
    this.metrics.aiLatencySumMs += durationMs;
    if (isError) {
      this.metrics.aiErrorsTotal++;
    }
  }

  public getMetrics() {
    const avgHttpLatency =
      this.metrics.apiRequestsCount > 0
        ? Math.round(this.metrics.apiLatencySumMs / this.metrics.apiRequestsCount)
        : 0;
    const avgAiLatency =
      this.metrics.aiRequestsTotal > 0
        ? Math.round(this.metrics.aiLatencySumMs / this.metrics.aiRequestsTotal)
        : 0;

    return {
      ...this.metrics,
      avgHttpLatencyMs: avgHttpLatency,
      avgAiLatencyMs: avgAiLatency,
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  public toPrometheusFormat(): string {
    const m = this.getMetrics();
    return [
      `# HELP milkflow_http_requests_total Total number of HTTP requests`,
      `# TYPE milkflow_http_requests_total counter`,
      `milkflow_http_requests_total ${m.httpRequestsTotal}`,
      `# HELP milkflow_http_5xx_errors_total Total number of 5xx HTTP responses`,
      `# TYPE milkflow_http_5xx_errors_total counter`,
      `milkflow_http_5xx_errors_total ${m.http5xxErrorsTotal}`,
      `# HELP milkflow_http_avg_latency_ms Average HTTP request latency in ms`,
      `# TYPE milkflow_http_avg_latency_ms gauge`,
      `milkflow_http_avg_latency_ms ${m.avgHttpLatencyMs}`,
      `# HELP milkflow_db_latency_ms Last measured PostgreSQL query latency in ms`,
      `# TYPE milkflow_db_latency_ms gauge`,
      `milkflow_db_latency_ms ${m.dbLatencyMs}`,
      `# HELP milkflow_db_connections_active Active PostgreSQL pool connections`,
      `# TYPE milkflow_db_connections_active gauge`,
      `milkflow_db_connections_active ${m.dbConnectionsActive}`,
      `# HELP milkflow_webhook_failures_total Total number of webhook processing failures`,
      `# TYPE milkflow_webhook_failures_total counter`,
      `milkflow_webhook_failures_total ${m.webhookFailuresTotal}`,
      `# HELP milkflow_payment_failures_total Total number of failed payment attempts`,
      `# TYPE milkflow_payment_failures_total counter`,
      `milkflow_payment_failures_total ${m.paymentFailuresTotal}`,
      `# HELP milkflow_active_sse_connections Number of live Server-Sent Events subscribers`,
      `# TYPE milkflow_active_sse_connections gauge`,
      `milkflow_active_sse_connections ${m.activeSseConnections}`,
      `# HELP milkflow_ai_requests_total Total AI copilot and forecasting queries`,
      `# TYPE milkflow_ai_requests_total counter`,
      `milkflow_ai_requests_total ${m.aiRequestsTotal}`,
      `# HELP milkflow_ai_avg_latency_ms Average AI response latency in ms`,
      `# TYPE milkflow_ai_avg_latency_ms gauge`,
      `milkflow_ai_avg_latency_ms ${m.avgAiLatencyMs}`,
      `# HELP milkflow_ai_errors_total Total AI processing errors`,
      `# TYPE milkflow_ai_errors_total counter`,
      `milkflow_ai_errors_total ${m.aiErrorsTotal}`,
    ].join('\n');
  }
}

export const telemetry = new ObservabilityRegistry();
