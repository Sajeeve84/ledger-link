import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Building, Mail, Users, FileText } from "lucide-react";

interface Accountant {
  id: string;
  accountant_id: string;
  profiles: { full_name: string | null; email: string } | null;
  clientCount?: number;
}

interface FirmAccountantsPageProps {
  accountants: Accountant[];
  clientsByAccountant: Record<string, number>;
}

export default function FirmAccountantsPage({ accountants, clientsByAccountant }: FirmAccountantsPageProps) {
  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Accountants</h2>
          <p className="text-muted-foreground">{accountants.length} team members</p>
        </div>
      </div>

      {/* Accountants Grid */}
      {accountants.length === 0 ? (
        <Card className="shadow-md border-border/50">
          <CardContent className="py-12">
            <div className="text-center">
              <Building className="w-12 h-12 mx-auto text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground">
                No accountants yet. Invite your first team member to get started.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accountants.map((accountant) => {
            const clientCount = clientsByAccountant[accountant.accountant_id] || 0;
            
            return (
              <Card key={accountant.id} className="shadow-md border-border/50 hover:shadow-lg transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-primary font-semibold text-lg">
                        {accountant.profiles?.full_name?.charAt(0) || accountant.profiles?.email?.charAt(0) || "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-foreground truncate">
                        {accountant.profiles?.full_name || "Unnamed Accountant"}
                      </h3>
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-0.5">
                        <Mail className="w-3.5 h-3.5" />
                        <span className="truncate">{accountant.profiles?.email}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      Assigned Clients
                    </span>
                    <Badge variant="secondary" className="text-sm">
                      {clientCount} {clientCount === 1 ? "client" : "clients"}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
