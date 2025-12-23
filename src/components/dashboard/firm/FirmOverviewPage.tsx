import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Users,
  Building,
  Clock,
  TrendingUp,
  UserPlus,
  FileText,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

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

interface FirmOverviewPageProps {
  stats: Stats;
  clients: Client[];
  accountants: Accountant[];
  inviteEmail: string;
  setInviteEmail: (value: string) => void;
  inviteType: "accountant" | "client";
  setInviteType: (value: "accountant" | "client") => void;
  dialogOpen: boolean;
  setDialogOpen: (value: boolean) => void;
  onInvite: (e: React.FormEvent) => void;
  loading: boolean;
  onAssignAccountant: (clientId: string, accountantId: string) => void;
}

export default function FirmOverviewPage({
  stats,
  clients,
  accountants,
  inviteEmail,
  setInviteEmail,
  inviteType,
  setInviteType,
  dialogOpen,
  setDialogOpen,
  onInvite,
  loading,
  onAssignAccountant,
}: FirmOverviewPageProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card 
          className="shadow-md border-border/50 cursor-pointer hover:shadow-lg hover:border-accent/50 transition-all"
          onClick={() => navigate("/dashboard/clients")}
        >
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

        <Card 
          className="shadow-md border-border/50 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all"
          onClick={() => navigate("/dashboard/accountants")}
        >
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

        <Card 
          className="shadow-md border-border/50 cursor-pointer hover:shadow-lg hover:border-warning/50 transition-all"
          onClick={() => navigate("/dashboard/documents")}
        >
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

        <Card 
          className="shadow-md border-border/50 cursor-pointer hover:shadow-lg hover:border-success/50 transition-all"
          onClick={() => navigate("/dashboard/documents")}
        >
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
            <form onSubmit={onInvite} noValidate className="space-y-4 mt-4">
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

      {/* Recent Clients */}
      <Card className="shadow-md border-border/50">
        <CardHeader>
          <CardTitle className="text-foreground">Recent Clients</CardTitle>
        </CardHeader>
        <CardContent>
          {clients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No clients yet. Invite your first client to get started.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {clients.slice(0, 5).map((client) => (
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
                        onAssignAccountant(client.id, v === "unassigned" ? "" : v)
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
  );
}
