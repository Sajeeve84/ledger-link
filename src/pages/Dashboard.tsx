import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import FirmDashboard from "@/components/dashboard/FirmDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import ClientDashboard from "@/components/dashboard/ClientDashboard";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const isNative = Capacitor.isNativePlatform();
  const authPath = isNative ? "/auth?app=client" : "/auth";

  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate(authPath, { replace: true });
    }
  }, [user, loading, navigate, authPath]);

  // Start role-loading window whenever we have an authenticated user.
  useEffect(() => {
    if (!loading && user) {
      setRoleLoading(true);
      const timeout = setTimeout(() => setRoleLoading(false), 2000);
      return () => clearTimeout(timeout);
    }
    setRoleLoading(false);
  }, [loading, user]);

  // If role arrives, stop the role-loading state.
  useEffect(() => {
    if (userRole) setRoleLoading(false);
  }, [userRole]);

  // If role never arrives, treat as unauthenticated/misconfigured and go back to auth.
  useEffect(() => {
    if (!loading && user && !roleLoading && !userRole) {
      navigate(authPath, { replace: true });
    }
  }, [loading, user, roleLoading, userRole, navigate, authPath]);

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

  if (roleLoading && !userRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-accent mx-auto" />
          <p className="text-muted-foreground">Setting up your account...</p>
        </div>
      </div>
    );
  }

  switch (userRole) {
    case "firm":
      return <FirmDashboard />;
    case "accountant":
      return <AccountantDashboard />;
    case "client":
      return <ClientDashboard />;
    default:
      return null;
  }
}
