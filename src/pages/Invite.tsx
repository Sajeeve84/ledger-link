import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Mail, Lock, User, ArrowLeft, Users, Building } from "lucide-react";
import { z } from "zod";

const emailSchema = z.string().email("Please enter a valid email address");
const passwordSchema = z.string().min(6, "Password must be at least 6 characters");
const nameSchema = z.string().min(2, "Name must be at least 2 characters");

type InviteRole = "accountant" | "client";

export default function Invite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const token = searchParams.get("token");
  const roleParam = searchParams.get("role") as InviteRole | null;
  const firmIdParam = searchParams.get("firm");
  const emailParam = searchParams.get("email");

  const [email, setEmail] = useState(emailParam || "");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; name?: string }>({});
  const [validInvite, setValidInvite] = useState(false);
  const [role, setRole] = useState<InviteRole | null>(roleParam);
  const [firmId, setFirmId] = useState<string | null>(firmIdParam);

  useEffect(() => {
    // Validate invite parameters
    if (roleParam && firmIdParam && (roleParam === "accountant" || roleParam === "client")) {
      setValidInvite(true);
      setRole(roleParam);
      setFirmId(firmIdParam);
    }
  }, [roleParam, firmIdParam]);

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
    
    if (!validate() || !role || !firmId) return;
    
    setLoading(true);

    try {
      const redirectUrl = `${window.location.origin}/`;
      
      // Sign up the user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        toast({
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
        return;
      }

      if (data.user) {
        // Add user role
        const { error: roleError } = await supabase
          .from("user_roles")
          .insert({ user_id: data.user.id, role });

        if (roleError) {
          toast({
            title: "Error",
            description: "Failed to set user role",
            variant: "destructive",
          });
          return;
        }

        // Link to firm based on role
        if (role === "accountant") {
          const { error: linkError } = await supabase
            .from("firm_accountants")
            .insert({ firm_id: firmId, accountant_id: data.user.id });

          if (linkError) {
            toast({
              title: "Error",
              description: "Failed to link to firm",
              variant: "destructive",
            });
            return;
          }
        } else if (role === "client") {
          const { error: linkError } = await supabase
            .from("clients")
            .insert({ 
              firm_id: firmId, 
              user_id: data.user.id,
              company_name: companyName || null
            });

          if (linkError) {
            toast({
              title: "Error",
              description: "Failed to link to firm",
              variant: "destructive",
            });
            return;
          }
        }

        toast({
          title: "Account created!",
          description: "Welcome to DocuFlow. Redirecting to dashboard...",
        });
        navigate("/dashboard");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!validInvite) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h1 className="text-2xl font-bold text-foreground">Invalid Invitation</h1>
          <p className="text-muted-foreground">
            This invitation link is invalid or has expired.
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

  const RoleIcon = role ? roleInfo[role].icon : Users;

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
            {role && roleInfo[role].description}
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
                  <p className="font-medium text-foreground">{role && roleInfo[role].label}</p>
                  <p className="text-sm text-muted-foreground">{role && roleInfo[role].description}</p>
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
            {role === "client" && (
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
                  readOnly={!!emailParam}
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