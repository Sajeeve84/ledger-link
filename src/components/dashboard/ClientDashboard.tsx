import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCamera } from "@/hooks/useCamera";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  FileText,
  Bell,
  Upload,
  Camera,
  Image,
  File as FileIcon,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  X,
  Loader2,
  User,
  History,
  LogOut,
  Plus,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ClientProfileSettings from "./ClientProfileSettings";

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

type TabType = "home" | "history" | "notifications" | "profile";

export default function ClientDashboard() {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const { isNative, takePhoto, pickFromGallery } = useCamera();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [clientId, setClientId] = useState<string | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

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
        const fileName = `photo_${Date.now()}.${image.format || "jpeg"}`;
        const mimeType = `image/${image.format || "jpeg"}`;
        const file = base64ToFile(image.base64String, fileName, mimeType);

        setSelectedFiles((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, `data:${mimeType};base64,${image.base64String}`]);

        toast({
          title: "Photo captured",
          description: "Your photo is ready to upload",
        });
      }
    } catch (error: any) {
      if (error.message !== "User cancelled photos app") {
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
        const fileName = `image_${Date.now()}.${image.format || "jpeg"}`;
        const mimeType = `image/${image.format || "jpeg"}`;
        const file = base64ToFile(image.base64String, fileName, mimeType);

        setSelectedFiles((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, `data:${mimeType};base64,${image.base64String}`]);
      }
    } catch (error: any) {
      if (error.message !== "User cancelled photos app") {
        toast({
          title: "Gallery error",
          description: error.message || "Failed to select image",
          variant: "destructive",
        });
      }
    }
  };

  const handleCameraClick = () => {
    if (isNative) {
      handleNativeCamera();
    } else {
      cameraInputRef.current?.click();
    }
  };

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

    const { data: client } = await supabase
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (client) {
      setClientId(client.id);

      const { data: docs } = await supabase
        .from("documents")
        .select("*")
        .eq("client_id", client.id)
        .order("uploaded_at", { ascending: false });

      if (docs) {
        setDocuments(docs as Document[]);
      }
    }

    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

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

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, file);

        if (uploadError) throw uploadError;

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

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const getStatusConfig = (status: DocumentStatus) => {
    const config = {
      pending: {
        icon: <Clock className="w-5 h-5" />,
        label: "Pending Review",
        bgColor: "bg-amber-500/10",
        textColor: "text-amber-600",
        borderColor: "border-amber-500/20",
      },
      posted: {
        icon: <CheckCircle className="w-5 h-5" />,
        label: "Posted",
        bgColor: "bg-emerald-500/10",
        textColor: "text-emerald-600",
        borderColor: "border-emerald-500/20",
      },
      clarification_needed: {
        icon: <AlertTriangle className="w-5 h-5" />,
        label: "Needs Clarification",
        bgColor: "bg-red-500/10",
        textColor: "text-red-600",
        borderColor: "border-red-500/20",
      },
      resend_requested: {
        icon: <RotateCcw className="w-5 h-5" />,
        label: "Resend Requested",
        bgColor: "bg-blue-500/10",
        textColor: "text-blue-600",
        borderColor: "border-blue-500/20",
      },
    };
    return config[status];
  };

  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const postedCount = documents.filter((d) => d.status === "posted").length;
  const actionNeeded = documents.filter((d) =>
    ["clarification_needed", "resend_requested"].includes(d.status)
  ).length;

  const renderHomeTab = () => (
    <div className="flex-1 overflow-auto pb-24">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground px-5 pt-12 pb-8">
        <h1 className="text-2xl font-bold">Welcome Back!</h1>
        <p className="text-primary-foreground/80 mt-1">Upload and track your documents</p>
      </div>

      {/* Quick Stats */}
      <div className="px-4 -mt-4">
        <div className="bg-card rounded-2xl shadow-lg border border-border/50 p-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-2">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Pending</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-2">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-foreground">{postedCount}</p>
              <p className="text-xs text-muted-foreground">Posted</p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-2">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-foreground">{actionNeeded}</p>
              <p className="text-xs text-muted-foreground">Action</p>
            </div>
          </div>
        </div>
      </div>

      {/* Upload Section */}
      <div className="px-4 mt-6">
        <h2 className="text-lg font-semibold text-foreground mb-3">Upload Documents</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => {
              setUploadDialogOpen(true);
              setTimeout(() => handleCameraClick(), 100);
            }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">Camera</span>
          </button>
          <button
            onClick={() => {
              setUploadDialogOpen(true);
              setTimeout(() => handleGalleryClick(), 100);
            }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Image className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">Gallery</span>
          </button>
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <FileIcon className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium text-foreground">Files</span>
          </button>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="px-4 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-foreground">Recent Documents</h2>
          <button
            onClick={() => setActiveTab("history")}
            className="text-sm text-primary font-medium flex items-center gap-1"
          >
            View All <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-card rounded-2xl border border-border/50 p-8 text-center">
            <FileText className="w-12 h-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-muted-foreground">No documents yet</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Upload your first document to get started
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.slice(0, 5).map((doc) => {
              const status = getStatusConfig(doc.status);
              return (
                <div
                  key={doc.id}
                  className={`bg-card rounded-xl border ${status.borderColor} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg ${status.bgColor} flex items-center justify-center flex-shrink-0`}>
                      <FileText className={`w-5 h-5 ${status.textColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(doc.uploaded_at).toLocaleDateString()}
                      </p>
                      {doc.notes && (
                        <p className="text-xs text-primary mt-1 line-clamp-1">{doc.notes}</p>
                      )}
                    </div>
                    <Badge className={`${status.bgColor} ${status.textColor} border-0 flex items-center gap-1`}>
                      {status.icon}
                      <span className="hidden sm:inline">{status.label}</span>
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderHistoryTab = () => (
    <div className="flex-1 overflow-auto pb-24">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-4 z-10">
        <h1 className="text-xl font-bold text-foreground">Upload History</h1>
        <p className="text-sm text-muted-foreground">{documents.length} total documents</p>
      </div>

      <div className="px-4 py-4">
        {documents.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">No upload history</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Your uploaded documents will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const status = getStatusConfig(doc.status);
              return (
                <div
                  key={doc.id}
                  className={`bg-card rounded-xl border ${status.borderColor} p-4`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-12 h-12 rounded-lg ${status.bgColor} flex items-center justify-center flex-shrink-0`}>
                      {doc.file_type?.includes("pdf") ? (
                        <FileIcon className={`w-6 h-6 ${status.textColor}`} />
                      ) : (
                        <Image className={`w-6 h-6 ${status.textColor}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{doc.file_name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className={`${status.bgColor} ${status.textColor} border-0 text-xs`}>
                          {status.label}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-2">
                        Uploaded: {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                      {doc.notes && (
                        <div className="mt-2 p-2 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Note from accountant:</p>
                          <p className="text-sm text-foreground mt-0.5">{doc.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const renderNotificationsTab = () => (
    <div className="flex-1 overflow-auto pb-24">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-4 z-10">
        <h1 className="text-xl font-bold text-foreground">Notifications</h1>
        <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
      </div>

      <div className="px-4 py-4">
        {notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground/30" />
            <p className="text-lg font-medium text-muted-foreground">No notifications</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              You'll be notified about document updates here
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => markNotificationRead(notif.id)}
                className={`w-full text-left p-4 rounded-xl border transition-all ${
                  notif.is_read
                    ? "bg-card border-border/50"
                    : "bg-primary/5 border-primary/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                    notif.is_read ? "bg-muted" : "bg-primary/10"
                  }`}>
                    <Bell className={`w-5 h-5 ${notif.is_read ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${notif.is_read ? "text-foreground" : "text-primary"}`}>
                      {notif.title}
                    </p>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-2">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notif.is_read && (
                    <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0 mt-2" />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const renderProfileTab = () => (
    <div className="flex-1 overflow-auto pb-24">
      <div className="sticky top-0 bg-background/95 backdrop-blur-sm border-b border-border px-5 py-4 z-10">
        <h1 className="text-xl font-bold text-foreground">Profile Settings</h1>
      </div>

      <div className="px-4 py-4">
        <ClientProfileSettings />

        {/* Logout Button */}
        <div className="mt-6">
          <Button
            variant="outline"
            className="w-full h-12 text-destructive border-destructive/30 hover:bg-destructive/10"
            onClick={signOut}
          >
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Main Content */}
      {activeTab === "home" && renderHomeTab()}
      {activeTab === "history" && renderHistoryTab()}
      {activeTab === "notifications" && renderNotificationsTab()}
      {activeTab === "profile" && renderProfileTab()}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          <button
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === "home" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Home className="w-6 h-6" />
            <span className="text-xs font-medium">Home</span>
          </button>
          <button
            onClick={() => setActiveTab("history")}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === "history" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <History className="w-6 h-6" />
            <span className="text-xs font-medium">History</span>
          </button>

          {/* Center Upload Button */}
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="relative -top-4 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95 transition-transform"
          >
            <Plus className="w-7 h-7" />
          </button>

          <button
            onClick={() => setActiveTab("notifications")}
            className={`flex flex-col items-center gap-1 px-4 py-2 relative ${
              activeTab === "notifications" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-2 w-5 h-5 bg-destructive text-destructive-foreground text-xs rounded-full flex items-center justify-center">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="text-xs font-medium">Alerts</span>
          </button>
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex flex-col items-center gap-1 px-4 py-2 ${
              activeTab === "profile" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <User className="w-6 h-6" />
            <span className="text-xs font-medium">Profile</span>
          </button>
        </div>
      </nav>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl">Upload Documents</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            {/* Upload Options */}
            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={handleCameraClick}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <Camera className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">Camera</span>
              </button>
              <button
                onClick={handleGalleryClick}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <Image className="w-8 h-8 text-primary" />
                <span className="text-sm font-medium text-foreground">Gallery</span>
              </button>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-95"
              >
                <FileIcon className="w-8 h-8 text-primary" />
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
                        <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                          <FileIcon className="w-8 h-8 text-muted-foreground" />
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
                        className="absolute -top-2 -right-2 w-6 h-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center shadow-md"
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
            <div className="flex gap-3 pt-2">
              <Button
                variant="outline"
                className="flex-1 h-12"
                onClick={() => {
                  setUploadDialogOpen(false);
                  setSelectedFiles([]);
                  setPreviews([]);
                }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 h-12"
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
    </div>
  );
}
