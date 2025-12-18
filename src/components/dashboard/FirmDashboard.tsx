import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardLayout from "./DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  LayoutDashboard,
  Users,
  FileText,
  Bell,
  Plus,
  UserPlus,
  Building,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

      setStats({
        totalClients: clientsData?.length || 0,
        totalAccountants: accountantsData?.length || 0,
        pendingDocuments: pendingCount || 0,
        processedToday: 0, // Would need proper query with date filter
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
      .update({ assigned_accountant_id: accountantId })
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

  return (
    <DashboardLayout navItems={navItems} title="Firm">
      <div className="space-y-8 animate-fade-in">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Clients</p>
                  <p className="text-3xl font-bold text-foreground">{stats.totalClients}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-accent" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Accountants</p>
                  <p className="text-3xl font-bold text-foreground">{stats.totalAccountants}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-md border-border/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Documents</p>
                  <p className="text-3xl font-bold text-foreground">{stats.pendingDocuments}</p>
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
                  <p className="text-sm text-muted-foreground">Processed Today</p>
                  <p className="text-3xl font-bold text-foreground">{stats.processedToday}</p>
                </div>
                <div className="w-12 h-12 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-3">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="accent" onClick={() => setInviteType("client")}>
                <UserPlus className="w-4 h-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Invite {inviteType === "client" ? "Client" : "Accountant"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleInvite} className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={inviteType}
                    onValueChange={(v) => setInviteType(v as "accountant" | "client")}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="client">Client</SelectItem>
                      <SelectItem value="accountant">Accountant</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Email Address</Label>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                  />
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating invite..." : "Generate Invite Link"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
          
          <Button variant="outline" onClick={() => { setInviteType("accountant"); setDialogOpen(true); }}>
            <Building className="w-4 h-4 mr-2" />
            Add Accountant
          </Button>
        </div>

        {/* Clients Table */}
        <Card className="shadow-md border-border/50">
          <CardHeader>
            <CardTitle className="text-foreground">Clients</CardTitle>
          </CardHeader>
          <CardContent>
            {clients.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No clients yet. Invite your first client to get started.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {clients.map((client) => (
                  <div
                    key={client.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-secondary/30 border border-border/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                        <span className="text-accent font-medium">
                          {client.profiles?.full_name?.charAt(0) || client.profiles?.email?.charAt(0) || "?"}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-foreground">
                          {client.profiles?.full_name || client.profiles?.email}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {client.company_name || "No company name"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Select
                        value={client.assigned_accountant_id || "unassigned"}
                        onValueChange={(v) =>
                          assignAccountant(client.id, v === "unassigned" ? "" : v)
                        }
                      >
                        <SelectTrigger className="w-[200px]">
                          <SelectValue placeholder="Assign accountant" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {accountants.map((acc) => (
                            <SelectItem key={acc.accountant_id} value={acc.accountant_id}>
                              {acc.profiles?.full_name || acc.profiles?.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
