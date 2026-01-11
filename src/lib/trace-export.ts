import type { StoredTrace, StoredSpan } from "@/api/schemas";

/**
 * Attribute keys to strip from span data (case-insensitive matching)
 */
const SENSITIVE_ATTRIBUTE_PATTERNS = [
  "environmentid",
  "url",
  "endpoint",
  "baseurl",
];

/**
 * Check if an attribute key should be stripped
 */
function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SENSITIVE_ATTRIBUTE_PATTERNS.some((pattern) => lowerKey.includes(pattern));
}

/**
 * Sanitize span attributes by removing sensitive keys
 */
function sanitizeAttributes(
  attributes: Record<string, unknown>,
): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!isSensitiveKey(key)) {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Sanitize a single span
 */
function sanitizeSpan(span: StoredSpan): StoredSpan {
  return {
    ...span,
    attributes: sanitizeAttributes(span.attributes),
  };
}

/**
 * Sanitize a trace by stripping sensitive data from all spans
 */
export function sanitizeTrace(trace: StoredTrace): StoredTrace {
  return {
    ...trace,
    spans: trace.spans.map(sanitizeSpan),
  };
}

/**
 * Sanitize an array of traces
 */
export function sanitizeTraces(traces: StoredTrace[]): StoredTrace[] {
  return traces.map(sanitizeTrace);
}

/**
 * Generate a timestamped filename for the export
 */
function generateFilename(): string {
  const now = new Date();
  const timestamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `traces-${timestamp}.json`;
}

/**
 * Trigger a browser download of the traces as JSON
 */
export function downloadTracesJson(traces: StoredTrace[]): void {
  const sanitized = sanitizeTraces(traces);
  const json = JSON.stringify(sanitized, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = generateFilename();
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
