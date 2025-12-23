import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "./DashboardLayout";
import FirmOverviewPage from "./firm/FirmOverviewPage";
import FirmClientsPage from "./firm/FirmClientsPage";
import FirmAccountantsPage from "./firm/FirmAccountantsPage";
import FirmDocumentsPage from "./firm/FirmDocumentsPage";
import FirmNotificationsPage from "./firm/FirmNotificationsPage";
import { useToast } from "@/hooks/use-toast";
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

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
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

    // Get firm
    const { data: firm } = await supabase
      .from("firms")
      .select("id")
      .eq("owner_id", user.id)
      .maybeSingle();

    if (firm) {
      setFirmId(firm.id);

      // Fetch clients (without join)
      const { data: clientsData } = await supabase
        .from("clients")
        .select("id, user_id, company_name, assigned_accountant_id")
        .eq("firm_id", firm.id);

      // Fetch accountants (without join)
      const { data: accountantsData } = await supabase
        .from("firm_accountants")
        .select("id, accountant_id")
        .eq("firm_id", firm.id);

      // Get all user IDs to fetch profiles
      const userIds = [
        ...(clientsData?.map((c) => c.user_id) || []),
        ...(accountantsData?.map((a) => a.accountant_id) || []),
      ];

      // Fetch profiles for all users
      let profilesMap: Record<string, Profile> = {};
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", userIds);

        if (profilesData) {
          profilesData.forEach((p) => {
            profilesMap[p.id] = p;
          });
        }
      }

      // Merge clients with profiles
      const clientsWithProfiles: Client[] = (clientsData || []).map((c) => ({
        ...c,
        profiles: profilesMap[c.user_id] || null,
      }));
      setClients(clientsWithProfiles);

      // Merge accountants with profiles
      const accountantsWithProfiles: Accountant[] = (accountantsData || []).map((a) => ({
        ...a,
        profiles: profilesMap[a.accountant_id] || null,
      }));
      setAccountants(accountantsWithProfiles);

      // Count pending documents
      const clientIds = clientsData?.map((c) => c.id) || [];
      let pendingCount = 0;
      let processedCount = 0;

      if (clientIds.length > 0) {
        const { count: pending } = await supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .in("client_id", clientIds)
          .eq("status", "pending");
        pendingCount = pending || 0;

        // Count processed today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const { count: processed } = await supabase
          .from("documents")
          .select("*", { count: "exact", head: true })
          .in("client_id", clientIds)
          .eq("status", "posted")
          .gte("updated_at", today.toISOString());
        processedCount = processed || 0;
      }

      setStats({
        totalClients: clientsData?.length || 0,
        totalAccountants: accountantsData?.length || 0,
        pendingDocuments: pendingCount,
        processedToday: processedCount,
      });
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firmId || !inviteEmail || !user) return;

    setLoading(true);

    try {
      // Create secure invite token in database
      const { data: tokenData, error: tokenError } = await supabase
        .from("invite_tokens")
        .insert({
          firm_id: firmId,
          email: inviteEmail,
          role: inviteType,
          created_by: user.id,
        })
        .select("token")
        .single();

      if (tokenError || !tokenData) {
        console.error("Token creation error:", tokenError);
        toast({
          title: "Error",
          description: tokenError?.message || "Failed to create invite token",
          variant: "destructive",
        });
        return;
      }

      // Generate secure invite link with token
      // Use the current origin so it works on any hosting
      const baseUrl = window.location.origin;
      const inviteLink = `${baseUrl}/invite?token=${tokenData.token}`;
      
      // Get firm name for email
      const { data: firmData } = await supabase
        .from("firms")
        .select("name")
        .eq("id", firmId)
        .single();

      // Send invite email via SMTP edge function
      const { error: emailError } = await supabase.functions.invoke("send-invite-email", {
        body: {
          email: inviteEmail,
          inviteLink,
          inviteType,
          firmName: firmData?.name,
        },
      });

      if (emailError) {
        console.error("Email send error:", emailError);
        toast({
          title: "Warning",
          description: "Invite created but email failed to send. Please share the link manually.",
          variant: "destructive",
        });
        // Still show the link as fallback
        toast({
          title: "Invite Link",
          description: inviteLink,
          duration: 15000,
        });
      } else {
        toast({
          title: "Invitation Sent!",
          description: `An invitation email has been sent to ${inviteEmail}. Link expires in 48 hours.`,
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
    const { error } = await supabase
      .from("clients")
      .update({ assigned_accountant_id: accountantId || null })
      .eq("id", clientId);

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
