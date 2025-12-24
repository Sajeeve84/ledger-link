import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL } from "@/lib/api";
import { FileUp, Lock, ArrowLeft, CheckCircle } from "lucide-react";
import { z } from "zod";


const passwordSchema = z.string().min(6, "Password must be at least 6 characters");

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = searchParams.get("token");
  const apiOverride = searchParams.get("api");
  const effectiveApiBaseUrl = (apiOverride || API_BASE_URL).replace(/\/+$/, "");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [debug, setDebug] = useState<{ status?: number; json?: any; api?: string } | null>(null);

  useEffect(() => {
    if (!token) {
      toast({
        title: "Invalid Link",
        description: "This password reset link is invalid.",
        variant: "destructive",
      });
    }
  }, [token, toast]);

  const validate = () => {
    const newErrors: typeof errors = {};

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (password !== confirmPassword) {
      newErrors.confirm = "Passwords do not match";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !token) return;

    setLoading(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      console.log("ResetPassword: submitting", {
        apiBase: effectiveApiBaseUrl,
        tokenPreview: token.slice(0, 8) + "...",
      });

      const res = await fetch(`${effectiveApiBaseUrl}/auth/reset-password.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
        signal: controller.signal,
      });

      const json = await res.json().catch(() => ({}));
      setDebug({ status: res.status, json, api: effectiveApiBaseUrl });
      console.log("ResetPassword: response", { status: res.status, json });

      if (!res.ok || json?.error) {
        toast({
          title: "Reset Failed",
          description: json?.error || `Reset failed (HTTP ${res.status}).`,
          variant: "destructive",
        });
        return;
      }

      setSuccess(true);
      toast({
        title: "Password Reset!",
        description: "Your password has been reset successfully.",
      });
    } catch (error: any) {
      console.error("ResetPassword: unexpected error", error);
      toast({
        title: "Error",
        description:
          error?.name === "AbortError"
            ? `Request timed out. (API: ${effectiveApiBaseUrl})`
            : `Something went wrong. (API: ${effectiveApiBaseUrl})`,
        variant: "destructive",
      });
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mx-auto">
            <Lock className="w-8 h-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Invalid Reset Link</h1>
          <p className="text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <Link to="/auth">
            <Button variant="outline">Back to Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-md text-center space-y-6 animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-success/10 flex items-center justify-center mx-auto">
            <CheckCircle className="w-8 h-8 text-success" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Password Reset!</h1>
          <p className="text-muted-foreground">
            Your password has been reset successfully. You can now sign in with your new password.
          </p>
          <Link to="/auth">
            <Button variant="hero" size="lg">Sign In</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <Link to="/auth" className="flex items-center gap-2 text-primary-foreground hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Sign In</span>
        </Link>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <FileUp className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-primary-foreground">DocuFlow</span>
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Reset Your Password
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Create a new secure password for your account.
          </p>
        </div>
        <p className="text-primary-foreground/60 text-sm">© 2024 DocuFlow. Secure document management.</p>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden mb-8">
            <Link to="/auth" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Sign In</span>
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">Create New Password</h2>
            <p className="text-muted-foreground mt-2">Enter your new password below</p>
            {!apiOverride && (
              <p className="text-xs text-destructive mt-2">
                This reset link is missing the <code>api=</code> parameter. Request a NEW reset email from the same environment you’re using.
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-2 break-all">Reset API: {effectiveApiBaseUrl}</p>
          </div>


          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">New Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.confirm && <p className="text-sm text-destructive">{errors.confirm}</p>}
            </div>

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Resetting..." : "Reset Password"}
            </Button>

            {debug && (
              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
                <div className="break-all"><span className="font-medium">Debug API:</span> {debug.api}</div>
                <div><span className="font-medium">HTTP:</span> {debug.status ?? "-"}</div>
                <div className="break-all"><span className="font-medium">Response:</span> {typeof debug.json === "string" ? debug.json : JSON.stringify(debug.json)}</div>
              </div>
            )}

          </form>
        </div>
      </div>
    </div>
  );
}
