import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCamera } from "@/hooks/useCamera";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Home,
  FileText,
  Bell,
  Upload,
  Camera,
  ImageIcon,
  File as FileIcon,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  X,
  Loader2,
  User,
  LogOut,
  Plus,
  FolderOpen,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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

  const handleNativeCamera = async () => {
    try {
      const image = await takePhoto();
      if (image?.base64String) {
        const fileName = `photo_${Date.now()}.${image.format || "jpeg"}`;
        const mimeType = `image/${image.format || "jpeg"}`;
        const file = base64ToFile(image.base64String, fileName, mimeType);
        setSelectedFiles((prev) => [...prev, file]);
        setPreviews((prev) => [...prev, `data:${mimeType};base64,${image.base64String}`]);
        toast({ title: "Photo captured", description: "Ready to upload" });
      }
    } catch (error: any) {
      if (error.message !== "User cancelled photos app") {
        toast({ title: "Camera error", description: error.message, variant: "destructive" });
      }
    }
  };

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
        toast({ title: "Gallery error", description: error.message, variant: "destructive" });
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
      const unsubscribe = subscribeToNotifications();
      return () => unsubscribe?.();
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
      if (docs) setDocuments(docs as Document[]);
    }

    const { data: notifs } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (notifs) setNotifications(notifs as Notification[]);
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
          toast({ title: newNotif.title, description: newNotif.message });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    addFiles(files);
  };

  const addFiles = (files: File[]) => {
    const validFiles = files.filter((f) => {
      const isValid = f.type.startsWith("image/") || f.type === "application/pdf";
      if (!isValid) {
        toast({ title: "Invalid file", description: `${f.name} - only images and PDFs allowed`, variant: "destructive" });
      }
      return isValid;
    });

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    validFiles.forEach((file) => {
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviews((prev) => [...prev, e.target?.result as string]);
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
      // Get client info for notifications
      const { data: clientInfo } = await supabase
        .from("clients")
        .select("assigned_accountant_id, firm_id")
        .eq("id", clientId)
        .single();

      // Get firm owner ID
      let firmOwnerId: string | null = null;
      if (clientInfo?.firm_id) {
        const { data: firmData } = await supabase
          .from("firms")
          .select("owner_id")
          .eq("id", clientInfo.firm_id)
          .single();
        firmOwnerId = firmData?.owner_id || null;
      }

      // Get user profile for notification message
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user?.id)
        .single();
      const uploaderName = profile?.full_name || "A client";

      for (const file of selectedFiles) {
        const fileExt = file.name.split(".").pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `${user?.id}/${fileName}`;

        const { error: uploadError } = await supabase.storage.from("documents").upload(filePath, file);
        if (uploadError) throw uploadError;

        const { data: newDoc, error: docError } = await supabase.from("documents").insert({
          client_id: clientId,
          file_name: file.name,
          file_path: filePath,
          file_type: file.type,
          file_size: file.size,
          status: "pending",
        }).select("id").single();
        if (docError) throw docError;

        // Notify assigned accountant
        if (clientInfo?.assigned_accountant_id) {
          await supabase.from("notifications").insert({
            user_id: clientInfo.assigned_accountant_id,
            title: "New Document Uploaded",
            message: `${uploaderName} uploaded "${file.name}" for review`,
            document_id: newDoc?.id,
          });
        }

        // Notify firm owner
        if (firmOwnerId && firmOwnerId !== clientInfo?.assigned_accountant_id) {
          await supabase.from("notifications").insert({
            user_id: firmOwnerId,
            title: "New Document Uploaded",
            message: `${uploaderName} uploaded "${file.name}"`,
            document_id: newDoc?.id,
          });
        }
      }

      toast({ title: "Uploaded!", description: `${selectedFiles.length} document(s) sent for review` });
      setUploadDialogOpen(false);
      setSelectedFiles([]);
      setPreviews([]);
      fetchClientData();
    } catch (error: any) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const markNotificationRead = async (id: string) => {
    await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  const getStatusInfo = (status: DocumentStatus) => {
    const statusMap = {
      pending: { icon: Clock, label: "Pending", color: "text-amber-500", bg: "bg-amber-500/10" },
      posted: { icon: CheckCircle2, label: "Posted", color: "text-emerald-500", bg: "bg-emerald-500/10" },
      clarification_needed: { icon: AlertCircle, label: "Clarification", color: "text-red-500", bg: "bg-red-500/10" },
      resend_requested: { icon: RotateCcw, label: "Resend", color: "text-blue-500", bg: "bg-blue-500/10" },
    };
    return statusMap[status];
  };

  const stats = {
    pending: documents.filter((d) => d.status === "pending").length,
    posted: documents.filter((d) => d.status === "posted").length,
    action: documents.filter((d) => ["clarification_needed", "resend_requested"].includes(d.status)).length,
  };

  // HOME TAB
  const HomeTab = () => (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="bg-primary px-6 pt-14 pb-10">
        <h1 className="text-2xl font-bold text-primary-foreground">DocuFlow</h1>
        <p className="text-primary-foreground/70 text-sm mt-1">Upload & track your documents</p>
      </div>

      {/* Stats Cards */}
      <div className="px-4 -mt-6">
        <div className="bg-card rounded-2xl shadow-lg p-4 grid grid-cols-3 gap-2">
          <div className="text-center p-3">
            <div className="w-12 h-12 rounded-full bg-amber-500/10 mx-auto flex items-center justify-center">
              <Clock className="w-6 h-6 text-amber-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.pending}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="text-center p-3">
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.posted}</p>
            <p className="text-xs text-muted-foreground">Posted</p>
          </div>
          <div className="text-center p-3">
            <div className="w-12 h-12 rounded-full bg-red-500/10 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-500" />
            </div>
            <p className="text-2xl font-bold mt-2">{stats.action}</p>
            <p className="text-xs text-muted-foreground">Action</p>
          </div>
        </div>
      </div>

      {/* Upload Options */}
      <div className="px-4 mt-8">
        <h2 className="text-lg font-semibold mb-4">Upload Document</h2>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => { setUploadDialogOpen(true); setTimeout(handleCameraClick, 150); }}
            className="flex flex-col items-center p-5 bg-card rounded-2xl border-2 border-dashed border-muted hover:border-primary active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Camera className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium mt-3">Camera</span>
          </button>
          <button
            onClick={() => { setUploadDialogOpen(true); setTimeout(handleGalleryClick, 150); }}
            className="flex flex-col items-center p-5 bg-card rounded-2xl border-2 border-dashed border-muted hover:border-primary active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <ImageIcon className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium mt-3">Gallery</span>
          </button>
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="flex flex-col items-center p-5 bg-card rounded-2xl border-2 border-dashed border-muted hover:border-primary active:scale-95 transition-all"
          >
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderOpen className="w-7 h-7 text-primary" />
            </div>
            <span className="text-sm font-medium mt-3">Files</span>
          </button>
        </div>
      </div>

      {/* Recent Documents */}
      <div className="px-4 mt-8 pb-28">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Recent Uploads</h2>
          <button onClick={() => setActiveTab("history")} className="text-sm text-primary font-medium">
            See All
          </button>
        </div>

        {documents.length === 0 ? (
          <div className="bg-card rounded-2xl p-8 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/40" />
            <p className="text-muted-foreground mt-3">No documents yet</p>
            <p className="text-sm text-muted-foreground/70">Upload your first document above</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.slice(0, 4).map((doc) => {
              const status = getStatusInfo(doc.status);
              const StatusIcon = status.icon;
              return (
                <div key={doc.id} className="bg-card rounded-xl p-4 flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl ${status.bg} flex items-center justify-center`}>
                    <FileText className={`w-6 h-6 ${status.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{doc.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full ${status.bg}`}>
                    <StatusIcon className={`w-3.5 h-3.5 ${status.color}`} />
                    <span className={`text-xs font-medium ${status.color}`}>{status.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // HISTORY TAB
  const HistoryTab = () => (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 bg-background z-10 px-6 pt-14 pb-4 border-b">
        <h1 className="text-xl font-bold">Upload History</h1>
        <p className="text-sm text-muted-foreground">{documents.length} documents</p>
      </div>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-4 py-4 pb-28 space-y-3">
          {documents.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-16 h-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-4">No documents uploaded</p>
            </div>
          ) : (
            documents.map((doc) => {
              const status = getStatusInfo(doc.status);
              const StatusIcon = status.icon;
              return (
                <div key={doc.id} className="bg-card rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <div className={`w-11 h-11 rounded-lg ${status.bg} flex items-center justify-center shrink-0`}>
                      {doc.file_type?.includes("pdf") ? (
                        <FileIcon className={`w-5 h-5 ${status.color}`} />
                      ) : (
                        <ImageIcon className={`w-5 h-5 ${status.color}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium">{doc.file_name}</p>
                      <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${status.bg} mt-1`}>
                        <StatusIcon className={`w-3 h-3 ${status.color}`} />
                        <span className={`text-xs ${status.color}`}>{status.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(doc.uploaded_at).toLocaleString()}
                      </p>
                      {doc.notes && (
                        <div className="mt-2 p-2.5 bg-muted/50 rounded-lg">
                          <p className="text-xs text-muted-foreground">Accountant note:</p>
                          <p className="text-sm mt-0.5">{doc.notes}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // NOTIFICATIONS TAB
  const NotificationsTab = () => (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 bg-background z-10 px-6 pt-14 pb-4 border-b">
        <h1 className="text-xl font-bold">Notifications</h1>
        <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
      </div>
      <ScrollArea className="h-[calc(100vh-180px)]">
        <div className="px-4 py-4 pb-28 space-y-3">
          {notifications.length === 0 ? (
            <div className="text-center py-16">
              <Bell className="w-16 h-16 mx-auto text-muted-foreground/30" />
              <p className="text-muted-foreground mt-4">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notif) => (
              <button
                key={notif.id}
                onClick={() => markNotificationRead(notif.id)}
                className={`w-full text-left p-4 rounded-xl transition-all ${
                  notif.is_read ? "bg-card" : "bg-primary/5 border border-primary/20"
                }`}
              >
                <div className="flex gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                    notif.is_read ? "bg-muted" : "bg-primary/10"
                  }`}>
                    <Bell className={`w-5 h-5 ${notif.is_read ? "text-muted-foreground" : "text-primary"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-medium ${!notif.is_read && "text-primary"}`}>{notif.title}</p>
                    <p className="text-sm text-muted-foreground mt-0.5">{notif.message}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1.5">
                      {new Date(notif.created_at).toLocaleString()}
                    </p>
                  </div>
                  {!notif.is_read && <div className="w-2 h-2 rounded-full bg-primary mt-2" />}
                </div>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );

  // PROFILE TAB
  const ProfileTab = () => (
    <div className="flex-1 overflow-auto">
      <div className="sticky top-0 bg-background z-10 px-6 pt-14 pb-4 border-b">
        <h1 className="text-xl font-bold">Profile</h1>
      </div>
      <div className="px-4 py-4 pb-28">
        <ClientProfileSettings />
        <div className="mt-6">
          <Button variant="outline" className="w-full h-12 text-destructive border-destructive/30" onClick={signOut}>
            <LogOut className="w-5 h-5 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {activeTab === "home" && <HomeTab />}
      {activeTab === "history" && <HistoryTab />}
      {activeTab === "notifications" && <NotificationsTab />}
      {activeTab === "profile" && <ProfileTab />}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-card border-t z-50 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          <button onClick={() => setActiveTab("home")} className={`flex flex-col items-center gap-1 p-2 ${activeTab === "home" ? "text-primary" : "text-muted-foreground"}`}>
            <Home className="w-6 h-6" />
            <span className="text-[10px] font-medium">Home</span>
          </button>
          <button onClick={() => setActiveTab("history")} className={`flex flex-col items-center gap-1 p-2 ${activeTab === "history" ? "text-primary" : "text-muted-foreground"}`}>
            <FileText className="w-6 h-6" />
            <span className="text-[10px] font-medium">History</span>
          </button>

          {/* FAB */}
          <button
            onClick={() => setUploadDialogOpen(true)}
            className="relative -top-5 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center active:scale-95"
          >
            <Plus className="w-7 h-7" />
          </button>

          <button onClick={() => setActiveTab("notifications")} className={`relative flex flex-col items-center gap-1 p-2 ${activeTab === "notifications" ? "text-primary" : "text-muted-foreground"}`}>
            <Bell className="w-6 h-6" />
            {unreadCount > 0 && (
              <span className="absolute -top-0 right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] rounded-full flex items-center justify-center font-medium">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
            <span className="text-[10px] font-medium">Alerts</span>
          </button>
          <button onClick={() => setActiveTab("profile")} className={`flex flex-col items-center gap-1 p-2 ${activeTab === "profile" ? "text-primary" : "text-muted-foreground"}`}>
            <User className="w-6 h-6" />
            <span className="text-[10px] font-medium">Profile</span>
          </button>
        </div>
      </nav>

      {/* Upload Dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-[92vw] sm:max-w-md rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="px-5 pt-5 pb-3">
            <DialogTitle>Upload Documents</DialogTitle>
          </DialogHeader>
          
          <div className="px-5 pb-5 space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <button onClick={handleCameraClick} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary active:scale-95 transition-all">
                <Camera className="w-7 h-7 text-primary" />
                <span className="text-xs font-medium">Camera</span>
              </button>
              <button onClick={handleGalleryClick} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary active:scale-95 transition-all">
                <ImageIcon className="w-7 h-7 text-primary" />
                <span className="text-xs font-medium">Gallery</span>
              </button>
              <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 border-dashed hover:border-primary active:scale-95 transition-all">
                <FileIcon className="w-7 h-7 text-primary" />
                <span className="text-xs font-medium">Files</span>
              </button>
            </div>

            <input ref={fileInputRef} type="file" accept="image/*,application/pdf" multiple className="hidden" onChange={handleFileSelect} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />

            {selectedFiles.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">{selectedFiles.length} file(s) selected</p>
                <div className="grid grid-cols-4 gap-2">
                  {previews.map((preview, i) => (
                    <div key={i} className="relative">
                      {preview === "pdf" ? (
                        <div className="aspect-square rounded-lg bg-muted flex items-center justify-center">
                          <FileIcon className="w-6 h-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <img src={preview} alt="" className="aspect-square object-cover rounded-lg" />
                      )}
                      <button onClick={() => removeFile(i)} className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11" onClick={() => { setUploadDialogOpen(false); setSelectedFiles([]); setPreviews([]); }}>
                Cancel
              </Button>
              <Button className="flex-1 h-11" onClick={handleUpload} disabled={selectedFiles.length === 0 || uploading}>
                {uploading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Uploading...</> : <><Upload className="w-4 h-4 mr-2" /> Upload</>}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
