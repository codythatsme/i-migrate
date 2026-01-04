import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Folder,
  FileSearch,
  Search,
  Loader2,
  AlertCircle,
  ChevronRight,
  ArrowUp,
} from 'lucide-react'
import { queries } from '@/lib/queries'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import type { DocumentSummaryData } from '@/api/client'

// ---------------------
// Constants
// ---------------------

const ROOT_PATH = '$'
const FILE_TYPES = ['FOL', 'IQD']

// ---------------------
// Types
// ---------------------

type QueryFileBrowserProps = {
  environmentId: string | null
  selectedQueryPath: string | null
  onSelect: (path: string, name: string) => void
  title?: string
  description?: string
}

// ---------------------
// Component
// ---------------------

export function QueryFileBrowser({
  environmentId,
  selectedQueryPath,
  onSelect,
  title = 'Select Query',
  description = 'Browse the CMS to find a query (IQA) to export from.',
}: QueryFileBrowserProps) {
  const [currentPath, setCurrentPath] = useState(ROOT_PATH)
  const [pathInput, setPathInput] = useState(ROOT_PATH)
  const [isEditingPath, setIsEditingPath] = useState(false)

  // Sync pathInput when currentPath changes
  useEffect(() => {
    setPathInput(currentPath)
  }, [currentPath])

  // Fetch the current folder document to get its DocumentId
  const {
    data: folderData,
    isLoading: folderLoading,
    error: folderError,
  } = useQuery({
    ...queries.documents.byPath(environmentId, currentPath),
    enabled: !!environmentId && !!currentPath,
  })

  const folderId = folderData?.Result?.DocumentId ?? null

  // Fetch documents in the current folder
  const {
    data: documentsData,
    isLoading: documentsLoading,
    error: documentsError,
  } = useQuery({
    ...queries.documents.inFolder(environmentId, folderId, FILE_TYPES),
    enabled: !!environmentId && !!folderId,
  })

  // Parse path into breadcrumb segments
  const breadcrumbs = useMemo(() => {
    if (currentPath === ROOT_PATH) {
      return [{ name: ROOT_PATH, path: ROOT_PATH }]
    }
    const segments = currentPath.split('/')
    return segments.map((segment, index) => ({
      name: segment,
      path: segments.slice(0, index + 1).join('/'),
    }))
  }, [currentPath])

  // Helper to determine if a document is a folder
  const isFolder = (doc: DocumentSummaryData) => doc.IsFolder ?? doc.DocumentTypeId === 'FOL'

  // Sort documents: folders first, then queries
  const sortedDocuments = useMemo(() => {
    if (!documentsData?.Result?.$values) return []
    return [...documentsData.Result.$values].sort((a, b) => {
      // Folders before queries
      const aIsFolder = isFolder(a)
      const bIsFolder = isFolder(b)
      if (aIsFolder && !bIsFolder) return -1
      if (!aIsFolder && bIsFolder) return 1
      // Then alphabetically
      return a.Name.localeCompare(b.Name)
    })
  }, [documentsData])

  // Handlers
  const handleNavigateToFolder = (path: string) => {
    setCurrentPath(path)
  }

  const handleNavigateUp = () => {
    if (currentPath === ROOT_PATH) return
    const segments = currentPath.split('/')
    segments.pop()
    const parentPath = segments.length === 1 ? ROOT_PATH : segments.join('/')
    setCurrentPath(parentPath)
  }

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const cleanPath = pathInput.trim() || ROOT_PATH
    setCurrentPath(cleanPath)
    setIsEditingPath(false)
  }

  const handleDocumentClick = (doc: DocumentSummaryData) => {
    if (isFolder(doc)) {
      handleNavigateToFolder(doc.Path)
    } else {
      // It's a query (IQD) - select it
      onSelect(doc.Path, doc.Name)
    }
  }

  const isLoading = folderLoading || documentsLoading
  const error = folderError || documentsError

  // ---------------------
  // Render
  // ---------------------

  if (!environmentId) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="size-8 mb-3" />
        <p>No environment selected</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Path Input */}
      <form onSubmit={handlePathSubmit} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Enter path (e.g., $/Queries)"
            className="pl-9 font-mono text-sm"
            value={pathInput}
            onChange={(e) => setPathInput(e.target.value)}
            onFocus={() => setIsEditingPath(true)}
            onBlur={() => {
              // Slight delay to allow form submission
              setTimeout(() => setIsEditingPath(false), 200)
            }}
          />
        </div>
        <Button type="submit" variant="outline" size="default">
          Go
        </Button>
      </form>

      {/* Breadcrumbs */}
      <nav className="flex items-center gap-1 text-sm overflow-x-auto pb-1">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.path} className="flex items-center">
            {index > 0 && <ChevronRight className="size-3.5 text-muted-foreground shrink-0" />}
            <Button
              variant="ghost"
              size="sm"
              className={`h-7 px-2 ${
                index === breadcrumbs.length - 1
                  ? 'font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => handleNavigateToFolder(crumb.path)}
            >
              {crumb.name}
            </Button>
          </div>
        ))}
      </nav>

      {/* File Browser */}
      <div className="rounded-lg border border-border bg-card/50 min-h-[300px] max-h-[400px] overflow-y-auto">
        {/* Navigation bar */}
        <div className="sticky top-0 flex items-center gap-2 px-3 py-2 border-b border-border bg-card/80 backdrop-blur-sm z-10">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            onClick={handleNavigateUp}
            disabled={currentPath === ROOT_PATH}
          >
            <ArrowUp className="size-3.5 mr-1" />
            Up
          </Button>
          <span className="text-xs text-muted-foreground ml-auto">
            {sortedDocuments.length} item{sortedDocuments.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="p-3 flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 rounded-md" />
            ))}
          </div>
        )}

        {/* Error state */}
        {error && !isLoading && (
          <div className="flex flex-col items-center justify-center py-12 text-destructive">
            <AlertCircle className="size-8 mb-3" />
            <p className="font-medium">Failed to load documents</p>
            <p className="text-sm text-muted-foreground mt-1">
              {error instanceof Error ? error.message : 'Unknown error'}
            </p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && sortedDocuments.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Folder className="size-8 mb-3" />
            <p>This folder is empty</p>
          </div>
        )}

        {/* Document list */}
        {!isLoading && !error && sortedDocuments.length > 0 && (
          <div className="p-2">
            {sortedDocuments.map((doc) => (
              <DocumentRow
                key={doc.DocumentId}
                document={doc}
                isSelected={selectedQueryPath === doc.Path}
                isFolder={isFolder(doc)}
                onClick={() => handleDocumentClick(doc)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Selected query display */}
      {selectedQueryPath && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/5 p-3">
          <FileSearch className="size-5 text-primary shrink-0" />
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-medium">Selected Query</span>
            <span className="text-xs text-muted-foreground font-mono truncate">
              {selectedQueryPath}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------
// DocumentRow Component
// ---------------------

type DocumentRowProps = {
  document: DocumentSummaryData
  isSelected: boolean
  isFolder: boolean
  onClick: () => void
}

function DocumentRow({ document, isSelected, isFolder, onClick }: DocumentRowProps) {
  const Icon = isFolder ? Folder : FileSearch

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-left transition-colors ${
        isSelected
          ? 'bg-primary text-primary-foreground'
          : 'hover:bg-muted/50'
      }`}
    >
      <div
        className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
          isSelected
            ? 'bg-primary-foreground/20'
            : isFolder
            ? 'bg-amber-500/10 text-amber-600 dark:text-amber-500'
            : 'bg-primary/10 text-primary'
        }`}
      >
        <Icon className="size-4" />
      </div>
      <div className="flex flex-col overflow-hidden">
        <span className={`text-sm font-medium truncate ${isSelected ? '' : ''}`}>
          {document.Name}
          {isFolder && '/'}
        </span>
        {document.Description && (
          <span
            className={`text-xs truncate ${
              isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
            }`}
          >
            {document.Description}
          </span>
        )}
      </div>
      {isFolder && (
        <ChevronRight
          className={`size-4 ml-auto shrink-0 ${
            isSelected ? 'text-primary-foreground/70' : 'text-muted-foreground'
          }`}
        />
      )}
    </button>
  )
}

