import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PRESETS = {
  local: "http://localhost/docuflow-api/api",
  production: "http://ledger-link.developer.io/api",
  custom: "",
};

export default function ApiSettings() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<"local" | "production" | "custom">("local");
  const [customUrl, setCustomUrl] = useState("");
  const [currentUrl, setCurrentUrl] = useState("");

  useEffect(() => {
    const stored = localStorage.getItem("API_BASE_URL") || "";
    setCurrentUrl(stored || getCurrentDefault());

    if (!stored || stored === PRESETS.local) {
      setPreset("local");
    } else if (stored === PRESETS.production) {
      setPreset("production");
    } else {
      setPreset("custom");
      setCustomUrl(stored);
    }
  }, [open]);

  const getCurrentDefault = () => {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1") {
      return PRESETS.local;
    }
    return PRESETS.production;
  };

  const handleSave = () => {
    let url = "";
    if (preset === "local") {
      url = PRESETS.local;
    } else if (preset === "production") {
      url = PRESETS.production;
    } else {
      url = customUrl.trim().replace(/\/+$/, "");
    }

    if (url) {
      localStorage.setItem("API_BASE_URL", url);
    } else {
      localStorage.removeItem("API_BASE_URL");
    }

    toast({
      title: "API Settings Updated",
      description: `Backend URL set to: ${url || "auto-detect"}`,
    });

    setOpen(false);

    // Reload to apply new API base URL
    setTimeout(() => window.location.reload(), 500);
  };

  const handleClear = () => {
    localStorage.removeItem("API_BASE_URL");
    toast({
      title: "API Settings Cleared",
      description: "Using auto-detected backend URL",
    });
    setOpen(false);
    setTimeout(() => window.location.reload(), 500);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" title="API Settings">
          <Settings className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>API Backend Settings</DialogTitle>
          <DialogDescription>
            Configure which PHP backend the app connects to.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Current Backend</Label>
            <code className="block p-2 bg-muted rounded text-xs break-all">
              {currentUrl}
            </code>
          </div>

          <div className="space-y-2">
            <Label>Backend Environment</Label>
            <Select value={preset} onValueChange={(v) => setPreset(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="local">
                  Local (XAMPP) - localhost
                </SelectItem>
                <SelectItem value="production">
                  Production - ledger-link.developer.io
                </SelectItem>
                <SelectItem value="custom">
                  Custom URL
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {preset === "custom" && (
            <div className="space-y-2">
              <Label>Custom API URL</Label>
              <Input
                placeholder="https://yourdomain.com/api"
                value={customUrl}
                onChange={(e) => setCustomUrl(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={handleClear}>
            Reset to Auto
          </Button>
          <Button onClick={handleSave}>
            <Check className="h-4 w-4 mr-2" />
            Save & Reload
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
