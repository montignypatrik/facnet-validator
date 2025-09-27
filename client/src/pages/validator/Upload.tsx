import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FileDropzone } from "@/components/FileDropzone";
import { Upload, CheckCircle, AlertCircle, Eye } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import client from "@/api/client";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [validationId, setValidationId] = useState<string | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      // Upload file
      const fileResponse = await client.post("/files", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const progress = progressEvent.total 
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(progress);
        },
      });

      // Create validation run
      const validationResponse = await client.post("/validations", {
        fileId: fileResponse.data.fileId,
      });

      return {
        fileId: fileResponse.data.fileId,
        validationId: validationResponse.data.validationId,
      };
    },
    onSuccess: (data) => {
      setValidationId(data.validationId);
      toast({
        title: "Success!",
        description: "File uploaded and validation started",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.response?.data?.error || "An error occurred",
        variant: "destructive",
      });
    },
  });

  const handleFileDrop = (droppedFiles: File[]) => {
    setFiles(droppedFiles);
    setUploadProgress(0);
    setValidationId(null);
  };

  const handleUpload = () => {
    if (files.length > 0) {
      uploadMutation.mutate(files[0]);
    }
  };

  const handleViewRun = () => {
    if (validationId) {
      setLocation(`/validator/runs/${validationId}`);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Page Header */}
      <header className="bg-card border-b border-border p-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="text-page-title">
            Upload & Validate
          </h1>
          <p className="text-muted-foreground">
            Upload your CSV files for data validation and processing
          </p>
        </div>
      </header>

      {/* Upload Content */}
      <div className="flex-1 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Upload Area */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                File Upload
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!uploadMutation.isPending && !validationId && (
                <FileDropzone
                  onDrop={handleFileDrop}
                  accept={{ "text/csv": [".csv"] }}
                  maxFiles={1}
                  data-testid="file-dropzone"
                />
              )}

              {files.length > 0 && !uploadMutation.isPending && !validationId && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div>
                      <p className="font-medium" data-testid="text-selected-file">
                        {files[0].name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(files[0].size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <Button onClick={handleUpload} data-testid="button-upload">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload & Validate
                    </Button>
                  </div>
                </div>
              )}

              {uploadMutation.isPending && (
                <div className="space-y-4">
                  <div className="text-center">
                    <Upload className="w-12 h-12 mx-auto mb-4 text-primary" />
                    <h3 className="text-lg font-medium">Uploading file...</h3>
                    <p className="text-muted-foreground">Please wait while we process your file</p>
                  </div>
                  <Progress value={uploadProgress} className="w-full" />
                  <p className="text-center text-sm text-muted-foreground">
                    {uploadProgress}% complete
                  </p>
                </div>
              )}

              {validationId && (
                <div className="text-center space-y-4">
                  <CheckCircle className="w-12 h-12 mx-auto text-green-600" />
                  <div>
                    <h3 className="text-lg font-medium text-green-600">Upload Successful!</h3>
                    <p className="text-muted-foreground">
                      Your file has been uploaded and validation has started
                    </p>
                  </div>
                  <Button onClick={handleViewRun} data-testid="button-view-run">
                    <Eye className="w-4 h-4 mr-2" />
                    View Validation Run
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Guidelines */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Guidelines</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Please ensure your CSV files follow the expected format for optimal validation results.
                </AlertDescription>
              </Alert>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium mb-2">Supported File Types</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• CSV files (.csv)</li>
                    <li>• UTF-8 encoding recommended</li>
                    <li>• Maximum file size: 50MB</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">File Format Requirements</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Header row required</li>
                    <li>• Comma or semicolon delimited</li>
                    <li>• Consistent column structure</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Validation Features</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Data type validation</li>
                    <li>• Business rule enforcement</li>
                    <li>• Duplicate detection</li>
                    <li>• Format consistency checks</li>
                  </ul>
                </div>

                <div>
                  <h4 className="font-medium mb-2">After Upload</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Real-time validation progress</li>
                    <li>• Detailed error reporting</li>
                    <li>• Data quality metrics</li>
                    <li>• Export validated data</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
