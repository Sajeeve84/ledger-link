import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Capacitor } from "@capacitor/core";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authApi } from "@/lib/api";
import { FileUp, Mail, Lock, User, Building, ArrowLeft, Loader2 } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

export default function Auth() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const { toast } = useToast();

  const isClientApp = Capacitor.isNativePlatform() || searchParams.get("app") === "client";

  const [isSignUp, setIsSignUp] = useState(!isClientApp && searchParams.get("mode") === "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});

  // Forgot password state
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotError, setForgotError] = useState("");

  useEffect(() => {
    if (user) {
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const validate = () => {
    const newErrors: typeof errors = {};

    const emailResult = emailSchema.safeParse(email);
    if (!emailResult.success) {
      newErrors.email = emailResult.error.errors[0].message;
    }

    const passwordResult = passwordSchema.safeParse(password);
    if (!passwordResult.success) {
      newErrors.password = passwordResult.error.errors[0].message;
    }

    if (isSignUp) {
      const nameResult = nameSchema.safeParse(fullName);
      if (!nameResult.success) {
        newErrors.name = nameResult.error.errors[0].message;
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) return;

    setLoading(true);

    try {
      if (isSignUp) {
        // Only firms can self-register
        const { error } = await signUp(email, password, fullName, "firm");
        if (error) {
          toast({
            title: "Sign up failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Account created!",
            description: "Welcome to DocuFlow. Redirecting to dashboard...",
          });
          navigate("/dashboard");
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          toast({
            title: "Sign in failed",
            description: error.message,
            variant: "destructive",
          });
        } else {
          toast({
            title: "Welcome back!",
            description: "Redirecting to dashboard...",
          });
          navigate("/dashboard");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");

    const emailResult = emailSchema.safeParse(forgotEmail);
    if (!emailResult.success) {
      setForgotError(emailResult.error.errors[0].message);
      return;
    }

    setForgotLoading(true);

    try {
      const response = await authApi.forgotPassword(forgotEmail);

      if (response.error) {
        setForgotError(response.error);
      } else {
        setForgotSent(true);
        // If in development and token is returned, show reset link
        if (response.reset_token) {
          toast({
            title: "Reset Link Generated",
            description: "Check console for reset link (development only)",
          });
          console.log(`Reset password link: ${window.location.origin}/reset-password?token=${response.reset_token}`);
        }
      }
    } catch (error) {
      setForgotError("Something went wrong. Please try again.");
    } finally {
      setForgotLoading(false);
    }
  };

  const closeForgotDialog = () => {
    setForgotPasswordOpen(false);
    setForgotEmail("");
    setForgotSent(false);
    setForgotError("");
  };

  // Mobile-only client sign-in
  if (isClientApp) {
    return (
      <div className="min-h-screen bg-background flex flex-col safe-area-top safe-area-bottom">
        {/* Header */}
        <div className="gradient-primary px-6 pt-12 pb-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="w-10 h-10 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <FileUp className="w-6 h-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-primary-foreground">DocuFlow</span>
          </div>
          <h1 className="text-xl font-semibold text-primary-foreground">Client Sign In</h1>
          <p className="text-primary-foreground/80 text-sm mt-1">
            Upload documents & track status
          </p>
        </div>

        {/* Form */}
        <div className="flex-1 px-6 -mt-8">
          <div className="bg-card rounded-2xl shadow-lg p-6 space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-foreground">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-foreground">Password</Label>
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="text-sm text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 h-12"
                  />
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              </div>

              <Button
                type="submit"
                variant="hero"
                size="lg"
                className="w-full h-12"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>

            <div className="pt-4 border-t border-border">
              <p className="text-center text-muted-foreground text-sm">
                New here? Check your email for an invitation link from your accounting firm.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 text-center">
          <p className="text-muted-foreground/60 text-xs">© 2024 DocuFlow</p>
        </div>

        {/* Forgot Password Dialog */}
        <Dialog open={forgotPasswordOpen} onOpenChange={closeForgotDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Reset Password</DialogTitle>
              <DialogDescription>
                {forgotSent
                  ? "Check your email for a password reset link."
                  : "Enter your email address and we'll send you a link to reset your password."}
              </DialogDescription>
            </DialogHeader>
            {!forgotSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgotEmail">Email</Label>
                  <Input
                    id="forgotEmail"
                    type="email"
                    placeholder="you@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                  />
                  {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
                </div>
                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={closeForgotDialog} className="flex-1">
                    Cancel
                  </Button>
                  <Button type="submit" disabled={forgotLoading} className="flex-1">
                    {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  If an account with that email exists, you will receive a password reset link shortly.
                </p>
                <Button onClick={closeForgotDialog} className="w-full">
                  Close
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // Web app auth (firms/accountants)
  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 gradient-primary p-12 flex-col justify-between">
        <Link to="/" className="flex items-center gap-2 text-primary-foreground hover:opacity-80 transition-opacity">
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Home</span>
        </Link>
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary-foreground/20 flex items-center justify-center">
              <FileUp className="w-7 h-7 text-primary-foreground" />
            </div>
            <span className="text-3xl font-bold text-primary-foreground">DocuFlow</span>
          </div>
          <h1 className="text-4xl font-bold text-primary-foreground leading-tight">
            Simplify Your
            <br />
            Document Management
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            Connect your accounting firm with clients through a seamless, secure document workflow.
          </p>
        </div>
        <p className="text-primary-foreground/60 text-sm">© 2024 DocuFlow. Secure document management.</p>
      </div>

      {/* Right Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          <div className="lg:hidden mb-8">
            <Link to="/" className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Link>
          </div>

          <div className="text-center lg:text-left">
            <h2 className="text-2xl font-bold text-foreground">
              {isSignUp ? "Register Your Firm" : "Welcome back"}
            </h2>
            <p className="text-muted-foreground mt-2">
              {isSignUp ? "Create your accounting firm account" : "Sign in to access your dashboard"}
            </p>
            {isSignUp && (
              <p className="text-sm text-muted-foreground mt-1">
                Accountants and clients are invited by firm administrators.
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <>
                <div className="p-4 rounded-lg border-2 border-accent bg-accent/5">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                      <Building className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">Accounting Firm</p>
                      <p className="text-sm text-muted-foreground">Manage your firm and team</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fullName" className="text-foreground">Full Name</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                    <Input
                      id="fullName"
                      type="text"
                      placeholder="John Doe"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                  {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">Password</Label>
                {!isSignUp && (
                  <button
                    type="button"
                    onClick={() => setForgotPasswordOpen(true)}
                    className="text-sm text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
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

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={loading}
            >
              {loading ? "Please wait..." : isSignUp ? "Register Firm" : "Sign In"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-accent hover:underline font-medium"
            >
              {isSignUp ? "Sign in" : "Register your firm"}
            </button>
          </p>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotPasswordOpen} onOpenChange={closeForgotDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              {forgotSent
                ? "Check your email for a password reset link."
                : "Enter your email address and we'll send you a link to reset your password."}
            </DialogDescription>
          </DialogHeader>
          {!forgotSent ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="forgotEmailWeb">Email</Label>
                <Input
                  id="forgotEmailWeb"
                  type="email"
                  placeholder="you@example.com"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                />
                {forgotError && <p className="text-sm text-destructive">{forgotError}</p>}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={closeForgotDialog} className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={forgotLoading} className="flex-1">
                  {forgotLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Reset Link"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                If an account with that email exists, you will receive a password reset link shortly.
              </p>
              <Button onClick={closeForgotDialog} className="w-full">
                Close
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
