import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Shield, MapPin, Users, BarChart3, LogOut, Plus, Eye } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { SortableAreaCard } from "./SortableAreaCard";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";
import { AreaHeadsManager } from "./AreaHeadsManager";

type Area = Tables<"areas">;

interface AreaStat {
  area_id: string;
  area_name: string;
  slug: string;
  visit_count: number;
}

export default function SuperAdminDashboard() {
  const { signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [stats, setStats] = useState<AreaStat[]>([]);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignPassword, setAssignPassword] = useState("");
  const [assignAreaId, setAssignAreaId] = useState("");
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaSlug, setNewAreaSlug] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stats.findIndex((s) => s.area_id === active.id);
    const newIndex = stats.findIndex((s) => s.area_id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(stats, oldIndex, newIndex);
    setStats(reordered);

    // Persist new order — sequential 1..n
    const updates = reordered.map((s, i) =>
      supabase.from("areas").update({ display_order: i + 1 }).eq("id", s.area_id)
    );
    const results = await Promise.all(updates);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      toast({ title: "Error saving order", description: failed.error.message, variant: "destructive" });
      fetchData();
    }
  };

  const fetchData = async () => {
    const { data: areasData } = await supabase
      .from("areas")
      .select("*")
      .order("display_order", { ascending: true })
      .order("slug", { ascending: true });
    if (areasData) setAreas(areasData);

    // Fetch visit counts per area
    const { data: visits } = await supabase.from("area_visits").select("area_id");
    if (visits && areasData) {
      const counts: Record<string, number> = {};
      visits.forEach((v) => {
        counts[v.area_id] = (counts[v.area_id] || 0) + 1;
      });
      setStats(
        areasData.map((a) => ({
          area_id: a.id,
          area_name: a.name,
          slug: a.slug,
          visit_count: counts[a.id] || 0,
        }))
      );
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateArea = async () => {
    if (!newAreaName || !newAreaSlug) return;
    const { error } = await supabase.from("areas").insert({ name: newAreaName, slug: newAreaSlug.toLowerCase().replace(/\s+/g, "") });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Area created" });
      setNewAreaName("");
      setNewAreaSlug("");
      setDialogOpen(false);
      fetchData();
    }
  };

  const handleAssignHead = async () => {
    console.log("[AssignHead] clicked", { assignEmail, assignAreaId, hasPassword: !!assignPassword });
    if (!assignEmail || !assignPassword || !assignAreaId) {
      toast({ title: "Missing fields", description: "Email, password and area are required", variant: "destructive" });
      return;
    }
    if (assignPassword.length < 6) {
      toast({ title: "Weak password", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-user", {
        body: {
          email: assignEmail,
          password: assignPassword,
          role: "area_head",
          area_id: assignAreaId,
        },
      });

      console.log("[AssignHead] response", { data, error });

      if (error || (data as { error?: string })?.error) {
        toast({
          title: "Error",
          description: error?.message || (data as { error?: string })?.error || "Failed to assign",
          variant: "destructive",
        });
        return;
      }

      toast({ title: "Area Head assigned", description: `${assignEmail} can now sign in` });
      setAssignEmail("");
      setAssignPassword("");
      setAssignAreaId("");
      setAssignDialogOpen(false);
    } catch (err) {
      console.error("[AssignHead] exception", err);
      toast({
        title: "Network error",
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    }
  };

  const totalVisits = stats.reduce((sum, s) => sum + s.visit_count, 0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Super Admin</h1>
              <p className="text-xs text-muted-foreground">NFC Campaign Manager</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <ChangePasswordDialog />
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4 mr-2" /> Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 space-y-8">
        {/* Stats Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Total Areas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{areas.length}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Eye className="w-4 h-4" />
              <span className="text-sm">Total Visits</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{totalVisits}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-4 h-4" />
              <span className="text-sm">Active Areas</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{areas.filter((a) => a.is_active).length}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 flex-wrap">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button><Plus className="w-4 h-4 mr-2" /> Create Area</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Area</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Area Name</Label>
                  <Input value={newAreaName} onChange={(e) => setNewAreaName(e.target.value)} placeholder="Area 6" />
                </div>
                <div className="space-y-2">
                  <Label>URL Slug</Label>
                  <Input value={newAreaSlug} onChange={(e) => setNewAreaSlug(e.target.value)} placeholder="area6" />
                </div>
                <Button onClick={handleCreateArea} className="w-full">Create</Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Users className="w-4 h-4 mr-2" /> Assign Area Head</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Assign Area Head</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input value={assignEmail} onChange={(e) => setAssignEmail(e.target.value)} placeholder="head@campaign.com" />
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" value={assignPassword} onChange={(e) => setAssignPassword(e.target.value)} placeholder="At least 6 characters" />
                </div>
                <div className="space-y-2">
                  <Label>Area</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={assignAreaId}
                    onChange={(e) => setAssignAreaId(e.target.value)}
                  >
                    <option value="">Select area</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={handleAssignHead} className="w-full">Assign</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Areas Grid with Analytics */}
        <div>
          <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Area Analytics
          </h2>
          <p className="text-sm text-muted-foreground mb-3">Drag the handle on each card to reorder.</p>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={stats.map((s) => s.area_id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.map((stat) => (
                  <SortableAreaCard
                    key={stat.area_id}
                    id={stat.area_id}
                    name={stat.area_name}
                    slug={stat.slug}
                    visitCount={stat.visit_count}
                    onEdit={() => navigate(`/dashboard?area=${stat.area_id}`)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <AreaHeadsManager />
      </main>
    </div>
  );
}
