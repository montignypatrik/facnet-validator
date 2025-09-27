import { useState } from "react";
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
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Search, MoreHorizontal, Plus, Upload, Download, RefreshCw } from "lucide-react";

interface Column {
  key: string;
  label: string;
  type?: "text" | "boolean" | "date" | "json" | "badge";
  render?: (value: any, row: any) => React.ReactNode;
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
}: DataTableProps) {
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
      <div className="border border-border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
              {(onEdit || onDelete) && <TableHead className="w-12">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, index) => (
                <TableRow key={index}>
                  {columns.map((column) => (
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
            ) : data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onEdit || onDelete ? 1 : 0)} className="text-center py-8">
                  <div className="text-muted-foreground">
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
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <TableRow key={row.id || index} data-testid={`row-${index}`}>
                  {columns.map((column) => (
                    <TableCell key={column.key} data-testid={`cell-${column.key}-${index}`}>
                      {renderCellValue(column, row[column.key], row)}
                    </TableCell>
                  ))}
                  {(onEdit || onDelete) && (
                    <TableCell>
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
