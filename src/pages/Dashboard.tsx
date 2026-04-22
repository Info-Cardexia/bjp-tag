import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import SuperAdminDashboard from "@/components/dashboard/SuperAdminDashboard";
import AreaHeadDashboard from "@/components/dashboard/AreaHeadDashboard";
import { Loader2 } from "lucide-react";

export default function Dashboard() {
  const { user, userRole, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editAreaId = searchParams.get("area");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !userRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-muted-foreground">You don't have permission to access the dashboard.</p>
        </div>
      </div>
    );
  }

  // Super admin editing a specific area's content
  if (userRole.role === "super_admin" && editAreaId) {
    return <AreaHeadDashboard areaId={editAreaId} isSuperAdmin />;
  }

  if (userRole.role === "super_admin") {
    return <SuperAdminDashboard />;
  }

  if (userRole.role === "area_head" && userRole.area_id) {
    return <AreaHeadDashboard areaId={userRole.area_id} />;
  }

  return null;
}
