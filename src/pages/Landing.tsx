import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileUp, Shield, Users, Bell, CheckCircle, ArrowRight } from "lucide-react";

const features = [
  {
    icon: FileUp,
    title: "Easy Document Upload",
    description: "Clients can snap photos or upload documents directly from their mobile device",
  },
  {
    icon: Users,
    title: "Team Management",
    description: "Firms can assign clients to accountants and track all document workflows",
  },
  {
    icon: Bell,
    title: "Real-time Notifications",
    description: "Stay updated with instant alerts when documents are uploaded or require action",
  },
  {
    icon: Shield,
    title: "Secure & Compliant",
    description: "Bank-level security ensures your sensitive financial documents are protected",
  },
];

const steps = [
  { step: "1", title: "Client Uploads", description: "Clients capture or upload invoices and receipts" },
  { step: "2", title: "Accountant Reviews", description: "Your team gets notified and processes documents" },
  { step: "3", title: "Status Updates", description: "Clients receive updates on their document status" },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass border-b border-border/50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
              <FileUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">DocuFlow</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link to="/auth?mode=signup">
              <Button variant="accent">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6 animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent border border-accent/20">
              <CheckCircle className="w-4 h-4" />
              <span className="text-sm font-medium">Trusted by 500+ Accounting Firms</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-foreground leading-tight">
              Streamline Your
              <br />
              <span className="text-accent">Document Workflow</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Connect your clients with your accounting team through a simple, secure document management platform.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Link to="/auth?mode=signup">
                <Button variant="hero" size="xl">
                  Register Your Firm
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button variant="outline" size="xl">
                  Sign In
                </Button>
              </Link>
            </div>
          </div>

          {/* Hero Visual */}
          <div className="mt-16 relative animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <div className="aspect-video rounded-2xl bg-gradient-to-br from-primary/5 to-accent/5 border border-border/50 overflow-hidden shadow-lg">
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="grid grid-cols-3 gap-4 p-8 w-full max-w-4xl">
                  <div className="col-span-2 bg-card rounded-xl p-6 shadow-md border border-border/50">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <FileUp className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Invoice_March_2024.pdf</p>
                        <p className="text-sm text-muted-foreground">Uploaded 2 min ago</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 rounded-full bg-warning/10 text-warning text-xs font-medium">Pending Review</span>
                    </div>
                  </div>
                  <div className="bg-card rounded-xl p-4 shadow-md border border-border/50">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-accent">24</p>
                      <p className="text-sm text-muted-foreground">Documents Today</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 px-4 bg-secondary/30">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Everything You Need
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              A complete solution for managing accounting documents between your firm and clients
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <div
                key={feature.title}
                className="bg-card rounded-xl p-6 shadow-md border border-border/50 hover:shadow-lg transition-all duration-300 animate-slide-up"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              How It Works
            </h2>
            <p className="text-muted-foreground text-lg">
              Simple, efficient workflow in three easy steps
            </p>
          </div>
          <div className="relative">
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border hidden md:block" />
            <div className="grid md:grid-cols-3 gap-8">
              {steps.map((item, index) => (
                <div
                  key={item.step}
                  className="relative text-center animate-slide-up"
                  style={{ animationDelay: `${index * 0.15}s` }}
                >
                  <div className="w-16 h-16 rounded-full gradient-primary text-primary-foreground text-2xl font-bold flex items-center justify-center mx-auto mb-4 relative z-10 shadow-lg">
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{item.title}</h3>
                  <p className="text-muted-foreground">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 gradient-primary">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-primary-foreground mb-4">
            Ready to Streamline Your Workflow?
          </h2>
          <p className="text-primary-foreground/80 text-lg mb-8 max-w-2xl mx-auto">
            Join hundreds of accounting firms who have simplified their document management with DocuFlow
          </p>
          <Link to="/auth?mode=signup">
            <Button variant="secondary" size="xl">
              Get Started Free
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded gradient-primary flex items-center justify-center">
              <FileUp className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">DocuFlow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            © 2024 DocuFlow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
