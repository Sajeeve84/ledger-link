import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { invitesApi, authApi, clientsApi, accountantsApi, notificationsApi } from "@/lib/api";
import { FileUp, Mail, Lock, User, ArrowLeft, Users, Building, Loader2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

type InviteRole = "accountant" | "client";

interface TokenData {
  token: string;
  firm_id: string;
  email: string;
  role: InviteRole;
  expires_at: string;
  used_at: string | null;
  firm_name?: string;
  firm_owner_id?: string;
}

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signUp } = useAuth();

  const tokenParam = searchParams.get("token");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const validateToken = async () => {
      if (!tokenParam) {
        setErrorMessage("No invitation token provided");
        setValidating(false);
        return;
      }

      try {
        const res = await invitesApi.validate(tokenParam);
        const invite = res?.data as TokenData | undefined;

        if (!invite) {
          setErrorMessage(res?.error || "Invalid or expired invitation link");
          setValidating(false);
          return;
        }

        // Defensive check (backend should already enforce this)
        if (invite.role !== "accountant" && invite.role !== "client") {
          setErrorMessage("Invalid invitation type");
          setValidating(false);
          return;
        }

        setTokenData(invite);
        setEmail(invite.email);
        setValidating(false);
      } catch {
        setErrorMessage("Failed to validate invitation");
        setValidating(false);
      }
    };

    validateToken();
  }, [tokenParam]);

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

    const nameResult = nameSchema.safeParse(fullName);
    if (!nameResult.success) {
      newErrors.name = nameResult.error.errors[0].message;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate() || !tokenData) return;

    setLoading(true);

    try {
      // 1) Create account (stores token + updates auth state)
      const { error } = await signUp(email, password, fullName, tokenData.role);
      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      // 2) Read back current user id from the backend session
      const sessionRes = await authApi.getSession();
      const userId: string | undefined = sessionRes?.user?.id;

      if (!userId) {
        toast({
          title: "Error",
          description: "Account created, but session could not be established.",
          variant: "destructive",
        });
        return;
      }

      // 3) Link user to firm based on invite role
      if (tokenData.role === "accountant") {
        const { error: linkError } = await accountantsApi.create({
          firm_id: tokenData.firm_id,
          accountant_id: userId,
        });

        if (linkError) {
          toast({
            title: "Error",
            description: linkError,
            variant: "destructive",
          });
          return;
        }
      } else {
        const company = companyName.trim();
        const { error: linkError } = await clientsApi.create({
          firm_id: tokenData.firm_id,
          user_id: userId,
          ...(company ? { company_name: company } : {}),
        });

        if (linkError) {
          toast({
            title: "Error",
            description: linkError,
            variant: "destructive",
          });
          return;
        }
      }

      // 4) Mark invite token used
      const { error: usedError } = await invitesApi.markUsed(tokenData.token);
      if (usedError) {
        toast({
          title: "Warning",
          description: usedError,
          variant: "destructive",
        });
      }

      // 5) Notify firm owner about the new join
      if (tokenData.firm_owner_id) {
        const roleLabel = tokenData.role === "accountant" ? "Accountant" : "Client";
        const userName = fullName || email;
        await notificationsApi.create({
          user_id: tokenData.firm_owner_id,
          title: `New ${roleLabel} Joined`,
          message: `${userName} has joined your firm${tokenData.role === "client" && companyName ? ` (${companyName})` : ""}.`,
        });
      }

      toast({
        title: "Account created!",
        description: "Welcome to DocuFlow. Redirecting to dashboard...",
      });
      navigate("/dashboard");
    } finally {
      setLoading(false);
    }
  };

  // Loading state while validating token
  if (validating) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Validating invitation...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (errorMessage || !tokenData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Invalid Invitation</h1>
          <p className="text-muted-foreground">
            {errorMessage || "This invitation link is invalid or has expired."}
          </p>
          <Link to="/auth">
            <Button variant="outline">Go to Login</Button>
          </Link>
        </div>
      </div>
    );
  }

  const roleInfo = {
    accountant: {
      icon: Users,
      label: "Accountant",
      description: "You've been invited to join a firm as an accountant"
    },
    client: {
      icon: Building,
      label: "Client",
      description: "You've been invited to upload documents to your accounting firm"
    }
  };

  const RoleIcon = roleInfo[tokenData.role].icon;

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
            You're Invited!
          </h1>
          <p className="text-primary-foreground/80 text-lg max-w-md">
            {roleInfo[tokenData.role].description}
          </p>
        </div>
        <p className="text-primary-foreground/60 text-sm">
          © 2024 DocuFlow. Secure document management.
        </p>
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
            <h2 className="text-2xl font-bold text-foreground">Complete Your Registration</h2>
            <p className="text-muted-foreground mt-2">
              Create your account to get started
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Role indicator */}
            <div className="p-4 rounded-lg border-2 border-accent bg-accent/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                  <RoleIcon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{roleInfo[tokenData.role].label}</p>
                  <p className="text-sm text-muted-foreground">{roleInfo[tokenData.role].description}</p>
                </div>
              </div>
            </div>

            {/* Full Name */}
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

            {/* Company Name - only for clients */}
            {tokenData.role === "client" && (
              <div className="space-y-2">
                <Label htmlFor="companyName" className="text-foreground">Company Name (Optional)</Label>
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="companyName"
                    type="text"
                    placeholder="Your Company Ltd."
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            )}

            {/* Email */}
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
                  readOnly
                />
              </div>
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
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
              {loading ? "Please wait..." : "Create Account"}
            </Button>
          </form>

          <p className="text-center text-muted-foreground">
            Already have an account?{" "}
            <Link to="/auth" className="text-accent hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
