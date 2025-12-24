import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { API_BASE_URL } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  FileText,
  Search,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Download,
  Eye,
  Calendar,
  User,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { documentsApi } from "@/lib/api";

type DocumentStatus = "pending" | "posted" | "clarification_needed" | "resend_requested";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  file_size: number | null;
  status: DocumentStatus;
  notes: string | null;
  uploaded_at: string;
  client_id: string;
  company_name?: string | null;
  client_name?: string | null;
  client_email?: string;
  client_user_id?: string;
}

interface Client {
  id: string;
  user_id: string;
  company_name: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

interface FirmDocumentsPageProps {
  firmId: string;
  clients: Client[];
}

export default function FirmDocumentsPage({ firmId, clients }: FirmDocumentsPageProps) {
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, [firmId]);

  const fetchDocuments = async () => {
    if (!firmId) {
      setLoading(false);
      return;
    }

    try {
      const response = await documentsApi.getByFirm(firmId);
      
      if (response.error) {
        console.error("Error fetching documents:", response.error);
        setLoading(false);
        return;
      }
      
      if (response.data) {
        setDocuments(response.data as Document[]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
    setLoading(false);
  };

  const getStatusInfo = (status: DocumentStatus) => {
    const statusMap = {
      pending: { icon: Clock, label: "Pending", color: "bg-warning/10 text-warning border-warning/20" },
      posted: { icon: CheckCircle, label: "Posted", color: "bg-success/10 text-success border-success/20" },
      clarification_needed: { icon: AlertTriangle, label: "Needs Clarification", color: "bg-destructive/10 text-destructive border-destructive/20" },
      resend_requested: { icon: RotateCcw, label: "Resend Requested", color: "bg-accent/10 text-accent border-accent/20" },
    };
    return statusMap[status];
  };

  const getClientName = (doc: Document) => {
    // First try to use embedded client info from PHP API
    if (doc.client_name) return doc.client_name;
    if (doc.company_name) return doc.company_name;
    if (doc.client_email) return doc.client_email;
    
    // Fallback to clients prop lookup
    const client = clients.find((c) => c.id === doc.client_id);
    return client?.profiles?.full_name || client?.company_name || client?.profiles?.email || "Unknown";
  };

  const getFileUrl = useCallback((filePath: string) => {
    if (!filePath) return "";
    if (/^https?:\/\//i.test(filePath)) return filePath;
    const origin = API_BASE_URL.replace(/\/api\/?$/, "");
    return `${origin}/${filePath.replace(/^\//, "")}`;
  }, []);

  const handlePreview = (doc: Document) => {
    setPreviewDoc(doc);
    setLoadingPreview(true);

    const url = getFileUrl(doc.file_path);
    if (!url) {
      toast({
        title: "Error",
        description: "Missing file path.",
        variant: "destructive",
      });
      setLoadingPreview(false);
      return;
    }

    setPreviewUrl(url);
    setLoadingPreview(false);
  };

  const handleDownload = (doc: Document) => {
    const url = getFileUrl(doc.file_path);
    if (!url) {
      toast({
        title: "Download failed",
        description: "Missing file path.",
        variant: "destructive",
      });
      return;
    }

    const a = document.createElement("a");
    a.href = url;
    a.download = doc.file_name;
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "Unknown size";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.file_name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || doc.status === statusFilter;
    const matchesClient = clientFilter === "all" || doc.client_id === clientFilter;
    return matchesSearch && matchesStatus && matchesClient;
  });

  const stats = {
    total: documents.length,
    pending: documents.filter((d) => d.status === "pending").length,
    posted: documents.filter((d) => d.status === "posted").length,
    action: documents.filter((d) => ["clarification_needed", "resend_requested"].includes(d.status)).length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Documents</h2>
          <p className="text-muted-foreground">{stats.total} total documents</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-foreground">{stats.total}</p>
            <p className="text-sm text-muted-foreground">Total</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-warning">{stats.pending}</p>
            <p className="text-sm text-muted-foreground">Pending</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-success">{stats.posted}</p>
            <p className="text-sm text-muted-foreground">Posted</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-border/50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-destructive">{stats.action}</p>
            <p className="text-sm text-muted-foreground">Need Action</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-md border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="posted">Posted</SelectItem>
                <SelectItem value="clarification_needed">Needs Clarification</SelectItem>
                <SelectItem value="resend_requested">Resend Requested</SelectItem>
              </SelectContent>
            </Select>
            <Select value={clientFilter} onValueChange={setClientFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Client" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>
                    {client.profiles?.full_name || client.company_name || client.profiles?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Documents List */}
      <Card className="shadow-md border-border/50">
        <CardContent className="p-0">
          {filteredDocuments.length === 0 ? (
            <div className="py-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "No documents yet. Documents will appear when clients upload them."
                  : "No documents match your filters."}
              </p>
            </div>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="divide-y divide-border">
                {filteredDocuments.map((doc) => {
                  const status = getStatusInfo(doc.status);
                  const StatusIcon = status.icon;

                  return (
                    <div
                      key={doc.id}
                      className="p-4 hover:bg-secondary/30 transition-colors flex items-center gap-4"
                    >
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-foreground truncate">{doc.file_name}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            {getClientName(doc)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(doc.uploaded_at).toLocaleDateString()}
                          </span>
                          <span>{formatFileSize(doc.file_size)}</span>
                        </div>
                      </div>
                      <Badge variant="outline" className={status.color}>
                        <StatusIcon className="w-3 h-3 mr-1" />
                        {status.label}
                      </Badge>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => handlePreview(doc)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleDownload(doc)}>
                          <Download className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={!!previewDoc} onOpenChange={() => { setPreviewDoc(null); setPreviewUrl(null); }}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>{previewDoc?.file_name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden rounded-lg bg-secondary/30">
            {loadingPreview ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            ) : previewUrl ? (
              previewDoc?.file_type?.includes("image") ? (
                <img src={previewUrl} alt={previewDoc?.file_name} className="w-full h-full object-contain" />
              ) : previewDoc?.file_type?.includes("pdf") ? (
                <iframe src={previewUrl} className="w-full h-full" title={previewDoc?.file_name} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <FileText className="w-16 h-16 text-muted-foreground" />
                  <p className="text-muted-foreground">Preview not available for this file type</p>
                  <Button variant="accent" onClick={() => previewDoc && handleDownload(previewDoc)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )
            ) : null}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
