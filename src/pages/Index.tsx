import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, Smartphone, Zap, BarChart3 } from "lucide-react";

export default function Index() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-foreground text-lg">NFC Campaign</span>
          </div>
          <Button onClick={() => navigate("/login")}>Admin Login</Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-16 animate-fade-in">
          <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 leading-tight">
            NFC-Powered<br />Campaign Management
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Control what your audience sees when they tap NFC cards. Update content instantly, schedule messages, and track engagement — all from one dashboard.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 animate-slide-up">
          <div className="stat-card items-center text-center">
            <Smartphone className="w-10 h-10 text-primary mb-2" />
            <h3 className="font-bold text-foreground">Tap & Go</h3>
            <p className="text-sm text-muted-foreground">NFC cards point to fixed URLs. Content updates instantly.</p>
          </div>
          <div className="stat-card items-center text-center">
            <Zap className="w-10 h-10 text-secondary mb-2" />
            <h3 className="font-bold text-foreground">Real-time Control</h3>
            <p className="text-sm text-muted-foreground">Switch between redirects, landing pages, and videos.</p>
          </div>
          <div className="stat-card items-center text-center">
            <BarChart3 className="w-10 h-10 text-primary mb-2" />
            <h3 className="font-bold text-foreground">Analytics</h3>
            <p className="text-sm text-muted-foreground">Track visits per area and optimize your campaign.</p>
          </div>
        </div>
      </main>
    </div>
  );
}
