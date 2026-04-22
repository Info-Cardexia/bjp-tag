import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Phone, MessageCircle, ExternalLink, Users, Facebook, Twitter, Instagram, Youtube, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

type Area = Tables<"areas">;
type AreaContent = Tables<"area_content">;

interface LandingButton {
  label: string;
  url: string;
  type: "call" | "whatsapp" | "link" | "join";
}

interface SocialLink {
  platform: string;
  url: string;
}

const buttonIcons: Record<string, React.ReactNode> = {
  call: <Phone className="w-5 h-5" />,
  whatsapp: <MessageCircle className="w-5 h-5" />,
  link: <ExternalLink className="w-5 h-5" />,
  join: <Users className="w-5 h-5" />,
};

const socialIcons: Record<string, React.ReactNode> = {
  facebook: <Facebook className="w-5 h-5" />,
  twitter: <Twitter className="w-5 h-5" />,
  instagram: <Instagram className="w-5 h-5" />,
  youtube: <Youtube className="w-5 h-5" />,
};

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") {
      return u.pathname.split("/").filter(Boolean)[0] || null;
    }
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      const parts = u.pathname.split("/").filter(Boolean);
      // /embed/ID, /v/ID, /shorts/ID, /live/ID
      if (["embed", "v", "shorts", "live"].includes(parts[0])) return parts[1] || null;
    }
  } catch {
    // fallback regex for raw IDs or odd inputs
    const m = url.match(/[?&]v=([A-Za-z0-9_-]{11})/) || url.match(/(?:youtu\.be\/|embed\/|shorts\/)([A-Za-z0-9_-]{11})/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(url.trim())) return url.trim();
  }
  return null;
}

export default function AreaPage() {
  const { slug } = useParams<{ slug: string }>();
  const [area, setArea] = useState<Area | null>(null);
  const [content, setContent] = useState<AreaContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      const { data: areaData } = await supabase
        .from("areas")
        .select("*")
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (!areaData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setArea(areaData);

      // Record visit
      await supabase.from("area_visits").insert({
        area_id: areaData.id,
        user_agent: navigator.userAgent,
        referrer: document.referrer || null,
      });

      const { data: contents } = await supabase
        .from("area_content")
        .select("*")
        .eq("area_id", areaData.id)
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("updated_at", { ascending: false });

      if (contents && contents.length > 0) {
        setContent(contents[0]);
      }

      setLoading(false);
    };

    load();
  }, [slug]);

  // Handle redirect mode
  useEffect(() => {
    if (content?.content_mode === "redirect" && content.redirect_url) {
      window.location.href = content.redirect_url;
    }
  }, [content]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (notFound || !area) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-foreground mb-2">Area Not Found</h1>
          <p className="text-muted-foreground">This campaign area is not available.</p>
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">{area.name}</h1>
          <p className="text-muted-foreground">Content coming soon.</p>
        </div>
      </div>
    );
  }

  if (content.content_mode === "redirect") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  if (content.content_mode === "video") {
    const ytId = content.video_url ? getYouTubeId(content.video_url) : null;
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-2xl aspect-video rounded-xl overflow-hidden shadow-lg">
          {ytId ? (
            <iframe
              className="w-full h-full"
              src={`https://www.youtube.com/embed/${ytId}?autoplay=1`}
              allow="autoplay; encrypted-media"
              allowFullScreen
              title="Campaign Video"
            />
          ) : content.video_url ? (
            <video className="w-full h-full" controls autoPlay src={content.video_url} />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-muted">
              <p className="text-muted-foreground">No video available</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Landing page mode
  const buttons = (content.landing_buttons as unknown as LandingButton[] | null) || [];
  const socialLinks = (content.landing_social_links as unknown as SocialLink[] | null) || [];
  const DEFAULT_ORDER = ["image", "video", "buttons", "socials"] as const;
  type SectionKey = typeof DEFAULT_ORDER[number];
  const rawOrder = (content as unknown as { section_order?: unknown }).section_order;
  const savedOrder = Array.isArray(rawOrder)
    ? (rawOrder as string[]).filter((k): k is SectionKey => (DEFAULT_ORDER as readonly string[]).includes(k))
    : [];
  const sectionOrder: SectionKey[] = [
    ...savedOrder,
    ...DEFAULT_ORDER.filter((k) => !savedOrder.includes(k)),
  ];

  const renderSection = (key: SectionKey) => {
    switch (key) {
      case "image":
        return content.landing_image_url ? (
          <div key="image" className="w-full h-56 sm:h-72 overflow-hidden rounded-xl mb-6">
            <img
              src={content.landing_image_url}
              alt={content.landing_title || area.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : null;
      case "video": {
        if (!content.video_url) return null;
        const ytId = getYouTubeId(content.video_url);
        return (
          <div key="video" className="w-full aspect-video rounded-xl overflow-hidden shadow-lg mb-8 bg-muted">
            {ytId ? (
              <iframe
                className="w-full h-full"
                src={`https://www.youtube.com/embed/${ytId}`}
                allow="autoplay; encrypted-media"
                allowFullScreen
                title="Campaign Video"
              />
            ) : (
              <video className="w-full h-full" controls src={content.video_url} />
            )}
          </div>
        );
      }
      case "buttons":
        return buttons.length > 0 ? (
          <div key="buttons" className="space-y-3 mb-8">
            {buttons.map((btn, i) => (
              <a key={i} href={btn.url} target="_blank" rel="noopener noreferrer" className="block">
                <Button
                  variant={btn.type === "whatsapp" ? "default" : "outline"}
                  className="w-full h-14 text-base gap-3"
                  style={btn.type === "whatsapp" ? { backgroundColor: "hsl(145, 65%, 42%)" } : undefined}
                >
                  {buttonIcons[btn.type] || <ExternalLink className="w-5 h-5" />}
                  {btn.label}
                </Button>
              </a>
            ))}
          </div>
        ) : null;
      case "socials":
        return socialLinks.length > 0 ? (
          <div key="socials" className="flex justify-center gap-4 mb-8">
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                {socialIcons[link.platform] || <ExternalLink className="w-5 h-5" />}
              </a>
            ))}
          </div>
        ) : null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-lg mx-auto px-4 py-8 animate-slide-up">
        {content.landing_title && (
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {content.landing_title}
          </h1>
        )}

        {content.landing_description && (
          <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
            {content.landing_description}
          </p>
        )}

        {sectionOrder.map((key) => renderSection(key))}
      </div>
    </div>
  );
}
