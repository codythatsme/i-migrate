import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Database, Search, AlertCircle } from "lucide-react";
import { queries } from "@/lib/queries";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { boEntitiesToDestinations, type DestinationDefinition } from "@/api/destinations";

type DataSourceSelectorProps = {
  environmentId: string | null;
  selectedEntityType: string | null;
  onSelect: (destination: DestinationDefinition) => void;
  title?: string;
  description?: string;
  /** When true, only shows Multi/Single sources (hides Standard types) */
  destinationOnly?: boolean;
};

export function DataSourceSelector({
  environmentId,
  selectedEntityType,
  onSelect,
  title = "Select Data Source",
  description = "Choose a data source to export from",
  destinationOnly = false,
}: DataSourceSelectorProps) {
  const [search, setSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    ...queries.dataSources.byEnvironment(environmentId),
    enabled: !!environmentId,
  });

  // Convert to DestinationDefinition and filter to only Multi/Single sources when used as destination selector
  const dataSources = useMemo(() => {
    const allSources = boEntitiesToDestinations(data?.Items.$values ?? []);
    if (!destinationOnly) return allSources;
    return allSources.filter(
      (source) =>
        source.objectTypeName === "Multi" ||
        source.objectTypeName === "Single" ||
        source.objectTypeName === "SINGLE",
    );
  }, [data, destinationOnly]);

  // Apply search filter
  const filteredSources = useMemo(() => {
    if (!search.trim()) return dataSources;
    const searchLower = search.toLowerCase();
    return dataSources.filter(
      (source) =>
        source.entityTypeName.toLowerCase().includes(searchLower) ||
        (source.description ?? "").toLowerCase().includes(searchLower),
    );
  }, [dataSources, search]);

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
          <p>{search ? "No matching data sources found" : "No data sources available"}</p>
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-2">
          {filteredSources.map((source) => (
            <DataSourceCard
              key={source.entityTypeName}
              source={source}
              isSelected={selectedEntityType === source.entityTypeName}
              onSelect={() => onSelect(source)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {filteredSources.length} of {dataSources.length} data sources
      </p>
    </div>
  );
}

type DataSourceCardProps = {
  source: DestinationDefinition;
  isSelected: boolean;
  onSelect: () => void;
};

function DataSourceCard({ source, isSelected, onSelect }: DataSourceCardProps) {
  const propertyCount = source.properties.length;

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
          <div className="flex flex-col gap-0.5 min-w-0">
            <CardTitle className="text-sm truncate">{source.entityTypeName}</CardTitle>
            <CardDescription className="text-xs truncate">
              {source.description || source.objectTypeName}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{propertyCount} properties</span>
          {source.primaryParentEntityTypeName && (
            <>
              <span>•</span>
              <span className="truncate">Parent: {source.primaryParentEntityTypeName}</span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
