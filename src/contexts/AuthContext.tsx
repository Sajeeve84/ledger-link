import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { authApi } from "@/lib/api";

type UserRole = "firm" | "accountant" | "client" | null;

interface User {
  id: string;
  email: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
}

interface Session {
  access_token: string;
  expires_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, role: "firm" | "accountant" | "client") => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const checkSession = async () => {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await authApi.getSession();
        if (response.user) {
          setUser(response.user);
          setSession(response.session);
          setUserRole(response.role as UserRole);
        } else {
          // Invalid session, clear storage
          localStorage.removeItem('access_token');
        }
      } catch (error) {
        console.error('Session check failed:', error);
        localStorage.removeItem('access_token');
      }
      
      setLoading(false);
    };

    checkSession();
  }, []);

  const signUp = async (email: string, password: string, fullName: string, role: "firm" | "accountant" | "client") => {
    try {
      const response = await authApi.signUp(email, password, fullName, role);
      
      if (response.error) {
        return { error: new Error(response.error) };
      }

      // Store token and set state
      localStorage.setItem('access_token', response.session.access_token);
      setUser(response.user);
      setSession(response.session);
      setUserRole(response.role as UserRole);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await authApi.signIn(email, password);
      
      if (response.error) {
        return { error: new Error(response.error) };
      }

      // Store token and set state
      localStorage.setItem('access_token', response.session.access_token);
      setUser(response.user);
      setSession(response.session);
      setUserRole(response.role as UserRole);

      return { error: null };
    } catch (error) {
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    try {
      await authApi.signOut();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      setSession(null);
      setUser(null);
      setUserRole(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
