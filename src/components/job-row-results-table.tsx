import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  getExpandedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ExpandedState,
} from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  RotateCcw,
  ArrowUpDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { formatTime } from "@/components/job-status";
import { useRetrySingleRow } from "@/lib/mutations";
import { queries } from "@/lib/queries";
import type { RowWithAttemptsInfo, Attempt } from "@/api/client";

type StatusFilter = "all" | "success" | "failed";

function RetryButton({ rowId, jobId }: { rowId: string; jobId: string }) {
  const retryMutation = useRetrySingleRow(jobId);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={(e) => {
        e.stopPropagation();
        retryMutation.mutate(rowId);
      }}
      disabled={retryMutation.isPending}
    >
      {retryMutation.isPending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <RotateCcw className="size-3.5" />
      )}
    </Button>
  );
}

function AttemptsList({ rowId }: { rowId: string }) {
  const { data: attempts, isLoading } = useQuery(queries.jobs.rowAttempts(rowId));

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-2 px-4">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm text-muted-foreground">Loading attempts...</span>
      </div>
    );
  }

  if (!attempts || attempts.length === 0) {
    return (
      <div className="py-2 px-4 text-sm text-muted-foreground">
        No attempts recorded
      </div>
    );
  }

  return (
    <div className="py-2 px-4">
      <div className="text-xs font-medium text-muted-foreground mb-2">
        Attempt History ({attempts.length} attempts)
      </div>
      <div className="space-y-2">
        {attempts.map((attempt: Attempt, index: number) => (
          <div
            key={attempt.id}
            className={cn(
              "flex items-start gap-3 p-2 rounded-md text-sm",
              attempt.success ? "bg-green-500/10" : "bg-destructive/10"
            )}
          >
            <div className="flex-shrink-0 mt-0.5">
              {attempt.success ? (
                <CheckCircle className="size-4 text-green-600" />
              ) : (
                <AlertCircle className="size-4 text-destructive" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium">
                  {index + 1}. {attempt.reason.replace("_", " ")}
                </span>
                <Badge variant={attempt.success ? "default" : "destructive"} className="text-xs">
                  {attempt.success ? "Success" : "Failed"}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {formatTime(attempt.createdAt)}
                </span>
              </div>
              {attempt.errorMessage && (
                <p className="text-xs text-destructive mt-1 truncate">
                  {attempt.errorMessage}
                </p>
              )}
              {attempt.identityElements && (
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Identity: {attempt.identityElements}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function JobRowResultsTable({
  rows,
  total,
  identityFieldNames,
  jobId,
  isLoading,
  statusFilter,
  onStatusFilterChange,
}: {
  rows: readonly RowWithAttemptsInfo[] | undefined;
  total: number;
  identityFieldNames: string[];
  jobId: string;
  isLoading: boolean;
  statusFilter: StatusFilter;
  onStatusFilterChange: (filter: StatusFilter) => void;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const data = useMemo(() => {
    if (!rows) return [];
    return rows.map((row) => {
      let identityElements: string[] = [];
      if (row.identityElements) {
        try {
          const parsed = JSON.parse(row.identityElements) as string[];
          identityElements = parsed.map((value, i) => {
            const fieldName = identityFieldNames[i];
            return fieldName ? `${fieldName}: ${value}` : String(value);
          });
        } catch {
          identityElements = [];
        }
      }
      return {
        ...row,
        parsedIdentityElements: identityElements,
      };
    });
  }, [rows, identityFieldNames]);

  type RowData = (typeof data)[number];

  const columns: ColumnDef<RowData>[] = useMemo(
    () => [
      {
        id: "expander",
        header: "",
        cell: ({ row }) => (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => row.toggleExpanded()}
          >
            <ChevronDown
              className={cn(
                "size-4 transition-transform",
                row.getIsExpanded() && "rotate-180"
              )}
            />
          </Button>
        ),
        size: 40,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.status === "success" ? (
              <CheckCircle className="size-4 text-green-600" />
            ) : (
              <AlertCircle className="size-4 text-destructive" />
            )}
          </div>
        ),
        size: 70,
      },
      {
        accessorKey: "rowIndex",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Row #
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="font-mono">{row.original.rowIndex + 1}</span>
        ),
        size: 80,
      },
      {
        accessorKey: "parsedIdentityElements",
        header: "Identity",
        cell: ({ row }) => {
          const identity = row.original.parsedIdentityElements;
          if (!identity || identity.length === 0) {
            return <span className="text-muted-foreground">-</span>;
          }
          const display = identity.join(", ");
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="font-mono text-xs truncate block max-w-[200px]">
                    {display}
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="font-mono text-xs">{display}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        accessorKey: "attemptCount",
        header: "Attempts",
        cell: ({ row }) => (
          <Badge variant="secondary" className="text-xs">
            {row.original.attemptCount}
          </Badge>
        ),
        size: 80,
      },
      {
        accessorKey: "updatedAt",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Updated
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatTime(row.original.updatedAt)}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "latestError",
        header: "Latest Error",
        cell: ({ row }) => {
          const error = row.original.latestError;
          if (!error) {
            return <span className="text-muted-foreground">-</span>;
          }
          return (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="text-destructive text-xs truncate block max-w-[250px]">
                    {error}
                  </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-md">
                  <p className="text-xs whitespace-pre-wrap">{error}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          );
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          if (row.original.status !== "failed") return null;
          return <RetryButton rowId={row.original.id} jobId={jobId} />;
        },
        size: 60,
      },
    ],
    [jobId]
  );

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getRowCanExpand: () => true,
    state: {
      sorting,
      expanded,
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const successCount = rows?.filter((r) => r.status === "success").length ?? 0;
  const failedCount = rows?.filter((r) => r.status === "failed").length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <p className="text-sm">No row results yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onStatusFilterChange("all")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            All ({total})
          </button>
          <button
            onClick={() => onStatusFilterChange("success")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              statusFilter === "success"
                ? "bg-green-500/20 text-green-600 ring-1 ring-green-500/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            Success ({successCount})
          </button>
          <button
            onClick={() => onStatusFilterChange("failed")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              statusFilter === "failed"
                ? "bg-destructive/20 text-destructive ring-1 ring-destructive/30"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            Failed ({failedCount})
          </button>
        </div>
        <div className="text-sm text-muted-foreground">{data.length} rows</div>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    style={{ width: header.column.getSize() }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <>
                  <TableRow
                    key={row.id}
                    className={cn(
                      "cursor-pointer",
                      row.original.status === "success"
                        ? "bg-green-500/5 hover:bg-green-500/10"
                        : "bg-destructive/5 hover:bg-destructive/10"
                    )}
                    onClick={() => row.toggleExpanded()}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                  {row.getIsExpanded() && (
                    <TableRow key={`${row.id}-expanded`}>
                      <TableCell colSpan={columns.length} className="p-0 bg-muted/30">
                        <AttemptsList rowId={row.original.id} />
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronsLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
          >
            <ChevronsRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
