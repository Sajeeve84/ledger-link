import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FirmDashboard from "@/components/dashboard/FirmDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  switch (userRole) {
    case "firm":
      return <FirmDashboard />;
    case "accountant":
      return <AccountantDashboard />;
    case "client":
      return <ClientDashboard />;
    default:
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center space-y-4">
            <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
            <p className="text-muted-foreground">Setting up your account...</p>
          </div>
        </div>
      );
  }
}
