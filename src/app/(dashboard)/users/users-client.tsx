"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UserRole } from "@/lib/supabase/types";
import type { PublicUser } from "@/app/actions/users";
import { createUser, updateUserRole, setUserActive, resetUserPin, updateUserName } from "@/app/actions/users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { UserPlus, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

const ROLE_BADGE: Record<UserRole, string> = {
  principal: "bg-purple-50 text-purple-700 border-purple-200",
  admin: "bg-blue-50 text-blue-700 border-blue-200",
  staff: "bg-slate-50 text-slate-700 border-slate-200",
};
const ROLE_LABEL: Record<UserRole, string> = { principal: "Principal", admin: "Admin", staff: "Staff" };

export function UsersClient({ users, meId }: { users: PublicUser[]; meId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: "", username: "", role: "staff" as UserRole, pin: "" });
  const [resetFor, setResetFor] = useState<PublicUser | null>(null);
  const [newPin, setNewPin] = useState("");
  const [editNameFor, setEditNameFor] = useState<PublicUser | null>(null);
  const [editName, setEditName] = useState("");

  function run(fn: () => Promise<unknown>, msg: string, after?: () => void) {
    startTransition(async () => {
      try { await fn(); toast.success(msg); after?.(); router.refresh(); }
      catch (e) { toast.error(e instanceof Error ? e.message : "Action failed"); }
    });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4" />
          <span>{users.length} account{users.length !== 1 ? "s" : ""} · Principal &amp; Admin have full access; Staff is limited and expenses they add need approval</span>
        </div>
        <Button size="sm" onClick={() => { setForm({ name: "", username: "", role: "staff", pin: "" }); setShowAdd(true); }}>
          <UserPlus className="h-4 w-4 mr-2" /> Add User
        </Button>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Name</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Username</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
              <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.id} className={cn(!u.is_active && "opacity-50")}>
                <TableCell className="font-medium text-sm">
                  {u.name}{u.id === meId && <span className="text-xs text-muted-foreground ml-1.5">(you)</span>}
                </TableCell>
                <TableCell className="text-sm font-mono text-muted-foreground">@{u.username}</TableCell>
                <TableCell>
                  <Select value={u.role} onValueChange={(v) => v && run(() => updateUserRole(u.id, v as UserRole), "Role updated")}>
                    <SelectTrigger className={cn("w-32 h-7 text-xs border", ROLE_BADGE[u.role])}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="principal">Principal</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="staff">Staff</SelectItem>
                    </SelectContent>
                  </Select>
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs font-medium px-2 py-0.5 rounded-full border",
                    u.is_active ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-gray-100 text-gray-600 border-gray-300")}>
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => { setEditName(u.name); setEditNameFor(u); }}>
                      <svg className="h-3.5 w-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7" onClick={() => { setNewPin(""); setResetFor(u); }}>
                      <KeyRound className="h-3.5 w-3.5 mr-1" /> PIN
                    </Button>
                    {u.id !== meId && (
                      <Button variant="ghost" size="sm" className="h-7"
                        onClick={() => run(() => setUserActive(u.id, !u.is_active), u.is_active ? "Deactivated" : "Reactivated")}>
                        {u.is_active ? "Deactivate" : "Reactivate"}
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Add user */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Add User</DialogTitle></DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label htmlFor="u_name">Full Name</Label>
              <Input id="u_name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Sara Ali" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="u_username">Username</Label>
                <Input id="u_username" value={form.username} onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))} placeholder="username" />
              </div>
              <div className="space-y-1.5">
                <Label>Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm((f) => ({ ...f, role: (v ?? "staff") as UserRole }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="u_pin">PIN <span className="text-muted-foreground text-xs">(min 4 digits)</span></Label>
              <Input id="u_pin" type="password" inputMode="numeric" value={form.pin} onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))} placeholder="••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button disabled={isPending} onClick={() => run(() => createUser(form), "User created", () => setShowAdd(false))}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset PIN */}
      <Dialog open={resetFor !== null} onOpenChange={(o) => { if (!o) setResetFor(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Reset PIN — {resetFor?.name}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="reset_pin">New PIN <span className="text-muted-foreground text-xs">(min 4 digits)</span></Label>
            <Input id="reset_pin" type="password" inputMode="numeric" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="••••" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetFor(null)}>Cancel</Button>
            <Button disabled={isPending} onClick={() => { const id = resetFor!.id; run(() => resetUserPin(id, newPin), "PIN reset", () => setResetFor(null)); }}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Reset PIN
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Name */}
      <Dialog open={editNameFor !== null} onOpenChange={(o) => { if (!o) setEditNameFor(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Edit Name — {editNameFor?.username}</DialogTitle></DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label htmlFor="edit_name">Full Name</Label>
            <Input id="edit_name" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="e.g. Sara Ali" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditNameFor(null)}>Cancel</Button>
            <Button disabled={isPending} onClick={() => { const id = editNameFor!.id; const name = editName; run(() => updateUserName(id, name), "Name updated", () => setEditNameFor(null)); }}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
