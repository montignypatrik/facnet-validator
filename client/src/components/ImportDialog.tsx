import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Upload, AlertCircle, CheckCircle } from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tableName: string;
  onImport?: (data: {
    file: File;
    dryRun: boolean;
    conflictStrategy: string;
    autoCreateFields: boolean;
  }) => Promise<any>;
}

export function ImportDialog({ open, onOpenChange, tableName, onImport }: ImportDialogProps) {
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [conflictStrategy, setConflictStrategy] = useState("update");
  const [autoCreateFields, setAutoCreateFields] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handlePreview = async () => {
    if (!file || !onImport) return;

    try {
      setImporting(true);
      const result = await onImport({
        file,
        dryRun: true,
        conflictStrategy,
        autoCreateFields,
      });
      setPreviewData(result);
      setStep("preview");
    } catch (error) {
      console.error("Preview error:", error);
    } finally {
      setImporting(false);
    }
  };

  const handleImport = async () => {
    if (!file || !onImport) return;

    try {
      setStep("importing");
      setProgress(0);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      await onImport({
        file,
        dryRun: false,
        conflictStrategy,
        autoCreateFields,
      });

      clearInterval(progressInterval);
      setProgress(100);
      setStep("complete");
    } catch (error) {
      console.error("Import error:", error);
    }
  };

  const handleClose = () => {
    setStep("upload");
    setFile(null);
    setPreviewData(null);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl" data-testid="dialog-import">
        <DialogHeader>
          <DialogTitle>Import {tableName}</DialogTitle>
          <DialogDescription>
            Upload and import data from a CSV file
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="space-y-6">
            <div>
              <Label htmlFor="file">CSV File</Label>
              <Input
                id="file"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-2"
                data-testid="input-file"
              />
              {file && (
                <p className="text-sm text-muted-foreground mt-2">
                  Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </p>
              )}
            </div>

            <div>
              <Label>Conflict Strategy</Label>
              <Select value={conflictStrategy} onValueChange={setConflictStrategy}>
                <SelectTrigger className="mt-2" data-testid="select-conflict-strategy">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="update">Update existing records</SelectItem>
                  <SelectItem value="skip">Skip existing records</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="autoCreateFields"
                checked={autoCreateFields}
                onCheckedChange={(checked) => setAutoCreateFields(checked as boolean)}
                data-testid="checkbox-auto-create-fields"
              />
              <Label htmlFor="autoCreateFields">
                Auto-create fields for unknown headers
              </Label>
            </div>
          </div>
        )}

        {step === "preview" && previewData && (
          <div className="space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{previewData.create || 0}</div>
                <div className="text-sm text-muted-foreground">Create</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{previewData.update || 0}</div>
                <div className="text-sm text-muted-foreground">Update</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-600">{previewData.skip || 0}</div>
                <div className="text-sm text-muted-foreground">Skip</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{previewData.errors?.length || 0}</div>
                <div className="text-sm text-muted-foreground">Errors</div>
              </div>
            </div>

            {previewData.unknownHeaders?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Unknown Headers</h4>
                <div className="flex flex-wrap gap-2">
                  {previewData.unknownHeaders.map((header: string, index: number) => (
                    <Badge key={index} variant="outline">
                      {header}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {previewData.errors?.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 text-red-600">Errors</h4>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {previewData.errors.map((error: string, index: number) => (
                    <div key={index} className="text-sm text-red-600 flex items-center">
                      <AlertCircle className="w-4 h-4 mr-2" />
                      {error}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-6">
            <div className="text-center">
              <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h3 className="text-lg font-medium">Importing data...</h3>
            </div>
            <Progress value={progress} className="w-full" />
            <p className="text-center text-sm text-muted-foreground">
              {progress}% complete
            </p>
          </div>
        )}

        {step === "complete" && (
          <div className="space-y-6 text-center">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
            <h3 className="text-lg font-medium">Import completed successfully!</h3>
            <p className="text-muted-foreground">
              Your data has been imported and is now available in the {tableName} table.
            </p>
          </div>
        )}

        <DialogFooter>
          {step === "upload" && (
            <>
              <Button variant="outline" onClick={handleClose} data-testid="button-cancel">
                Cancel
              </Button>
              <Button 
                onClick={handlePreview} 
                disabled={!file || importing}
                data-testid="button-preview"
              >
                {importing ? "Loading..." : "Preview"}
              </Button>
            </>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={() => setStep("upload")} data-testid="button-back">
                Back
              </Button>
              <Button onClick={handleImport} data-testid="button-import">
                Import Data
              </Button>
            </>
          )}

          {step === "complete" && (
            <Button onClick={handleClose} data-testid="button-close">
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
