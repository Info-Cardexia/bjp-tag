import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  LogOut, Eye, Link2, Layout, Video, Plus, Trash2, Save, BarChart3,
  Phone, MessageCircle, ExternalLink, Users, Upload, GripVertical,
} from "lucide-react";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ChangePasswordDialog } from "@/components/ChangePasswordDialog";

type Area = Tables<"areas">;
type AreaContent = Tables<"area_content">;

interface LandingButton {
  id: string;
  label: string;
  url: string;
  type: "call" | "whatsapp" | "link" | "join";
}

interface SocialLink {
  id: string;
  platform: string;
  url: string;
}

type SectionKey = "image" | "video" | "buttons" | "socials";
const DEFAULT_SECTION_ORDER: SectionKey[] = ["image", "video", "buttons", "socials"];
const SECTION_LABELS: Record<SectionKey, string> = {
  image: "Banner Image",
  video: "Embedded Video",
  buttons: "Action Buttons",
  socials: "Social Media Links",
};

const MODE_ICONS = {
  redirect: <Link2 className="w-4 h-4" />,
  landing: <Layout className="w-4 h-4" />,
  video: <Video className="w-4 h-4" />,
};

const newId = () => Math.random().toString(36).slice(2, 11);

function SortableRow({ id, children }: { id: string; children: (handle: React.ReactNode) => React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  const handle = (
    <button
      type="button"
      className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground p-2"
      {...attributes}
      {...listeners}
      aria-label="Drag to reorder"
    >
      <GripVertical className="w-4 h-4" />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className="flex gap-2 items-start">
      {children(handle)}
    </div>
  );
}

export default function AreaHeadDashboard({ areaId, isSuperAdmin }: { areaId: string; isSuperAdmin?: boolean }) {
  const { signOut, user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [area, setArea] = useState<Area | null>(null);
  const [contents, setContents] = useState<AreaContent[]>([]);
  const [visitCount, setVisitCount] = useState(0);
  const [editingContent, setEditingContent] = useState<AreaContent | null>(null);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [mode, setMode] = useState<"redirect" | "landing" | "video">("landing");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [landingTitle, setLandingTitle] = useState("");
  const [landingDesc, setLandingDesc] = useState("");
  const [landingImage, setLandingImage] = useState("");
  const [buttons, setButtons] = useState<LandingButton[]>([]);
  const [socialLinks, setSocialLinks] = useState<SocialLink[]>([]);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoType, setVideoType] = useState("youtube");
  const [isActive, setIsActive] = useState(true);
  const [priority, setPriority] = useState(0);
  const [sectionOrder, setSectionOrder] = useState<SectionKey[]>(DEFAULT_SECTION_ORDER);

  const fetchData = useCallback(async () => {
    const { data: areaData } = await supabase.from("areas").select("*").eq("id", areaId).single();
    if (areaData) setArea(areaData);

    const { data: contentData } = await supabase
      .from("area_content")
      .select("*")
      .eq("area_id", areaId)
      .order("priority", { ascending: false });
    if (contentData) setContents(contentData);

    const { count } = await supabase
      .from("area_visits")
      .select("*", { count: "exact", head: true })
      .eq("area_id", areaId);
    setVisitCount(count || 0);
  }, [areaId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Auto-load the most recent content into the form so saves UPDATE it
  // instead of overwriting it with empty values from a fresh form.
  useEffect(() => {
    if (!editingContent && contents.length > 0) {
      loadContent(contents[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contents]);

  const resetForm = () => {
    setEditingContent(null);
    setMode("landing");
    setRedirectUrl("");
    setLandingTitle("");
    setLandingDesc("");
    setLandingImage("");
    setButtons([]);
    setSocialLinks([]);
    setVideoUrl("");
    setVideoType("youtube");
    setIsActive(true);
    setPriority(0);
    setSectionOrder(DEFAULT_SECTION_ORDER);
  };

  const loadContent = (c: AreaContent) => {
    setEditingContent(c);
    setMode(c.content_mode as "redirect" | "landing" | "video");
    setRedirectUrl(c.redirect_url || "");
    setLandingTitle(c.landing_title || "");
    setLandingDesc(c.landing_description || "");
    setLandingImage(c.landing_image_url || "");
    setButtons(((c.landing_buttons as unknown as LandingButton[] | null) || []).map((b) => ({ ...b, id: b.id || newId() })));
    setSocialLinks(((c.landing_social_links as unknown as SocialLink[] | null) || []).map((s) => ({ ...s, id: s.id || newId() })));
    setVideoUrl(c.video_url || "");
    setVideoType(c.video_type || "youtube");
    setIsActive(c.is_active);
    setPriority(c.priority);
    const rawOrder = (c as unknown as { section_order?: unknown }).section_order;
    const orderArr = Array.isArray(rawOrder) ? (rawOrder as string[]).filter((k): k is SectionKey => DEFAULT_SECTION_ORDER.includes(k as SectionKey)) : [];
    const merged = [...orderArr, ...DEFAULT_SECTION_ORDER.filter((k) => !orderArr.includes(k))];
    setSectionOrder(merged);
  };

  const handleSave = async () => {
    const payload: TablesInsert<"area_content"> = {
      area_id: areaId,
      content_mode: mode,
      redirect_url: mode === "redirect" ? redirectUrl : null,
      landing_title: mode === "landing" ? landingTitle : null,
      landing_description: mode === "landing" ? landingDesc : null,
      landing_image_url: mode === "landing" ? landingImage : null,
      landing_buttons: mode === "landing" ? (buttons as unknown as TablesInsert<"area_content">["landing_buttons"]) : null,
      landing_social_links: mode === "landing" ? (socialLinks as unknown as TablesInsert<"area_content">["landing_social_links"]) : null,
      video_url: mode === "video" || mode === "landing" ? videoUrl || null : null,
      video_type: mode === "video" || (mode === "landing" && videoUrl) ? videoType : null,
      is_active: isActive,
      priority,
      created_by: user?.id,
      ...(mode === "landing" ? { section_order: sectionOrder as unknown as TablesInsert<"area_content">["landing_buttons"] } : {}),
    } as TablesInsert<"area_content">;

    let error;
    let savedRow: AreaContent | null = null;
    if (editingContent) {
      const res = await supabase.from("area_content").update(payload).eq("id", editingContent.id).select().maybeSingle();
      error = res.error;
      savedRow = (res.data as AreaContent | null) ?? null;
    } else {
      const res = await supabase.from("area_content").insert(payload).select().maybeSingle();
      error = res.error;
      savedRow = (res.data as AreaContent | null) ?? null;
    }

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingContent ? "Content updated" : "Content created" });
      if (savedRow) setEditingContent(savedRow);
      fetchData();
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("area_content").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Content deleted" });
      fetchData();
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const path = `${areaId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("campaign-assets").upload(path, file);
    if (error) {
      toast({ title: "Upload failed", description: error.message, variant: "destructive" });
    } else {
      const { data } = supabase.storage.from("campaign-assets").getPublicUrl(path);
      setLandingImage(data.publicUrl);
      toast({ title: "Image uploaded" });
    }
    setUploading(false);
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addButton = () => setButtons([...buttons, { id: newId(), label: "", url: "", type: "link" }]);
  const removeButton = (i: number) => setButtons(buttons.filter((_, idx) => idx !== i));
  const updateButton = (i: number, field: keyof LandingButton, value: string) => {
    const updated = [...buttons];
    (updated[i] as unknown as Record<string, string>)[field] = value;
    setButtons(updated);
  };
  const handleButtonsDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = buttons.findIndex((b) => b.id === active.id);
      const newIdx = buttons.findIndex((b) => b.id === over.id);
      setButtons(arrayMove(buttons, oldIdx, newIdx));
    }
  };

  const addSocialLink = () => setSocialLinks([...socialLinks, { id: newId(), platform: "facebook", url: "" }]);
  const removeSocialLink = (i: number) => setSocialLinks(socialLinks.filter((_, idx) => idx !== i));
  const updateSocialLink = (i: number, field: keyof SocialLink, value: string) => {
    const updated = [...socialLinks];
    updated[i][field] = value;
    setSocialLinks(updated);
  };
  const handleSocialDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = socialLinks.findIndex((s) => s.id === active.id);
      const newIdx = socialLinks.findIndex((s) => s.id === over.id);
      setSocialLinks(arrayMove(socialLinks, oldIdx, newIdx));
    }
  };

  const handleSectionDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (over && active.id !== over.id) {
      const oldIdx = sectionOrder.indexOf(active.id as SectionKey);
      const newIdx = sectionOrder.indexOf(over.id as SectionKey);
      setSectionOrder(arrayMove(sectionOrder, oldIdx, newIdx));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-foreground">{area?.name || "Dashboard"}</h1>
            <p className="text-xs text-muted-foreground">/{area?.slug}</p>
          </div>
          <div className="flex items-center gap-3">
            {isSuperAdmin && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")}>
                ← Back
              </Button>
            )}
            <a href={`/${area?.slug}`} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm"><Eye className="w-4 h-4 mr-1" /> Preview</Button>
            </a>
            <ChangePasswordDialog showLabel={false} size="icon" />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <BarChart3 className="w-4 h-4" />
              <span className="text-sm">Total Visits</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{visitCount}</p>
          </div>
          <div className="stat-card">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Layout className="w-4 h-4" />
              <span className="text-sm">Content Items</span>
            </div>
            <p className="text-3xl font-bold text-foreground">{contents.length}</p>
          </div>
        </div>

        {contents.length > 0 && (
          <div>
            <h2 className="text-lg font-bold text-foreground mb-3">Active Content</h2>
            <div className="space-y-3">
              {contents.map((c) => (
                <Card key={c.id} className="campaign-card">
                  <CardContent className="py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {MODE_ICONS[c.content_mode as keyof typeof MODE_ICONS]}
                      <div>
                        <p className="font-medium text-foreground capitalize">{c.content_mode} Mode</p>
                        <p className="text-xs text-muted-foreground">
                          {c.is_active ? "Active" : "Inactive"}
                          {c.schedule_start && ` • ${c.schedule_start} - ${c.schedule_end}`}
                          {` • Priority: ${c.priority}`}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => loadContent(c)}>Edit</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(c.id)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {editingContent ? "Edit Content" : "Add New Content"}
              {editingContent && (
                <Button variant="ghost" size="sm" onClick={resetForm}>+ New</Button>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <Tabs value={mode} onValueChange={(v) => setMode(v as typeof mode)}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="redirect" className="gap-2">
                  <Link2 className="w-4 h-4" /> Redirect
                </TabsTrigger>
                <TabsTrigger value="landing" className="gap-2">
                  <Layout className="w-4 h-4" /> Landing Page
                </TabsTrigger>
                <TabsTrigger value="video" className="gap-2">
                  <Video className="w-4 h-4" /> Video
                </TabsTrigger>
              </TabsList>

              <TabsContent value="redirect" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Redirect URL</Label>
                  <Input value={redirectUrl} onChange={(e) => setRedirectUrl(e.target.value)} placeholder="https://example.com" />
                </div>
              </TabsContent>

              <TabsContent value="landing" className="space-y-6 mt-4">
                <div className="space-y-2">
                  <Label>Title</Label>
                  <Input value={landingTitle} onChange={(e) => setLandingTitle(e.target.value)} placeholder="Campaign Title" />
                </div>
                <div className="space-y-2">
                  <Label>Description</Label>
                  <Textarea value={landingDesc} onChange={(e) => setLandingDesc(e.target.value)} placeholder="Campaign description..." rows={3} />
                </div>

                <div className="space-y-3 rounded-lg border border-dashed p-3 bg-muted/30">
                  <div>
                    <Label className="text-base">Section Order</Label>
                    <p className="text-xs text-muted-foreground">Drag to reorder how these blocks appear on the public page.</p>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSectionDragEnd}>
                    <SortableContext items={sectionOrder} strategy={verticalListSortingStrategy}>
                      {sectionOrder.map((key) => (
                        <SortableRow key={key} id={key}>
                          {(handle) => (
                            <div className="flex items-center gap-2 flex-1 rounded-md border bg-background px-3 py-2">
                              {handle}
                              <span className="text-sm font-medium text-foreground">{SECTION_LABELS[key]}</span>
                            </div>
                          )}
                        </SortableRow>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="space-y-2">
                  <Label>Banner Image</Label>
                  <div className="flex gap-2">
                    <Input value={landingImage} onChange={(e) => setLandingImage(e.target.value)} placeholder="Image URL or upload" className="flex-1" />
                    <label className="cursor-pointer">
                      <Button variant="outline" asChild disabled={uploading}>
                        <span><Upload className="w-4 h-4 mr-1" />{uploading ? "..." : "Upload"}</span>
                      </Button>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>
                  </div>
                  {landingImage && (
                    <img src={landingImage} alt="Preview" className="w-full h-32 object-cover rounded-lg mt-2" />
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Action Buttons</Label>
                    <Button variant="ghost" size="sm" onClick={addButton}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleButtonsDragEnd}>
                    <SortableContext items={buttons.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                      {buttons.map((btn, i) => (
                        <SortableRow key={btn.id} id={btn.id}>
                          {(handle) => (
                            <>
                              {handle}
                              <select
                                className="h-10 rounded-md border border-input bg-background px-2 text-sm w-28"
                                value={btn.type}
                                onChange={(e) => updateButton(i, "type", e.target.value as any)}
                              >
                                <option value="call">📞 Call</option>
                                <option value="whatsapp">💬 WhatsApp</option>
                                <option value="link">🔗 Link</option>
                                <option value="join">👥 Join</option>
                              </select>
                              <Input
                                value={btn.label}
                                onChange={(e) => updateButton(i, "label", e.target.value)}
                                placeholder="Button label"
                                className="flex-1"
                              />
                              <Input
                                value={btn.url}
                                onChange={(e) => updateButton(i, "url", e.target.value)}
                                placeholder="URL or tel:+..."
                                className="flex-1"
                              />
                              <Button variant="ghost" size="icon" onClick={() => removeButton(i)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </SortableRow>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Social Media Links</Label>
                    <Button variant="ghost" size="sm" onClick={addSocialLink}><Plus className="w-4 h-4 mr-1" /> Add</Button>
                  </div>
                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleSocialDragEnd}>
                    <SortableContext items={socialLinks.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                      {socialLinks.map((link, i) => (
                        <SortableRow key={link.id} id={link.id}>
                          {(handle) => (
                            <>
                              {handle}
                              <select
                                className="h-10 rounded-md border border-input bg-background px-2 text-sm w-32"
                                value={link.platform}
                                onChange={(e) => updateSocialLink(i, "platform", e.target.value)}
                              >
                                <option value="facebook">Facebook</option>
                                <option value="twitter">Twitter/X</option>
                                <option value="instagram">Instagram</option>
                                <option value="youtube">YouTube</option>
                              </select>
                              <Input
                                value={link.url}
                                onChange={(e) => updateSocialLink(i, "url", e.target.value)}
                                placeholder="Profile URL"
                                className="flex-1"
                              />
                              <Button variant="ghost" size="icon" onClick={() => removeSocialLink(i)}>
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </>
                          )}
                        </SortableRow>
                      ))}
                    </SortableContext>
                  </DndContext>
                </div>

                <div className="border-t pt-4 space-y-3">
                  <Label className="text-base">Embedded Video (optional)</Label>
                  <p className="text-xs text-muted-foreground -mt-1">Add a YouTube or direct video URL to show on this landing page.</p>
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                      value={videoType}
                      onChange={(e) => setVideoType(e.target.value)}
                    >
                      <option value="youtube">YouTube</option>
                      <option value="file">Direct File URL</option>
                    </select>
                    <Input
                      className="col-span-2"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="video" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Video Type</Label>
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={videoType}
                    onChange={(e) => setVideoType(e.target.value)}
                  >
                    <option value="youtube">YouTube</option>
                    <option value="file">Direct File URL</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label>Video URL</Label>
                  <Input value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
                </div>
              </TabsContent>
            </Tabs>

            <Button onClick={handleSave} className="w-full h-12 text-base">
              <Save className="w-5 h-5 mr-2" />
              {editingContent ? "Update Content" : "Save Content"}
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
