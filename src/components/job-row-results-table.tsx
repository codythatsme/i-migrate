import { useState, useMemo } from "react";
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import {
  AlertCircle,
  CheckCircle,
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
import { cn } from "@/lib/utils";
import { formatTime } from "@/components/job-status";
import { useRetrySingleRow } from "@/lib/mutations";
import type { FailedRow, SuccessRow } from "@/api/client";

export type RowResult = {
  id: string;
  type: "success" | "failure";
  rowIndex: number;
  timestamp: string;
  identityElements?: string[];
  errorMessage?: string;
  retryCount?: number;
  autoRetryAttempts?: number;
};

type StatusFilter = "all" | "success" | "failed";

function combineRowResults(
  successRows: readonly SuccessRow[] | undefined,
  failedRows: readonly FailedRow[] | undefined,
  identityFieldNames: string[]
): RowResult[] {
  const results: RowResult[] = [];

  if (successRows) {
    for (const row of successRows) {
      let identityElements: string[] = [];
      try {
        const parsed = JSON.parse(row.identityElements) as string[];
        identityElements = parsed.map((value, i) => {
          const fieldName = identityFieldNames[i];
          return fieldName ? `${fieldName}: ${value}` : String(value);
        });
      } catch {
        identityElements = [];
      }

      results.push({
        id: `s-${row.id}`,
        type: "success",
        rowIndex: row.rowIndex,
        timestamp: row.createdAt,
        identityElements,
      });
    }
  }

  if (failedRows) {
    for (const row of failedRows) {
      results.push({
        id: `f-${row.id}`,
        type: "failure",
        rowIndex: row.rowIndex,
        timestamp: row.createdAt,
        errorMessage: row.errorMessage,
        retryCount: row.retryCount,
        autoRetryAttempts: row.autoRetryAttempts,
      });
    }
  }

  return results.sort((a, b) => a.rowIndex - b.rowIndex);
}

function RetryButton({ rowId, jobId }: { rowId: string; jobId: string }) {
  // Extract actual row ID from the prefixed version
  const actualRowId = rowId.replace("f-", "");
  const retryMutation = useRetrySingleRow(jobId);

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 px-2 text-xs"
      onClick={() => retryMutation.mutate(actualRowId)}
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

export function JobRowResultsTable({
  successRows,
  failedRows,
  identityFieldNames,
  jobId,
  isLoading,
}: {
  successRows: readonly SuccessRow[] | undefined;
  failedRows: readonly FailedRow[] | undefined;
  identityFieldNames: string[];
  jobId: string;
  isLoading: boolean;
}) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const data = useMemo(
    () => combineRowResults(successRows, failedRows, identityFieldNames),
    [successRows, failedRows, identityFieldNames]
  );

  const filteredData = useMemo(() => {
    if (statusFilter === "all") return data;
    return data.filter((row) =>
      statusFilter === "success" ? row.type === "success" : row.type === "failure"
    );
  }, [data, statusFilter]);

  const columns: ColumnDef<RowResult>[] = useMemo(
    () => [
      {
        accessorKey: "type",
        header: "Status",
        cell: ({ row }) => (
          <div className="flex items-center justify-center">
            {row.original.type === "success" ? (
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
        accessorKey: "identityElements",
        header: "Identity",
        cell: ({ row }) => {
          const identity = row.original.identityElements;
          if (!identity || identity.length === 0) {
            return <span className="text-muted-foreground">—</span>;
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
        accessorKey: "timestamp",
        header: ({ column }) => (
          <Button
            variant="ghost"
            size="sm"
            className="-ml-3 h-8"
            onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          >
            Time
            <ArrowUpDown className="ml-1 size-3" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground text-xs">
            {formatTime(row.original.timestamp)}
          </span>
        ),
        size: 100,
      },
      {
        accessorKey: "errorMessage",
        header: "Error",
        cell: ({ row }) => {
          const error = row.original.errorMessage;
          if (!error) {
            return <span className="text-muted-foreground">—</span>;
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
          if (row.original.type !== "failure") return null;
          return <RetryButton rowId={row.original.id} jobId={jobId} />;
        },
        size: 60,
      },
    ],
    [jobId]
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: {
      sorting,
      columnFilters,
    },
    initialState: {
      pagination: {
        pageSize: 50,
      },
    },
  });

  const successCount = successRows?.length ?? 0;
  const failedCount = failedRows?.length ?? 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (data.length === 0) {
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
            onClick={() => setStatusFilter("all")}
            className={cn(
              "px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              statusFilter === "all"
                ? "bg-primary text-primary-foreground"
                : "bg-muted/50 text-muted-foreground hover:bg-muted"
            )}
          >
            All ({data.length})
          </button>
          <button
            onClick={() => setStatusFilter("success")}
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
            onClick={() => setStatusFilter("failed")}
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
        <div className="text-sm text-muted-foreground">
          {filteredData.length} rows
        </div>
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
                <TableRow
                  key={row.id}
                  className={cn(
                    row.original.type === "success"
                      ? "bg-green-500/5 hover:bg-green-500/10"
                      : "bg-destructive/5 hover:bg-destructive/10"
                  )}
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
