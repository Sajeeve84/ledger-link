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
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate(isNative ? "/auth?app=client" : "/auth");
    }
  }, [user, loading, navigate, isNative]);

  // Track role loading separately - give it time to fetch after auth loads
  useEffect(() => {
    if (!loading && user) {
      // Allow time for role to be fetched
      const timeout = setTimeout(() => {
        setRoleLoading(false);
      }, 2000);
      return () => clearTimeout(timeout);
    } else if (!loading && !user) {
      setRoleLoading(false);
    }
  }, [loading, user, userRole]);

  // Reset role loading when userRole changes
  useEffect(() => {
    if (userRole) {
      setRoleLoading(false);
    }
  }, [userRole]);

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

  // Show loading while role is being fetched
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
      // Role not found after loading - redirect to auth
      navigate(isNative ? "/auth?app=client" : "/auth");
      return null;
  }
}
