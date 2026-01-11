import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Search, AlertCircle, Filter, Info, ChevronDown, ChevronUp } from "lucide-react";
import { queries } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { BoEntityDefinition } from "@/api/client";

// Compatibility filter for destination selection
type CompatibilityFilter = {
  objectTypeName: string;
  primaryParentEntityTypeName: string;
};

type DataSourceSelectorProps = {
  environmentId: string | null;
  selectedEntityType: string | null;
  onSelect: (entityType: string) => void;
  title?: string;
  description?: string;
  /** When provided, only shows sources matching these criteria */
  compatibilityFilter?: CompatibilityFilter;
  /** When true, only shows Multi/Single sources (hides Standard types) */
  destinationOnly?: boolean;
};

export function DataSourceSelector({
  environmentId,
  selectedEntityType,
  onSelect,
  title = "Select Data Source",
  description = "Choose a data source to export from",
  compatibilityFilter,
  destinationOnly = false,
}: DataSourceSelectorProps) {
  const [search, setSearch] = useState("");
  const [showFilteredDetails, setShowFilteredDetails] = useState(false);

  const { data, isLoading, error } = useQuery({
    ...queries.dataSources.byEnvironment(environmentId),
    enabled: !!environmentId,
  });

  // Filter to only Multi/Single sources when used as destination selector
  const dataSources = useMemo(() => {
    const allSources = data?.Items.$values ?? [];
    if (!destinationOnly) return allSources;
    return allSources.filter(
      (source) =>
        source.ObjectTypeName === "Multi" ||
        source.ObjectTypeName === "Single" ||
        source.ObjectTypeName === "SINGLE",
    );
  }, [data, destinationOnly]);

  // Apply compatibility filter if provided
  const { compatibleSources, incompatibleSources } = useMemo(() => {
    if (!compatibilityFilter) {
      return { compatibleSources: dataSources, incompatibleSources: [] };
    }

    const compatible: BoEntityDefinition[] = [];
    const incompatible: BoEntityDefinition[] = [];

    for (const source of dataSources) {
      const matchesObjectType = source.ObjectTypeName === compatibilityFilter.objectTypeName;
      // Allow migrations between compatible parent types
      const matchesParent =
        source.PrimaryParentEntityTypeName === compatibilityFilter.primaryParentEntityTypeName ||
        // Allow Party/Event sources -> Standalone destinations
        ((compatibilityFilter.primaryParentEntityTypeName === "Party" ||
          compatibilityFilter.primaryParentEntityTypeName === "Event") &&
          source.PrimaryParentEntityTypeName === "Standalone") ||
        // Allow Standalone/Event sources -> Party destinations (requires IsPrimary mapping)
        ((compatibilityFilter.primaryParentEntityTypeName === "Standalone" ||
          compatibilityFilter.primaryParentEntityTypeName === "Event") &&
          source.PrimaryParentEntityTypeName === "Party");

      if (matchesObjectType && matchesParent) {
        compatible.push(source);
      } else {
        incompatible.push(source);
      }
    }

    return { compatibleSources: compatible, incompatibleSources: incompatible };
  }, [dataSources, compatibilityFilter]);

  // Apply search filter on top of compatibility filter
  const filteredSources = useMemo(() => {
    if (!search.trim()) return compatibleSources;
    const searchLower = search.toLowerCase();
    return compatibleSources.filter(
      (source) =>
        source.EntityTypeName.toLowerCase().includes(searchLower) ||
        (source.Description ?? "").toLowerCase().includes(searchLower),
    );
  }, [compatibleSources, search]);

  if (!environmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="size-8 mb-3" />
        <p>No environment selected</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search data sources..." className="pl-9" disabled />
        </div>
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-destructive">
        <AlertCircle className="size-8 mb-3" />
        <p className="font-medium">Failed to load data sources</p>
        <p className="text-sm text-muted-foreground mt-1">
          {error instanceof Error ? error.message : "Unknown error"}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Compatibility filter notice */}
      {compatibilityFilter && incompatibleSources.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30">
          <button
            onClick={() => setShowFilteredDetails(!showFilteredDetails)}
            className="flex w-full items-center justify-between gap-3 p-3 text-left"
          >
            <div className="flex items-center gap-2">
              <Filter className="size-4 text-amber-600 dark:text-amber-500" />
              <span className="text-sm text-amber-800 dark:text-amber-200">
                {incompatibleSources.length} source{incompatibleSources.length !== 1 ? "s" : ""}{" "}
                filtered due to incompatible structure
              </span>
            </div>
            {showFilteredDetails ? (
              <ChevronUp className="size-4 text-amber-600 dark:text-amber-500" />
            ) : (
              <ChevronDown className="size-4 text-amber-600 dark:text-amber-500" />
            )}
          </button>

          {showFilteredDetails && (
            <div className="border-t border-amber-200 dark:border-amber-900/50 px-3 py-3 text-sm">
              <div className="flex items-start gap-2 mb-3">
                <Info className="size-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
                <p className="text-amber-800 dark:text-amber-200">
                  Only data sources with matching structure can be used as destinations. Compatible
                  sources must have the same <strong>ObjectTypeName</strong> (
                  {compatibilityFilter.objectTypeName}) and a compatible{" "}
                  <strong>PrimaryParentEntityTypeName</strong> (
                  {compatibilityFilter.primaryParentEntityTypeName || "none"})
                  {(compatibilityFilter.primaryParentEntityTypeName === "Party" ||
                    compatibilityFilter.primaryParentEntityTypeName === "Event") &&
                    " (or Standalone)"}
                  {(compatibilityFilter.primaryParentEntityTypeName === "Standalone" ||
                    compatibilityFilter.primaryParentEntityTypeName === "Event") &&
                    " (or Party, requires IsPrimary mapping)"}
                  .
                </p>
              </div>
              <div className="max-h-32 overflow-y-auto">
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300 mb-1.5">
                  Filtered sources:
                </p>
                <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
                  {incompatibleSources.slice(0, 10).map((source) => (
                    <li key={source.EntityTypeName} className="flex items-center gap-2">
                      <span className="font-mono">{source.EntityTypeName}</span>
                      <span className="text-amber-600 dark:text-amber-500">
                        ({source.ObjectTypeName}, Parent:{" "}
                        {source.PrimaryParentEntityTypeName || "none"})
                      </span>
                    </li>
                  ))}
                  {incompatibleSources.length > 10 && (
                    <li className="text-amber-600 dark:text-amber-500">
                      ...and {incompatibleSources.length - 10} more
                    </li>
                  )}
                </ul>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search data sources..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filteredSources.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Database className="size-8 mb-3" />
          <p>
            {search
              ? "No matching data sources found"
              : compatibilityFilter
                ? "No compatible data sources available"
                : "No data sources available"}
          </p>
          {compatibilityFilter && !search && compatibleSources.length === 0 && (
            <p className="text-sm mt-2 text-center max-w-md">
              None of the data sources in this environment match the required structure
              (ObjectTypeName: {compatibilityFilter.objectTypeName}, Parent:{" "}
              {compatibilityFilter.primaryParentEntityTypeName || "none"}
              {(compatibilityFilter.primaryParentEntityTypeName === "Party" ||
                compatibilityFilter.primaryParentEntityTypeName === "Event") &&
                " or Standalone"}
              {(compatibilityFilter.primaryParentEntityTypeName === "Standalone" ||
                compatibilityFilter.primaryParentEntityTypeName === "Event") &&
                " or Party"}
              ).
            </p>
          )}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredSources.map((source) => (
            <DataSourceCard
              key={source.EntityTypeName}
              source={source}
              isSelected={selectedEntityType === source.EntityTypeName}
              onSelect={() => onSelect(source.EntityTypeName)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filteredSources.length} of {compatibleSources.length} compatible data sources
        {compatibilityFilter && ` (${dataSources.length} total)`}
      </p>
    </div>
  );
}

type DataSourceCardProps = {
  source: BoEntityDefinition;
  isSelected: boolean;
  onSelect: () => void;
};

function DataSourceCard({ source, isSelected, onSelect }: DataSourceCardProps) {
  const propertyCount = source.Properties?.$values.length ?? 0;

  return (
    <Card
      className={`cursor-pointer transition-all hover:border-primary/50 ${
        isSelected ? "border-primary ring-1 ring-primary bg-primary/5" : ""
      }`}
      onClick={onSelect}
    >
      <CardHeader className="p-4 pb-2">
        <div className="flex items-start gap-3">
          <div
            className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
            }`}
          >
            <Database className="size-4" />
          </div>
          <div className="flex flex-col gap-0.5 overflow-hidden">
            <CardTitle className="text-sm truncate">{source.EntityTypeName}</CardTitle>
            <CardDescription className="text-xs truncate">
              {source.Description || source.ObjectTypeName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{propertyCount} properties</span>
          {source.PrimaryParentEntityTypeName && (
            <>
              <span>•</span>
              <span className="truncate">Parent: {source.PrimaryParentEntityTypeName}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
