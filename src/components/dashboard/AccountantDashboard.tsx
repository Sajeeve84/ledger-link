import { useEffect, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "./DashboardLayout";
import FirmNotificationsPage from "./firm/FirmNotificationsPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { documentsApi, notificationsApi, clientsApi } from "@/lib/api";
import {
  LayoutDashboard,
  FileText,
  Bell,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  Eye,
  Download,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents" },
  { icon: Bell, label: "Notifications", href: "/dashboard/notifications" },
];

type DocumentStatus = "pending" | "posted" | "clarification_needed" | "resend_requested";

interface Document {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string | null;
  status: DocumentStatus;
  notes: string | null;
  uploaded_at: string;
  client_id: string;
  company_name: string | null;
  client_name: string | null;
  client_email: string;
  client_user_id: string;
}

export default function AccountantDashboard() {
  const { user } = useAuth();
  const location = useLocation();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [notes, setNotes] = useState("");
  const [actionDialogOpen, setActionDialogOpen] = useState(false);
  const [actionType, setActionType] = useState<DocumentStatus>("posted");
  const [loading, setLoading] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const fetchDocuments = useCallback(async () => {
    if (!user) return;

    try {
      // Get documents for clients assigned to this accountant via PHP API
      const response = await documentsApi.getAssigned();
      
      if (response.error) {
        console.error("Error fetching documents:", response.error);
        return;
      }
      
      if (response.data) {
        setDocuments(response.data as Document[]);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchDocuments();
      
      // Set up polling for updates (since we're using PHP backend)
      const interval = setInterval(fetchDocuments, 30000);
      return () => clearInterval(interval);
    }
  }, [user, fetchDocuments]);

  const handleAction = async () => {
    if (!selectedDoc) return;

    setLoading(true);

    try {
      // Update document status via PHP API
      const response = await documentsApi.update(selectedDoc.id, {
        status: actionType,
        notes,
      });

      if (response.error) throw new Error(response.error);

      // Create notification for client via PHP API
      const statusMessages: Record<DocumentStatus, string> = {
        posted: "Your document has been posted successfully",
        clarification_needed: `Clarification needed for ${selectedDoc.file_name}: ${notes}`,
        resend_requested: `Please resend ${selectedDoc.file_name}: ${notes}`,
        pending: "Document status updated",
      };

      await notificationsApi.create({
        user_id: selectedDoc.client_user_id,
        title: `Document ${actionType.replace("_", " ")}`,
        message: statusMessages[actionType],
        document_id: selectedDoc.id,
      });

      toast({
        title: "Success",
        description: `Document marked as ${actionType.replace("_", " ")}`,
      });

      setActionDialogOpen(false);
      setSelectedDoc(null);
      setNotes("");
      fetchDocuments();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update document status",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: DocumentStatus) => {
    const styles: Record<DocumentStatus, string> = {
      pending: "bg-warning/10 text-warning border-warning/20",
      posted: "bg-success/10 text-success border-success/20",
      clarification_needed: "bg-destructive/10 text-destructive border-destructive/20",
      resend_requested: "bg-accent/10 text-accent border-accent/20",
    };

    const labels: Record<DocumentStatus, string> = {
      pending: "Pending",
      posted: "Posted",
      clarification_needed: "Needs Clarification",
      resend_requested: "Resend Requested",
    };

    return (
      <Badge variant="outline" className={styles[status]}>
        {labels[status]}
      </Badge>
    );
  };

  const openActionDialog = (doc: Document, type: DocumentStatus) => {
    setSelectedDoc(doc);
    setActionType(type);
    setNotes(doc.notes || "");
    setActionDialogOpen(true);
  };

  const handlePreview = async (doc: Document) => {
    setSelectedDoc(doc);
    setPreviewLoading(true);
    setPreviewDialogOpen(true);

    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.file_path, 3600);

      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error: any) {
      toast({
        title: "Preview failed",
        description: error.message,
        variant: "destructive",
      });
      setPreviewDialogOpen(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleDownload = async (doc: Document) => {
    try {
      const { data, error } = await supabase.storage
        .from("documents")
        .download(doc.file_path);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      toast({
        title: "Download failed",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const pendingDocs = documents.filter((d) => d.status === "pending");
  const processedDocs = documents.filter((d) => d.status !== "pending");
  
  const currentPath = location.pathname;

  // Show notifications page
  if (currentPath === "/dashboard/notifications") {
    return (
      <DashboardLayout navItems={navItems} title="Accountant">
        <FirmNotificationsPage />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout navItems={navItems} title="Accountant">
      <div className="space-y-8 animate-fade-in">
        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Review</p>
                  <p className="text-3xl font-bold text-foreground">{pendingDocs.length}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Clock className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Posted</p>
                  <p className="text-3xl font-bold text-foreground">
                    {documents.filter((d) => d.status === "posted").length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Need Action</p>
                  <p className="text-3xl font-bold text-foreground">
                    {documents.filter((d) =>
                      ["clarification_needed", "resend_requested"].includes(d.status)
                    ).length}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Pending Documents */}
        <Card className="shadow-md border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <Clock className="w-5 h-5 text-warning" />
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            {pendingDocs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>All caught up! No pending documents to review.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {pendingDocs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <FileText className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{doc.file_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {doc.client_name || doc.company_name || "Unknown client"} •{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(doc.status)}
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(doc)}
                        title="View document"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openActionDialog(doc, "posted")}
                        title="Mark as posted"
                      >
                        <CheckCircle className="w-4 h-4 text-success" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openActionDialog(doc, "clarification_needed")}
                        title="Request clarification"
                      >
                        <AlertTriangle className="w-4 h-4 text-warning" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => openActionDialog(doc, "resend_requested")}
                        title="Request resend"
                      >
                        <RotateCcw className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* All Documents */}
        <Card className="shadow-md border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">All Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents yet. Documents will appear here when clients upload them.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-secondary/30 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-foreground">{doc.file_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.client_name || doc.company_name} •{" "}
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(doc)}
                        title="View document"
                      >
                        <Eye className="w-4 h-4 text-primary" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDownload(doc)}
                        title="Download"
                      >
                        <Download className="w-4 h-4 text-muted-foreground" />
                      </Button>
                      {getStatusBadge(doc.status)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Action Dialog */}
      <Dialog open={actionDialogOpen} onOpenChange={setActionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="capitalize">
              {actionType.replace("_", " ")} Document
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <p className="text-muted-foreground">
              {selectedDoc?.file_name}
            </p>
            {actionType !== "posted" && (
              <div className="space-y-2">
                <Label>Notes for client</Label>
                <Textarea
                  placeholder="Add a note explaining what's needed..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={4}
                />
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setActionDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant={actionType === "posted" ? "accent" : "default"}
                className="flex-1"
                onClick={handleAction}
                disabled={loading}
              >
                {loading ? "Updating..." : "Confirm"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={previewDialogOpen} onOpenChange={(open) => {
        setPreviewDialogOpen(open);
        if (!open) {
          setPreviewUrl(null);
          setSelectedDoc(null);
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="truncate pr-4">{selectedDoc?.file_name}</span>
              <div className="flex items-center gap-2">
                {selectedDoc && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(selectedDoc)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4 flex items-center justify-center min-h-[400px] bg-muted/30 rounded-lg overflow-hidden">
            {previewLoading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading preview...</p>
              </div>
            ) : previewUrl ? (
              selectedDoc?.file_type?.includes("pdf") ? (
                <iframe
                  src={previewUrl}
                  className="w-full h-[70vh] border-0"
                  title="Document Preview"
                />
              ) : (
                <img
                  src={previewUrl}
                  alt={selectedDoc?.file_name}
                  className="max-w-full max-h-[70vh] object-contain"
                />
              )
            ) : (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <FileText className="w-12 h-12 opacity-50" />
                <p>Unable to load preview</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
