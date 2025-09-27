import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileDropzoneProps {
  onDrop: (files: File[]) => void;
  accept?: Record<string, string[]>;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

export function FileDropzone({
  onDrop,
  accept = { "text/csv": [".csv"] },
  maxFiles = 1,
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  className,
}: FileDropzoneProps) {
  const onDropCallback = useCallback(
    (acceptedFiles: File[]) => {
      onDrop(acceptedFiles);
    },
    [onDrop]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop: onDropCallback,
    accept,
    maxFiles,
    maxSize,
    disabled,
  });

  const hasErrors = fileRejections.length > 0;

  return (
    <div
      {...getRootProps()}
      className={cn(
        "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors",
        isDragActive && !isDragReject && "border-primary bg-primary/5",
        isDragReject && "border-destructive bg-destructive/5",
        disabled && "cursor-not-allowed opacity-50",
        !isDragActive && !hasErrors && "border-border hover:border-primary",
        hasErrors && "border-destructive",
        className
      )}
      data-testid="file-dropzone"
    >
      <input {...getInputProps()} data-testid="file-input" />
      
      <div className="space-y-4">
        {isDragActive ? (
          <>
            <Upload className="w-12 h-12 mx-auto text-primary" />
            <div>
              <p className="text-lg font-medium text-primary">Drop files here</p>
              <p className="text-sm text-muted-foreground">Release to upload</p>
            </div>
          </>
        ) : (
          <>
            <FileText className="w-12 h-12 mx-auto text-muted-foreground" />
            <div>
              <p className="text-lg font-medium text-foreground">
                Drag & drop your CSV file here
              </p>
              <p className="text-sm text-muted-foreground">
                or click to browse files
              </p>
            </div>
            <div className="text-xs text-muted-foreground">
              <p>Supports: CSV files up to {Math.round(maxSize / 1024 / 1024)}MB</p>
              {maxFiles > 1 && <p>Maximum {maxFiles} files</p>}
            </div>
          </>
        )}

        {hasErrors && (
          <div className="space-y-2">
            <div className="flex items-center justify-center text-destructive">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm font-medium">Upload Error</span>
            </div>
            {fileRejections.map(({ file, errors }) => (
              <div key={file.name} className="text-xs text-destructive">
                <p className="font-medium">{file.name}</p>
                {errors.map((error) => (
                  <p key={error.code}>• {error.message}</p>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
