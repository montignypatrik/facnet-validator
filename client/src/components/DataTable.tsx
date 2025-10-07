import { useState, useRef, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Search, MoreHorizontal, Plus, Upload, Download, RefreshCw, Filter, X, Columns } from "lucide-react";

interface Column {
  key: string;
  label: string;
  type?: "text" | "boolean" | "date" | "json" | "badge";
  render?: (value: any, row: any) => React.ReactNode;
  width?: number; // Default width in pixels
  minWidth?: number; // Minimum width when resizing
}

interface DataTableProps {
  data: any[];
  columns: Column[];
  loading?: boolean;
  onEdit?: (item: any) => void;
  onDelete?: (item: any) => void;
  onAdd?: () => void;
  onImport?: () => void;
  onExport?: () => void;
  onRefresh?: () => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  title?: string;
  columnFilters?: Record<string, string[]>;
  onColumnFiltersChange?: (filters: Record<string, string[]>) => void;
  allData?: any[]; // For getting unique values from all data, not just current page
}

export function DataTable({
  data,
  columns,
  loading,
  onEdit,
  onDelete,
  onAdd,
  onImport,
  onExport,
  onRefresh,
  searchValue,
  onSearchChange,
  title,
  columnFilters: externalColumnFilters,
  onColumnFiltersChange,
  allData,
}: DataTableProps) {
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initialWidths: Record<string, number> = {};
    columns.forEach((col) => {
      initialWidths[col.key] = col.width || 150;
    });
    return initialWidths;
  });

  const [resizing, setResizing] = useState<{ key: string; startX: number; startWidth: number } | null>(null);
  const [internalColumnFilters, setInternalColumnFilters] = useState<Record<string, string[]>>({});

  // Column visibility state - all visible by default
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() => {
    const initialVisibility: Record<string, boolean> = {};
    columns.forEach((col) => {
      initialVisibility[col.key] = true;
    });
    return initialVisibility;
  });

  // Use external filters if provided, otherwise use internal state
  const columnFilters = externalColumnFilters !== undefined ? externalColumnFilters : internalColumnFilters;

  useEffect(() => {
    if (!resizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizing) return;
      const delta = e.clientX - resizing.startX;
      const column = columns.find(c => c.key === resizing.key);
      const minWidth = column?.minWidth || 80;
      const newWidth = Math.max(minWidth, resizing.startWidth + delta);

      setColumnWidths(prev => ({
        ...prev,
        [resizing.key]: newWidth
      }));
    };

    const handleMouseUp = () => {
      setResizing(null);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [resizing, columns]);

  const handleResizeStart = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizing({
      key,
      startX: e.clientX,
      startWidth: columnWidths[key] || 150
    });
  };

  // Filter data based on column filters (only for internal filtering)
  // If external filters are provided, filtering is handled server-side
  const filteredData = onColumnFiltersChange
    ? data // Server-side filtering - don't filter client-side
    : data.filter((row) => {
        return Object.entries(columnFilters).every(([key, filterValues]) => {
          if (!filterValues || filterValues.length === 0) return true;
          const cellValue = row[key];
          if (cellValue === null || cellValue === undefined) return false;

          // Convert to string for comparison
          const cellString = typeof cellValue === 'object'
            ? JSON.stringify(cellValue).toLowerCase()
            : String(cellValue).toLowerCase();

          // Check if cell value matches ANY of the selected filter values (exact match)
          return filterValues.some(filterValue =>
            cellString === filterValue.toLowerCase()
          );
        });
      });

  const handleFilterToggle = (columnKey: string, value: string) => {
    const newFilters = { ...columnFilters };
    const currentValues = newFilters[columnKey] || [];

    if (currentValues.includes(value)) {
      // Remove value
      const updatedValues = currentValues.filter(v => v !== value);
      if (updatedValues.length === 0) {
        delete newFilters[columnKey];
      } else {
        newFilters[columnKey] = updatedValues;
      }
    } else {
      // Add value
      newFilters[columnKey] = [...currentValues, value];
    }

    if (onColumnFiltersChange) {
      onColumnFiltersChange(newFilters);
    } else {
      setInternalColumnFilters(newFilters);
    }
  };

  const clearAllFilters = () => {
    if (onColumnFiltersChange) {
      onColumnFiltersChange({});
    } else {
      setInternalColumnFilters({});
    }
  };

  const activeFilterCount = Object.values(columnFilters).reduce((sum, values) => sum + values.length, 0);

  // Toggle column visibility
  const toggleColumnVisibility = (columnKey: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [columnKey]: !prev[columnKey]
    }));
  };

  // Get visible columns
  const visibleColumns = columns.filter(col => columnVisibility[col.key]);

  // Get unique values for a column
  const getUniqueValues = (columnKey: string): string[] => {
    const values = new Set<string>();
    // Use allData if provided, otherwise fall back to current data
    (allData || data).forEach((row) => {
      const value = row[columnKey];
      if (value !== null && value !== undefined) {
        if (typeof value === 'object') {
          values.add(JSON.stringify(value));
        } else {
          values.add(String(value));
        }
      }
    });
    return Array.from(values).sort().slice(0, 100); // Limit to 100 unique values
  };

  const renderCellValue = (column: Column, value: any, row: any) => {
    if (column.render) {
      return column.render(value, row);
    }

    switch (column.type) {
      case "boolean":
        return (
          <Badge variant={value ? "default" : "secondary"}>
            {value ? "Yes" : "No"}
          </Badge>
        );
      case "date":
        return value ? new Date(value).toLocaleDateString() : "-";
      case "json":
        return (
          <code className="text-xs bg-muted px-2 py-1 rounded">
            {JSON.stringify(value, null, 2)}
          </code>
        );
      case "badge":
        return <Badge>{value}</Badge>;
      default:
        return value?.toString() || "-";
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {onAdd && (
            <Button onClick={onAdd} data-testid="button-add">
              <Plus className="w-4 h-4 mr-2" />
              New
            </Button>
          )}
          {onImport && (
            <Button variant="outline" onClick={onImport} data-testid="button-import">
              <Upload className="w-4 h-4 mr-2" />
              Import
            </Button>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {onSearchChange && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search..."
                value={searchValue || ""}
                onChange={(e) => onSearchChange(e.target.value)}
                className="pl-10 w-64"
                data-testid="input-search"
              />
            </div>
          )}
          {activeFilterCount > 0 && (
            <Button
              variant="outline"
              onClick={clearAllFilters}
              size="sm"
              data-testid="button-clear-filters"
            >
              <X className="w-4 h-4 mr-2" />
              Clear Filters ({activeFilterCount})
            </Button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" data-testid="button-columns">
                <Columns className="w-4 h-4 mr-2" />
                Columns
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {columns.map((column) => (
                <DropdownMenuCheckboxItem
                  key={column.key}
                  checked={columnVisibility[column.key]}
                  onCheckedChange={() => toggleColumnVisibility(column.key)}
                >
                  {column.label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {onExport && (
            <Button variant="outline" onClick={onExport} data-testid="button-export">
              <Download className="w-4 h-4" />
            </Button>
          )}
          {onRefresh && (
            <Button variant="outline" onClick={onRefresh} data-testid="button-refresh">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="border border-border rounded-xl overflow-auto">
        <Table style={{ minWidth: 'max-content' }}>
          <TableHeader>
            <TableRow>
              {visibleColumns.map((column) => (
                <TableHead
                  key={column.key}
                  style={{
                    width: columnWidths[column.key],
                    minWidth: column.minWidth || 80,
                    position: 'relative'
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate">{column.label}</span>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-6 w-6 p-0 ${columnFilters[column.key] ? 'text-primary' : 'text-muted-foreground'}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Filter className="w-3 h-3" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72" align="start">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">Filter {column.label}</span>
                            {columnFilters[column.key] && columnFilters[column.key].length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  const newFilters = { ...columnFilters };
                                  delete newFilters[column.key];
                                  if (onColumnFiltersChange) {
                                    onColumnFiltersChange(newFilters);
                                  } else {
                                    setInternalColumnFilters(newFilters);
                                  }
                                }}
                                className="h-6 px-2"
                              >
                                <X className="w-3 h-3" />
                              </Button>
                            )}
                          </div>
                          <div className="max-h-64 overflow-y-auto border rounded-md">
                            {getUniqueValues(column.key).length === 0 ? (
                              <div className="p-4 text-center text-sm text-muted-foreground">
                                No values available
                              </div>
                            ) : (
                              <div className="divide-y">
                                {getUniqueValues(column.key).map((value) => {
                                  const isChecked = columnFilters[column.key]?.includes(value) || false;
                                  return (
                                    <div
                                      key={value}
                                      className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                                      onClick={() => handleFilterToggle(column.key, value)}
                                    >
                                      <Checkbox
                                        checked={isChecked}
                                        onCheckedChange={() => handleFilterToggle(column.key, value)}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                      <div className="flex-1 truncate text-sm" title={value}>
                                        {value || "(empty)"}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                          {getUniqueValues(column.key).length > 100 && (
                            <p className="text-xs text-muted-foreground">
                              Showing first 100 values
                            </p>
                          )}
                        </div>
                      </PopoverContent>
                    </Popover>
                    <div
                      className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                      onMouseDown={(e) => handleResizeStart(column.key, e)}
                      style={{ userSelect: 'none' }}
                    />
                  </div>
                </TableHead>
              ))}
              {(onEdit || onDelete) && <TableHead className="w-12 sticky right-0 bg-background">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {visibleColumns.map((column) => (
                    <TableCell key={column.key}>
                      <div className="h-4 bg-muted rounded animate-pulse" />
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell>
                      <div className="h-4 w-8 bg-muted rounded animate-pulse" />
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + (onEdit || onDelete ? 1 : 0)} className="text-center py-8">
                  <div className="text-muted-foreground">
                    {data.length === 0 ? (
                      <>
                        <p>No data available</p>
                        {onAdd && (
                          <Button
                            variant="outline"
                            onClick={onAdd}
                            className="mt-2"
                            data-testid="button-add-empty"
                          >
                            <Plus className="w-4 h-4 mr-2" />
                            Add first item
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <p>No results match your filters</p>
                        <Button
                          variant="outline"
                          onClick={clearAllFilters}
                          className="mt-2"
                          size="sm"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Clear Filters
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row, index) => (
                <TableRow key={row.id || index} data-testid={`row-${index}`}>
                  {visibleColumns.map((column) => (
                    <TableCell
                      key={column.key}
                      data-testid={`cell-${column.key}-${index}`}
                      style={{
                        width: columnWidths[column.key],
                        minWidth: column.minWidth || 80,
                        maxWidth: columnWidths[column.key]
                      }}
                    >
                      <div className="truncate" title={String(row[column.key] || '')}>
                        {renderCellValue(column, row[column.key], row)}
                      </div>
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell className="sticky right-0 bg-background border-l">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`button-actions-${index}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {onEdit && (
                            <DropdownMenuItem onClick={() => onEdit(row)} data-testid={`button-edit-${index}`}>
                              Edit
                            </DropdownMenuItem>
                          )}
                          {onDelete && (
                            <DropdownMenuItem
                              onClick={() => onDelete(row)}
                              className="text-destructive"
                              data-testid={`button-delete-${index}`}
                            >
                              Delete
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
