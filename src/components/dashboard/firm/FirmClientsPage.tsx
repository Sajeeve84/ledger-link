import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Users, Search, Mail, Building, UserCheck, FileText } from "lucide-react";

interface Client {
  id: string;
  user_id: string;
  company_name: string | null;
  assigned_accountant_id: string | null;
  profiles: { full_name: string | null; email: string } | null;
  documentCount?: number;
}

interface Accountant {
  id: string;
  accountant_id: string;
  profiles: { full_name: string | null; email: string } | null;
}

interface FirmClientsPageProps {
  clients: Client[];
  accountants: Accountant[];
  onAssignAccountant: (clientId: string, accountantId: string) => void;
}

export default function FirmClientsPage({ clients, accountants, onAssignAccountant }: FirmClientsPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAccountant, setFilterAccountant] = useState<string>("all");

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      client.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      client.company_name?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      filterAccountant === "all" ||
      (filterAccountant === "unassigned" && !client.assigned_accountant_id) ||
      client.assigned_accountant_id === filterAccountant;

    return matchesSearch && matchesFilter;
  });

  const getAssignedAccountantName = (accountantId: string | null) => {
    if (!accountantId) return "Unassigned";
    const acc = accountants.find((a) => a.accountant_id === accountantId);
    return acc?.profiles?.full_name || acc?.profiles?.email || "Unknown";
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Clients</h2>
          <p className="text-muted-foreground">{clients.length} total clients</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="shadow-md border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search clients..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filterAccountant} onValueChange={setFilterAccountant}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Filter by accountant" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {accountants.map((acc) => (
                  <SelectItem key={acc.accountant_id} value={acc.accountant_id}>
                    {acc.profiles?.full_name || acc.profiles?.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Clients Grid */}
      {filteredClients.length === 0 ? (
        <Card className="shadow-md border-border/50">
          <CardContent className="py-12">
            <div className="text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                {searchQuery || filterAccountant !== "all"
                  ? "No clients match your filters"
                  : "No clients yet. Invite your first client to get started."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredClients.map((client) => (
            <Card key={client.id} className="shadow-md border-border/50 hover:shadow-lg transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                    <span className="text-accent font-semibold text-lg">
                      {client.profiles?.full_name?.charAt(0) || client.profiles?.email?.charAt(0) || "?"}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground truncate">
                      {client.profiles?.full_name || "Unnamed Client"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                      <Mail className="w-3.5 h-3.5" />
                      <span className="truncate">{client.profiles?.email}</span>
                    </div>
                    {client.company_name && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Building className="w-3.5 h-3.5" />
                        <span className="truncate">{client.company_name}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-border/50 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4" />
                      Assigned to
                    </span>
                    <Badge variant={client.assigned_accountant_id ? "default" : "secondary"}>
                      {getAssignedAccountantName(client.assigned_accountant_id)}
                    </Badge>
                  </div>
                  
                  <Select
                    value={client.assigned_accountant_id || "unassigned"}
                    onValueChange={(v) => onAssignAccountant(client.id, v === "unassigned" ? "" : v)}
                  >
                    <SelectTrigger className="w-full">
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
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
