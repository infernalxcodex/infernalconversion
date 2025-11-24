import { useState, useEffect, useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, FileJson, Download, Copy, CheckCircle2, AlertCircle, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ConversionRequest, ConversionResult } from "@shared/schema";
import { PaymentGateModal } from "@/components/payment-gate-modal";
import { Progress } from "@/components/ui/progress";

export default function Converter() {
  const [jsonInput, setJsonInput] = useState("");
  const [outputFormat, setOutputFormat] = useState<"sql" | "csv">("sql");
  const [tableName, setTableName] = useState("converted_data");
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [showPaymentGate, setShowPaymentGate] = useState(false);
  const [inputMethod, setInputMethod] = useState<"paste" | "upload">("paste");
  const [isDragging, setIsDragging] = useState(false);
  const [isPaid, setIsPaid] = useState(false);
  const { toast } = useToast();

  // Check for payment success in URL params and persist session
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    const success = params.get('success');
    
    // Load persisted session from localStorage
    const savedSessionId = localStorage.getItem('stripe_session_id');
    if (savedSessionId) {
      setIsPaid(true);
    }
    
    if (success === 'true' && sessionId) {
      // Store session ID in localStorage for persistence
      localStorage.setItem('stripe_session_id', sessionId);
      setIsPaid(true);
      toast({
        title: "Payment successful!",
        description: "You now have unlimited access. Convert any size files.",
      });
      // Clean URL but keep session in localStorage
      window.history.replaceState({}, document.title, window.location.pathname);
    }
    
    if (params.get('canceled') === 'true') {
      toast({
        variant: "destructive",
        title: "Payment canceled",
        description: "Your payment was canceled. You can try again anytime.",
      });
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast]);

  const convertMutation = useMutation({
    mutationFn: async (data: ConversionRequest) => {
      // Include session_id from localStorage if paid
      const sessionId = localStorage.getItem('stripe_session_id');
      const requestData = sessionId ? { ...data, sessionId } : data;
      
      const response = await apiRequest("POST", '/api/convert', requestData);
      const result: ConversionResult = await response.json();
      return result;
    },
    onSuccess: (data) => {
      setConversionResult(data);
      if (data.requiresPayment) {
        setShowPaymentGate(true);
      } else {
        toast({
          title: "Conversion successful",
          description: `Converted ${data.lineCount} lines with ${data.nestingLevel} nesting levels.`,
        });
      }
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Conversion failed",
        description: error.message,
      });
    },
  });

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const file = files[0];
    if (!file.name.endsWith('.json')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a JSON file (.json)",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setJsonInput(content);
      toast({
        title: "File loaded",
        description: `${file.name} loaded successfully`,
      });
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File read error",
        description: "Failed to read the file",
      });
    };
    reader.readAsText(file);
  }, [toast]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast({
        variant: "destructive",
        title: "Invalid file type",
        description: "Please upload a JSON file (.json)",
      });
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      setJsonInput(content);
      toast({
        title: "File loaded",
        description: `${file.name} loaded successfully`,
      });
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: "File read error",
        description: "Failed to read the file",
      });
    };
    reader.readAsText(file);
  };

  const handleConvert = () => {
    if (!jsonInput.trim()) {
      toast({
        variant: "destructive",
        title: "Empty input",
        description: "Please provide JSON input to convert",
      });
      return;
    }

    try {
      JSON.parse(jsonInput);
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Invalid JSON",
        description: "Please provide valid JSON input",
      });
      return;
    }

    convertMutation.mutate({
      jsonInput,
      outputFormat,
      tableName: outputFormat === "sql" ? tableName : undefined,
    });
  };

  const handleDownload = () => {
    if (!conversionResult) return;

    const extension = outputFormat === "sql" ? "sql" : "csv";
    const filename = `converted_${new Date().toISOString().split('T')[0]}.${extension}`;
    const blob = new Blob([conversionResult.output], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Download started",
      description: `Downloading ${filename}`,
    });
  };

  const handleCopy = async () => {
    if (!conversionResult) return;

    try {
      await navigator.clipboard.writeText(conversionResult.output);
      toast({
        title: "Copied to clipboard",
        description: "Output has been copied to your clipboard",
      });
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Copy failed",
        description: "Failed to copy to clipboard",
      });
    }
  };

  const lineCount = jsonInput ? jsonInput.split('\n').length : 0;
  const recordCount = conversionResult?.lineCount || 0;
  const displayCount = conversionResult ? recordCount : lineCount;
  const isOverLimit = recordCount > 50 && !isPaid;
  const usagePercent = Math.min((displayCount / 50) * 100, 100);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <FileJson className="w-6 h-6 text-primary" />
            <h1 className="text-xl sm:text-2xl font-semibold text-foreground">Infernal Code: JSON -> SQL|CSV Conversion </h1>
          </div>
          <div className="flex items-center gap-3">
            {isPaid && (
              <Badge variant="default" className="gap-1.5">
                <Shield className="w-3 h-3" />
                Pro Access
              </Badge>
            )}
            {isOverLimit && (
              <Button
                onClick={() => setShowPaymentGate(true)}
                variant="default"
                size="sm"
                data-testid="button-upgrade"
              >
                Upgrade
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6" data-testid="card-input-panel">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-foreground">Input</h2>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={isOverLimit ? "destructive" : "secondary"}
                    data-testid="badge-line-count"
                    className="font-mono text-xs"
                  >
                    {displayCount}/50 lines
                  </Badge>
                  {!isOverLimit && !isPaid && displayCount > 0 && (
                    <Badge variant="secondary">Free tier</Badge>
                  )}
                </div>
              </div>

              {!isPaid && displayCount > 40 && displayCount <= 50 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>Free tier usage</span>
                    <span>{displayCount}/50</span>
                  </div>
                  <Progress value={usagePercent} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {50 - displayCount} lines remaining
                  </p>
                </div>
              )}

              <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as "paste" | "upload")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="paste" data-testid="tab-paste">Paste JSON</TabsTrigger>
                  <TabsTrigger value="upload" data-testid="tab-upload">Upload File</TabsTrigger>
                </TabsList>
                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    placeholder='Paste your JSON here...&#10;&#10;Example:&#10;{&#10;  "users": [&#10;    {"id": 1, "name": "John", "address": {"city": "NYC"}}&#10;  ]&#10;}'
                    value={jsonInput}
                    onChange={(e) => setJsonInput(e.target.value)}
                    className="min-h-96 font-mono text-sm resize-none"
                    data-testid="input-json-paste"
                  />
                </TabsContent>
                <TabsContent value="upload" className="mt-4">
                  <div
                    onDragEnter={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    className={`flex flex-col items-center justify-center min-h-96 border-2 border-dashed rounded-lg transition-all cursor-pointer hover-elevate ${
                      isDragging
                        ? 'border-primary bg-primary/5'
                        : 'border-border'
                    }`}
                    data-testid="zone-file-upload"
                    onClick={() => document.getElementById('file-upload')?.click()}
                  >
                    <Upload className={`w-12 h-12 mb-4 transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                    <p className="text-base font-medium text-foreground mb-2">
                      {isDragging ? 'Drop file here' : 'Drop JSON file here or click to browse'}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Supports .json files
                    </p>
                    <input
                      id="file-upload"
                      type="file"
                      accept=".json"
                      onChange={handleFileUpload}
                      className="hidden"
                      data-testid="input-file-upload"
                    />
                  </div>
                  {jsonInput && (
                    <div className="mt-4 p-4 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground mb-2">File loaded:</p>
                      <p className="text-sm font-mono text-foreground truncate">
                        {jsonInput.substring(0, 100)}...
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>

              {outputFormat === "sql" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Table Name (optional)
                  </label>
                  <input
                    type="text"
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="converted_data"
                    className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground text-sm font-mono"
                    data-testid="input-table-name"
                  />
                </div>
              )}

              <Button
                onClick={handleConvert}
                disabled={convertMutation.isPending || !jsonInput.trim()}
                className="w-full"
                size="lg"
                data-testid="button-convert"
              >
                {convertMutation.isPending ? (
                  <>Converting...</>
                ) : (
                  <>Convert to {outputFormat.toUpperCase()}</>
                )}
              </Button>
            </div>
          </Card>

          <Card className="p-6" data-testid="card-output-panel">
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h2 className="text-lg font-semibold text-foreground">Output</h2>
                <Tabs value={outputFormat} onValueChange={(v) => setOutputFormat(v as "sql" | "csv")}>
                  <TabsList>
                    <TabsTrigger value="sql" data-testid="tab-format-sql">SQL</TabsTrigger>
                    <TabsTrigger value="csv" data-testid="tab-format-csv">CSV</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              {conversionResult && !conversionResult.requiresPayment ? (
                <>
                  <div className="relative">
                    <pre className="min-h-96 max-h-96 overflow-auto p-4 bg-muted rounded-lg border border-border">
                      <code className="font-mono text-sm text-foreground" data-testid="text-output-preview">
                        {conversionResult.output}
                      </code>
                    </pre>
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Button
                      onClick={handleDownload}
                      className="flex-1"
                      data-testid="button-download"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Download {outputFormat.toUpperCase()}
                    </Button>
                    <Button
                      onClick={handleCopy}
                      variant="outline"
                      data-testid="button-copy"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground pt-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>{conversionResult.lineCount} lines</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      <span>{conversionResult.nestingLevel} levels deep</span>
                    </div>
                  </div>
                </>
              ) : conversionResult?.requiresPayment ? (
                <div className="min-h-96 flex flex-col items-center justify-center text-center p-8">
                  <AlertCircle className="w-16 h-16 text-primary mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Upgrade Required
                  </h3>
                  <p className="text-muted-foreground mb-6 max-w-md">
                    Your JSON has {conversionResult.lineCount} lines. The free tier supports up to 50 lines.
                    Upgrade to convert larger files.
                  </p>
                  <Button
                    onClick={() => setShowPaymentGate(true)}
                    size="lg"
                    data-testid="button-upgrade-large"
                  >
                    View Pricing
                  </Button>
                </div>
              ) : (
                <div className="min-h-96 flex items-center justify-center text-center p-8">
                  <div>
                    <FileJson className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Your converted output will appear here
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {convertMutation.isPending && (
          <div className="mt-6">
            <Card className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground mb-2">
                    Parsing and converting your JSON...
                  </p>
                  <Progress value={66} className="h-2" />
                  <p className="text-xs text-muted-foreground mt-2">
                    Processing nested objects and generating {outputFormat.toUpperCase()} output
                  </p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </main>

      <PaymentGateModal
        open={showPaymentGate}
        onOpenChange={setShowPaymentGate}
        lineCount={recordCount || lineCount}
      />
    </div>
  );
}
