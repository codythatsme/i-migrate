import {
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/api/client";

export function StatusIcon({ status, className }: { status: JobStatus; className?: string }) {
  switch (status) {
    case "completed":
      return <CheckCircle className={cn("size-4 text-green-600", className)} />;
    case "failed":
      return <XCircle className={cn("size-4 text-destructive", className)} />;
    case "partial":
      return <AlertCircle className={cn("size-4 text-amber-500", className)} />;
    case "cancelled":
      return <XCircle className={cn("size-4 text-muted-foreground", className)} />;
    case "running":
      return <Loader2 className={cn("size-4 animate-spin text-primary", className)} />;
    case "queued":
    default:
      return <Clock className={cn("size-4 text-muted-foreground", className)} />;
  }
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const config: Record<JobStatus, { label: string; className: string }> = {
    queued: { label: "Queued", className: "bg-muted text-muted-foreground" },
    running: { label: "Running", className: "bg-primary/10 text-primary" },
    completed: { label: "Completed", className: "bg-green-500/10 text-green-600" },
    failed: { label: "Failed", className: "bg-destructive/10 text-destructive" },
    partial: { label: "Partial", className: "bg-amber-500/10 text-amber-600" },
    cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
  };
  const { label, className } = config[status];

  return (
    <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", className)}>{label}</span>
  );
}

export function formatDuration(startedAt: string | null, completedAt: string | null): string {
  if (!startedAt) return "—";
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const ms = end - start;
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
}

export function formatRelativeTime(timestamp: string): string {
  const now = Date.now();
  const date = new Date(timestamp).getTime();
  const diff = now - date;
  if (diff < 60000) return "Just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

export function formatFullDateTime(timestamp: string | null): string {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function formatTime(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export function getProgressPercent(processedRows: number, totalRows: number | null): number {
  if (!totalRows || totalRows === 0) return 0;
  return Math.round((processedRows / totalRows) * 100);
}
