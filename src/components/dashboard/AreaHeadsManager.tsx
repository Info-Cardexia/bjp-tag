import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { KeyRound, Loader2, Trash2, Users } from "lucide-react";

interface AreaHeadUser {
  role_id: string;
  user_id: string;
  email: string | null;
  last_sign_in_at: string | null;
  area_id: string | null;
  area_name: string | null;
  area_slug: string | null;
}

export function AreaHeadsManager() {
  const { toast } = useToast();
  const [users, setUsers] = useState<AreaHeadUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [target, setTarget] = useState<AreaHeadUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AreaHeadUser | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "list" },
    });
    setLoading(false);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Failed to load users",
        description: error?.message || (data as { error?: string })?.error,
        variant: "destructive",
      });
      return;
    }
    setUsers((data as { users: AreaHeadUser[] }).users ?? []);
  };

  useEffect(() => {
    load();
  }, []);

  const handleReset = async () => {
    if (!target) return;
    if (newPassword.length < 8) {
      toast({
        title: "Weak password",
        description: "Password must be at least 8 characters",
        variant: "destructive",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: {
        action: "reset_password",
        user_id: target.user_id,
        password: newPassword,
      },
    });
    setSaving(false);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Failed to reset password",
        description: error?.message || (data as { error?: string })?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Password updated", description: `New password set for ${target.email}` });
    setTarget(null);
    setNewPassword("");
    setConfirmPassword("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { data, error } = await supabase.functions.invoke("admin-users", {
      body: { action: "delete_user", user_id: deleteTarget.user_id },
    });
    setDeleting(false);
    if (error || (data as { error?: string })?.error) {
      toast({
        title: "Failed to delete",
        description: error?.message || (data as { error?: string })?.error,
        variant: "destructive",
      });
      return;
    }
    toast({ title: "Area head removed", description: deleteTarget.email ?? "" });
    setDeleteTarget(null);
    load();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
        <Users className="w-5 h-5" /> Area Heads
      </h2>
      <div className="rounded-md border bg-card">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : users.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">No area heads assigned yet.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Area</TableHead>
                <TableHead>Last Sign In</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.role_id}>
                  <TableCell className="font-medium">{u.email ?? "—"}</TableCell>
                  <TableCell>{u.area_name ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {u.last_sign_in_at
                      ? new Date(u.last_sign_in_at).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setTarget(u);
                          setNewPassword("");
                          setConfirmPassword("");
                        }}
                      >
                        <KeyRound className="w-4 h-4 mr-2" /> Reset Password
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setDeleteTarget(u)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Set a new password for <strong>{target?.email}</strong>. They can change it
              later from their dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-password">New Password</Label>
              <Input
                id="reset-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                maxLength={72}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reset-confirm">Confirm Password</Label>
              <Input
                id="reset-confirm"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                minLength={8}
                maxLength={72}
              />
            </div>
            <Button onClick={handleReset} disabled={saving} className="w-full">
              {saving ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove area head?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes <strong>{deleteTarget?.email}</strong> and revokes
              their access to <strong>{deleteTarget?.area_name ?? "their area"}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
