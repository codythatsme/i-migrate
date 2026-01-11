import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  ChevronRight,
  Clock,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { queries } from "@/lib/queries";
import { clearTraces, exportTraces } from "@/api/client";
import { downloadTracesJson } from "@/lib/trace-export";
import type { TraceSummary, StoredTrace, StoredSpan } from "@/api/client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/traces")({
  component: TracesPage,
});

function TracesPage() {
  const queryClient = useQueryClient();
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

  const { data: traces, isLoading, refetch, isFetching } = useQuery(queries.traces.all());
  const { data: selectedTrace } = useQuery(queries.traces.byId(selectedTraceId));

  const clearMutation = useMutation({
    mutationFn: clearTraces,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traces"] });
      setSelectedTraceId(null);
    },
  });

  const exportMutation = useMutation({
    mutationFn: async () => {
      const traces = await exportTraces();
      downloadTracesJson(traces);
    },
  });

  const toggleSpan = (spanId: string) => {
    setExpandedSpans((prev) => {
      const next = new Set(prev);
      if (next.has(spanId)) {
        next.delete(spanId);
      } else {
        next.add(spanId);
      }
      return next;
    });
  };

  const formatDuration = (ms: number | null) => {
    if (ms === null) return "—";
    if (ms < 1) return "<1ms";
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const formatRelativeTime = (timestamp: number) => {
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return new Date(timestamp).toLocaleDateString();
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Build span tree from flat list
  const buildSpanTree = (spans: readonly StoredSpan[]): SpanNode[] => {
    const spanMap = new Map<string, SpanNode>();
    const roots: SpanNode[] = [];

    // Create nodes
    for (const span of spans) {
      spanMap.set(span.id, { span, children: [] });
    }

    // Build tree
    for (const span of spans) {
      const node = spanMap.get(span.id)!;
      if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
        spanMap.get(span.parentSpanId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    return roots;
  };

  type SpanNode = {
    span: StoredSpan;
    children: SpanNode[];
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Traces</h1>
          <p className="text-muted-foreground text-sm">
            View and debug API requests and their spans
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("size-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !traces?.length}
          >
            <Download className={cn("size-4", exportMutation.isPending && "animate-pulse")} />
            Export
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearMutation.mutate()}
            disabled={clearMutation.isPending || !traces?.length}
          >
            <Trash2 className="size-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 min-h-[600px]">
        {/* Trace List */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium flex items-center gap-2">
              <Activity className="size-4" />
              Recent Traces
              {traces && (
                <span className="text-muted-foreground font-normal">({traces.length})</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : !traces?.length ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <Activity className="size-8 mb-2 opacity-50" />
                <p className="text-sm">No traces recorded yet</p>
                <p className="text-xs">Make some API calls to see traces here</p>
              </div>
            ) : (
              <div className="divide-y">
                {traces.map((trace) => (
                  <TraceListItem
                    key={trace.id}
                    trace={trace}
                    isSelected={selectedTraceId === trace.id}
                    onSelect={() => setSelectedTraceId(trace.id)}
                    formatDuration={formatDuration}
                    formatRelativeTime={formatRelativeTime}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Trace Details */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Trace Details</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-auto p-0">
            {!selectedTraceId ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <p className="text-sm">Select a trace to view details</p>
              </div>
            ) : !selectedTrace ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="p-4">
                {/* Trace Summary */}
                <div className="flex flex-col gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <StatusIcon status={selectedTrace.status} />
                    <span className="font-medium">{selectedTrace.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="text-muted-foreground">ID</div>
                    <div className="font-mono text-xs">{selectedTrace.id}</div>
                    <div className="text-muted-foreground">Duration</div>
                    <div className="font-mono">{formatDuration(selectedTrace.durationMs)}</div>
                    <div className="text-muted-foreground">Time</div>
                    <div className="font-mono">{formatTime(selectedTrace.startTime)}</div>
                    <div className="text-muted-foreground">Spans</div>
                    <div>{selectedTrace.spans.length}</div>
                  </div>
                </div>

                <Separator className="my-4" />

                {/* Span Tree */}
                <div className="flex flex-col gap-1">
                  <h4 className="text-sm font-medium mb-2">Span Tree</h4>
                  <div className="flex flex-col">
                    {buildSpanTree(selectedTrace.spans).map((node) => (
                      <SpanTreeNode
                        key={node.span.id}
                        node={node}
                        depth={0}
                        expandedSpans={expandedSpans}
                        toggleSpan={toggleSpan}
                        formatDuration={formatDuration}
                        copyToClipboard={copyToClipboard}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ---------------------
// Sub-components
// ---------------------

function StatusIcon({ status, className }: { status: string; className?: string }) {
  if (status === "ok") {
    return <CheckCircle className={cn("size-4 text-green-600", className)} />;
  }
  if (status === "error") {
    return <AlertCircle className={cn("size-4 text-destructive", className)} />;
  }
  return <Loader2 className={cn("size-4 animate-spin text-muted-foreground", className)} />;
}

function TraceListItem({
  trace,
  isSelected,
  onSelect,
  formatDuration,
  formatRelativeTime,
}: {
  trace: TraceSummary;
  isSelected: boolean;
  onSelect: () => void;
  formatDuration: (ms: number | null) => string;
  formatRelativeTime: (ts: number) => string;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full px-4 py-3 text-left transition-colors hover:bg-accent/50",
        isSelected && "bg-accent",
      )}
    >
      <div className="flex items-center gap-3">
        <StatusIcon status={trace.status} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{trace.name}</span>
            <span className="text-xs text-muted-foreground font-mono">#{trace.id.slice(0, 8)}</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="size-3" />
              {formatRelativeTime(trace.startTime)}
            </span>
            <span className="font-mono">{formatDuration(trace.durationMs)}</span>
            <span>{trace.spanCount} spans</span>
          </div>
          {trace.errorMessage && (
            <div className="text-xs text-destructive truncate mt-1">{trace.errorMessage}</div>
          )}
        </div>
        <ChevronRight className="size-4 text-muted-foreground shrink-0" />
      </div>
    </button>
  );
}

type SpanNode = {
  span: StoredSpan;
  children: SpanNode[];
};

function SpanTreeNode({
  node,
  depth,
  expandedSpans,
  toggleSpan,
  formatDuration,
  copyToClipboard,
}: {
  node: SpanNode;
  depth: number;
  expandedSpans: Set<string>;
  toggleSpan: (id: string) => void;
  formatDuration: (ms: number | null) => string;
  copyToClipboard: (text: string) => void;
}) {
  const { span, children } = node;
  const isExpanded = expandedSpans.has(span.id);
  const hasDetails = span.errorCause || Object.keys(span.attributes).length > 0;

  return (
    <div className="flex flex-col">
      <button
        onClick={() => toggleSpan(span.id)}
        className={cn(
          "flex items-center gap-2 py-1.5 px-2 rounded text-sm hover:bg-accent/50 transition-colors text-left",
          span.status === "error" && "text-destructive",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasDetails || children.length > 0 ? (
          <ChevronRight
            className={cn("size-3 shrink-0 transition-transform", isExpanded && "rotate-90")}
          />
        ) : (
          <span className="w-3" />
        )}
        <StatusIcon status={span.status} className="size-3" />
        <span className="flex-1 truncate font-mono text-xs">{span.name}</span>
        <span className="text-xs text-muted-foreground font-mono shrink-0">
          {formatDuration(span.durationMs)}
        </span>
      </button>

      {isExpanded && (
        <div
          className="flex flex-col gap-2 py-2 px-3 mb-2 bg-muted/50 rounded text-xs"
          style={{ marginLeft: `${depth * 16 + 24}px` }}
        >
          {/* Attributes */}
          {Object.keys(span.attributes).length > 0 && (
            <div className="flex flex-col gap-1">
              <div className="font-medium text-muted-foreground">Attributes</div>
              <div className="font-mono bg-background/50 rounded p-2 overflow-x-auto">
                {Object.entries(span.attributes).map(([key, value]) => (
                  <div key={key} className="flex gap-2">
                    <span className="text-muted-foreground">{key}:</span>
                    <span>{JSON.stringify(value)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Error Cause */}
          {span.errorCause && (
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <div className="font-medium text-destructive">Error</div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyToClipboard(span.errorCause!);
                  }}
                >
                  <Copy className="size-3" />
                </Button>
              </div>
              <pre className="font-mono bg-background/50 rounded p-2 overflow-x-auto text-destructive whitespace-pre-wrap break-all max-h-64 overflow-y-auto">
                {span.errorCause}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* Children */}
      {children.map((child) => (
        <SpanTreeNode
          key={child.span.id}
          node={child}
          depth={depth + 1}
          expandedSpans={expandedSpans}
          toggleSpan={toggleSpan}
          formatDuration={formatDuration}
          copyToClipboard={copyToClipboard}
        />
      ))}
    </div>
  );
}
