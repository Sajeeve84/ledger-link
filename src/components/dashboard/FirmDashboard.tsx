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

      // Fetch clients
      const { data: clientsData } = await supabase
        .from("clients")
        .select(`
          id,
          user_id,
          company_name,
          assigned_accountant_id,
          profiles:user_id (full_name, email)
        `)
        .eq("firm_id", firm.id);

      if (clientsData) {
        setClients(clientsData as unknown as Client[]);
      }

      // Fetch accountants
      const { data: accountantsData } = await supabase
        .from("firm_accountants")
        .select(`
          id,
          accountant_id,
          profiles:accountant_id (full_name, email)
        `)
        .eq("firm_id", firm.id);

      if (accountantsData) {
        setAccountants(accountantsData as unknown as Accountant[]);
      }

      // Count pending documents
      const { count: pendingCount } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientsData?.map((c) => c.id) || [])
        .eq("status", "pending");

      // Count processed today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { count: processedCount } = await supabase
        .from("documents")
        .select("*", { count: "exact", head: true })
        .in("client_id", clientsData?.map((c) => c.id) || [])
        .eq("status", "posted")
        .gte("updated_at", today.toISOString());

      setStats({
        totalClients: clientsData?.length || 0,
        totalAccountants: accountantsData?.length || 0,
        pendingDocuments: pendingCount || 0,
        processedToday: processedCount || 0,
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
        toast({
          title: "Error",
          description: "Failed to create invite token",
          variant: "destructive",
        });
        return;
      }

      // Generate secure invite link with token
      const inviteLink = `${window.location.origin}/invite?token=${tokenData.token}`;
      
      // Copy to clipboard
      await navigator.clipboard.writeText(inviteLink);
      
      toast({
        title: "Invite Link Copied!",
        description: `Share this link with the ${inviteType}. Link expires in 48 hours.`,
      });
      setDialogOpen(false);
      setInviteEmail("");
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to generate invite link",
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
