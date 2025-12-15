import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCamera } from "@/hooks/useCamera";
import DashboardLayout from "./DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  FileText,
  Bell,
  Upload,
  Camera,
  Image,
  File,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: FileText, label: "My Documents", href: "/dashboard/documents" },
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
}

interface Notification {
  id: string;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isNative, takePhoto, pickFromGallery } = useCamera();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Convert base64 to File object for native camera results
  const base64ToFile = (base64: string, fileName: string, mimeType: string): File => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });
    return new File([blob], fileName, { type: mimeType });
  };

  // Handle native camera capture
  const handleNativeCamera = async () => {
    try {
      const image = await takePhoto();
      if (image?.base64String) {
        const fileName = `photo_${Date.now()}.${image.format || 'jpeg'}`;
        const mimeType = `image/${image.format || 'jpeg'}`;
        const file = base64ToFile(image.base64String, fileName, mimeType);
        
        setSelectedFiles((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, `data:${mimeType};base64,${image.base64String}`]);
        
        toast({
          title: "Photo captured",
          description: "Your photo is ready to upload",
        });
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        toast({
          title: "Camera error",
          description: error.message || "Failed to capture photo",
          variant: "destructive",
        });
      }
    }
  };

  // Handle native gallery picker
  const handleNativeGallery = async () => {
    try {
      const image = await pickFromGallery();
      if (image?.base64String) {
        const fileName = `image_${Date.now()}.${image.format || 'jpeg'}`;
        const mimeType = `image/${image.format || 'jpeg'}`;
        const file = base64ToFile(image.base64String, fileName, mimeType);
        
        setSelectedFiles((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, `data:${mimeType};base64,${image.base64String}`]);
      }
    } catch (error: any) {
      if (error.message !== 'User cancelled photos app') {
        toast({
          title: "Gallery error",
          description: error.message || "Failed to select image",
          variant: "destructive",
        });
      }
    }
  };

  // Handle camera button click - use native or web fallback
  const handleCameraClick = () => {
    if (isNative) {
      handleNativeCamera();
    } else {
      cameraInputRef.current?.click();
    }
  };

  // Handle gallery button click - use native or web fallback
  const handleGalleryClick = () => {
    if (isNative) {
      handleNativeGallery();
    } else {
      fileInputRef.current?.click();
    }
  };

  useEffect(() => {
    if (user) {
      fetchClientData();
      subscribeToNotifications();
    }
  }, [user]);

  const fetchClientData = async () => {
    if (!user) return;

    // Get client record
    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (client) {
      setClientId(client.id);

      // Fetch documents
      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", client.id)
        .order("uploaded_at", { ascending: false });

      if (docs) {
        setDocuments(docs as Document[]);
      }
    }

    // Fetch notifications
    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10);

    if (notifs) {
      setNotifications(notifs as Notification[]);
    }
  };

  const subscribeToNotifications = () => {
    if (!user) return;

    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev]);
          toast({
            title: newNotif.title,
            description: newNotif.message,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter((f) => {
      const isValid = f.type.startsWith("image/") || f.type === "application/pdf";
      if (!isValid) {
        toast({
          title: "Invalid file type",
          description: `${f.name} is not supported. Please upload images or PDFs.`,
          variant: "destructive",
        });
      }
      return isValid;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);

    // Generate previews for images
    validFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) => [...prev, e.target?.result as string]);
        };
        reader.readAsDataURL(file);
      } else {
        setPreviews((prev) => [...prev, "pdf"]);
      }
    });
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (!clientId || selectedFiles.length === 0) return;

    setUploading(true);

    try {
      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        // Upload to storage
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

        // Create document record
        const { error: docError } = await supabase.from("documents").insert({
          client_id: clientId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          status: "pending",
        });

        if (docError) throw docError;
      }

      toast({
        title: "Success!",
        description: `${selectedFiles.length} document(s) uploaded successfully`,
      });

      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setPreviews([]);
      fetchClientData();
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const getStatusIcon = (status: DocumentStatus) => {
    const icons: Record<DocumentStatus, JSX.Element> = {
      pending: <Clock className="w-4 h-4 text-warning" />,
      posted: <CheckCircle className="w-4 h-4 text-success" />,
      clarification_needed: <AlertTriangle className="w-4 h-4 text-destructive" />,
      resend_requested: <RotateCcw className="w-4 h-4 text-accent" />,
    };
    return icons[status];
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
        {getStatusIcon(status)}
        <span className="ml-1">{labels[status]}</span>
      </Badge>
    );
  };

  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const postedCount = documents.filter((d) => d.status === "posted").length;
  const actionNeeded = documents.filter((d) =>
    ["clarification_needed", "resend_requested"].includes(d.status)
  ).length;

  return (
    <DashboardLayout navItems={navItems} title="Client">
      <div className="space-y-8 animate-fade-in">
        {/* Upload CTA */}
        <Card className="shadow-lg border-accent/20 bg-gradient-to-br from-accent/5 to-transparent">
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-foreground mb-1">
                  Upload Your Documents
                </h2>
                <p className="text-muted-foreground">
                  Snap a photo or upload invoices and receipts for your accountant
                </p>
              </div>
              <Button variant="accent" size="lg" onClick={() => setUploadDialogOpen(true)}>
                <Upload className="w-5 h-5 mr-2" />
                Upload Now
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending</p>
                  <p className="text-3xl font-bold text-foreground">{pendingCount}</p>
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
                  <p className="text-3xl font-bold text-foreground">{postedCount}</p>
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
                  <p className="text-sm text-muted-foreground">Action Needed</p>
                  <p className="text-3xl font-bold text-foreground">{actionNeeded}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-destructive" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Notifications */}
        {notifications.length > 0 && (
          <Card className="shadow-md border-border/50">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" />
                Recent Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-3 rounded-lg border ${
                      notif.is_read ? "bg-background border-border/50" : "bg-accent/5 border-accent/20"
                    }`}
                  >
                    <p className="font-medium text-foreground">{notif.title}</p>
                    <p className="text-sm text-muted-foreground">{notif.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Documents */}
        <Card className="shadow-md border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">My Documents</CardTitle>
          </CardHeader>
          <CardContent>
            {documents.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <FileText className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No documents yet. Upload your first document to get started!</p>
                <Button
                  variant="accent"
                  className="mt-4"
                  onClick={() => setUploadDialogOpen(true)}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Upload Document
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {documents.map((doc) => (
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
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </p>
                        {doc.notes && (
                          <p className="text-sm text-accent mt-1">Note: {doc.notes}</p>
                        )}
                      </div>
                    </div>
                    {getStatusBadge(doc.status)}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            {/* Upload Options */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleCameraClick}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-95"
              >
                <Camera className="w-8 h-8 text-accent" />
                <span className="text-sm font-medium text-foreground">Camera</span>
              </button>
              <button
                onClick={handleGalleryClick}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-95"
              >
                <Image className="w-8 h-8 text-accent" />
                <span className="text-sm font-medium text-foreground">Gallery</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-accent hover:bg-accent/5 transition-all active:scale-95"
              >
                <File className="w-8 h-8 text-accent" />
                <span className="text-sm font-medium text-foreground">Files</span>
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileSelect}
            />

            {/* Previews */}
            {selectedFiles.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-foreground">
                  Selected files ({selectedFiles.length})
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {previews.map((preview, index) => (
                    <div key={index} className="relative group">
                      {preview === "pdf" ? (
                        <div className="aspect-square rounded-lg bg-secondary flex items-center justify-center">
                          <File className="w-8 h-8 text-muted-foreground" />
                        </div>
                      ) : (
                        <img
                          src={preview}
                          alt={`Preview ${index + 1}`}
                          className="aspect-square object-cover rounded-lg"
                        />
                      )}
                      <button
                        onClick={() => removeFile(index)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <p className="text-xs text-muted-foreground truncate mt-1">
                        {selectedFiles[index]?.name}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFiles([]);
                  setPreviews([]);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="accent"
                className="flex-1"
                onClick={handleUpload}
                disabled={selectedFiles.length === 0 || uploading}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload ({selectedFiles.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
