import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "./DashboardLayout";
import FirmOverviewPage from "./firm/FirmOverviewPage";
import FirmClientsPage from "./firm/FirmClientsPage";
import FirmAccountantsPage from "./firm/FirmAccountantsPage";
import FirmDocumentsPage from "./firm/FirmDocumentsPage";
import FirmNotificationsPage from "./firm/FirmNotificationsPage";
import { useToast } from "@/hooks/use-toast";
import { invitesApi, firmsApi, clientsApi, accountantsApi, documentsApi } from "@/lib/api";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Building,
} from "lucide-react";

const navItems = [
  { icon: LayoutDashboard, label: "Overview", href: "/dashboard" },
  { icon: Users, label: "Clients", href: "/dashboard/clients" },
  { icon: Building, label: "Accountants", href: "/dashboard/accountants" },
  { icon: FileText, label: "Documents", href: "/dashboard/documents" },
  { icon: Bell, label: "Notifications", href: "/dashboard/notifications" },
];

interface Stats {
  totalClients: number;
  totalAccountants: number;
  pendingDocuments: number;
  processedToday: number;
}

interface Client {
  id: string;
  user_id: string;
  company_name: string | null;
  assigned_accountant_id: string | null;
  profiles: { full_name: string | null; email: string } | null;
}

interface Accountant {
  id: string;
  accountant_id: string;
  profiles: { full_name: string | null; email: string } | null;
}

export default function FirmDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const location = useLocation();
  const [stats, setStats] = useState<Stats>({
    totalClients: 0,
    totalAccountants: 0,
    pendingDocuments: 0,
    processedToday: 0,
  });
  const [clients, setClients] = useState<Client[]>([]);
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [firmId, setFirmId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteType, setInviteType] = useState<"accountant" | "client">("client");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    if (user) {
      fetchFirmData();
    }
  }, [user]);

  const fetchFirmData = async () => {
    if (!user) return;

    // Get firm (for current firm owner)
    const firmRes = await firmsApi.get();

    if (firmRes.error) {
      console.error("Firm fetch error:", firmRes.error);
      toast({
        title: "Error",
        description: firmRes.error,
        variant: "destructive",
      });
      return;
    }

    const firm = firmRes.data;
    if (!firm?.id) {
      setFirmId(null);
      setClients([]);
      setAccountants([]);
      setStats({
        totalClients: 0,
        totalAccountants: 0,
        pendingDocuments: 0,
        processedToday: 0,
      });
      return;
    }

    setFirmId(firm.id);

    const [clientsRes, accountantsRes, docsRes] = await Promise.all([
      clientsApi.getByFirm(firm.id),
      accountantsApi.getByFirm(firm.id),
      documentsApi.getByFirm(firm.id),
    ]);

    if (clientsRes.error) {
      toast({
        title: "Error",
        description: clientsRes.error,
        variant: "destructive",
      });
    }

    if (accountantsRes.error) {
      toast({
        title: "Error",
        description: accountantsRes.error,
        variant: "destructive",
      });
    }

    const clientsWithProfiles: Client[] = (clientsRes.data || []).map((c: any) => ({
      id: c.id,
      user_id: c.user_id,
      company_name: c.company_name ?? null,
      assigned_accountant_id: c.assigned_accountant_id ?? null,
      profiles: c.email
        ? {
            full_name: c.full_name ?? null,
            email: c.email,
          }
        : null,
    }));

    const accountantsWithProfiles: Accountant[] = (accountantsRes.data || []).map((a: any) => ({
      id: a.id,
      accountant_id: a.accountant_id,
      profiles: a.email
        ? {
            full_name: a.full_name ?? null,
            email: a.email,
          }
        : null,
    }));

    setClients(clientsWithProfiles);
    setAccountants(accountantsWithProfiles);

    const docs = (docsRes.data || []) as any[];
    const pendingCount = docs.filter((d) => d.status === "pending").length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const processedCount = docs.filter((d) => {
      if (d.status !== "posted") return false;
      const updatedAt = d.updated_at ? new Date(d.updated_at) : null;
      return !!updatedAt && updatedAt.getTime() >= today.getTime();
    }).length;

    setStats({
      totalClients: clientsWithProfiles.length,
      totalAccountants: accountantsWithProfiles.length,
      pendingDocuments: pendingCount,
      processedToday: processedCount,
    });
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!firmId) {
      toast({
        title: "Error",
        description: "Firm not loaded yet. Please refresh and try again.",
        variant: "destructive",
      });
      return;
    }

    const email = inviteEmail.trim();
    if (!email) {
      toast({
        title: "Email required",
        description: "Please enter an email address to generate an invite link.",
        variant: "destructive",
      });
      return;
    }

    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      toast({
        title: "Invalid email",
        description: "Please enter a valid email address (example: name@domain.com).",
        variant: "destructive",
      });
      return;
    }

    if (!user) return;

    setLoading(true);

    try {
      // Create invite token via PHP API
      const response = await invitesApi.create({
        firm_id: firmId,
        email,
        role: inviteType,
      });

      if (response.error || !response.data) {
        console.error("Token creation error:", response.error);
        toast({
          title: "Error",
          description: response.error || "Failed to create invite token",
          variant: "destructive",
        });
        return;
      }

      // Generate invite link
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/invite?token=${response.data.token}`;

      // Copy link to clipboard
      try {
        await navigator.clipboard.writeText(inviteLink);
        toast({
          title: "Invite Link Created!",
          description: `Link copied to clipboard. Share it with ${email}. Expires in 48 hours.`,
        });
      } catch {
        // Fallback: show the link
        toast({
          title: "Invite Link Created!",
          description: inviteLink,
          duration: 15000,
        });
      }

      setDialogOpen(false);
      setInviteEmail("");
    } catch (err) {
      console.error("Invite error:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to generate invite link",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const assignAccountant = async (clientId: string, accountantId: string) => {
    const desired = accountantId || "";

    const { error } = await clientsApi.update(clientId, {
      assigned_accountant_id: desired,
    });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to assign accountant",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Accountant assigned successfully",
      });
      fetchFirmData();
    }
  };

  // Calculate clients per accountant for accountants page
  const clientsByAccountant: Record<string, number> = {};
  clients.forEach((client) => {
    if (client.assigned_accountant_id) {
      clientsByAccountant[client.assigned_accountant_id] =
        (clientsByAccountant[client.assigned_accountant_id] || 0) + 1;
    }
  });

  // Determine which page to show based on route
  const currentPath = location.pathname;

  const renderContent = () => {
    if (currentPath === "/dashboard/clients") {
      return (
        <FirmClientsPage
          clients={clients}
          accountants={accountants}
          onAssignAccountant={assignAccountant}
        />
      );
    }
    if (currentPath === "/dashboard/accountants") {
      return (
        <FirmAccountantsPage
          accountants={accountants}
          clientsByAccountant={clientsByAccountant}
        />
      );
    }
    if (currentPath === "/dashboard/documents" && firmId) {
      return <FirmDocumentsPage firmId={firmId} clients={clients} />;
    }
    if (currentPath === "/dashboard/notifications") {
      return <FirmNotificationsPage />;
    }
    // Default: Overview
    return (
      <FirmOverviewPage
        stats={stats}
        clients={clients}
        accountants={accountants}
        inviteEmail={inviteEmail}
        setInviteEmail={setInviteEmail}
        inviteType={inviteType}
        setInviteType={setInviteType}
        dialogOpen={dialogOpen}
        setDialogOpen={setDialogOpen}
        onInvite={handleInvite}
        loading={loading}
        onAssignAccountant={assignAccountant}
      />
    );
  };

  return (
    <DashboardLayout navItems={navItems} title="Firm">
      {renderContent()}
    </DashboardLayout>
  );
}
