"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Grade } from "@/lib/supabase/types";
import { createGrade, updateGrade, deleteGrade } from "@/app/actions/grades";
import { updateSettings } from "@/app/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency } from "@/lib/fee-utils";
import { Plus, Pencil, Trash2, Loader2, Save, GraduationCap, Building2, AlertTriangle, Upload, ImageIcon } from "lucide-react";

interface Props { grades: Grade[]; settings: Record<string, string>; }

type GradeForm = { name: string; monthly_fee: string; display_order: string };

export function SettingsClient({ grades: init, settings: initSettings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [school, setSchool] = useState({
    school_name: initSettings.school_name ?? "",
    school_address: initSettings.school_address ?? "",
    school_phone: initSettings.school_phone ?? "",
    school_logo: initSettings.school_logo ?? "",
    late_fee_amount: initSettings.late_fee_amount ?? "200",
  });

  const [showGradeDialog, setShowGradeDialog] = useState(false);
  const [editingGrade, setEditingGrade] = useState<Grade | null>(null);
  const [gradeForm, setGradeForm] = useState<GradeForm>({ name: "", monthly_fee: "", display_order: "" });
  const [deletingGrade, setDeletingGrade] = useState<Grade | null>(null);
  const [uploading, setUploading] = useState(false);

  function openAdd() {
    setEditingGrade(null);
    setGradeForm({ name: "", monthly_fee: "", display_order: String(init.length + 1) });
    setShowGradeDialog(true);
  }
  function openEdit(g: Grade) {
    setEditingGrade(g);
    setGradeForm({ name: g.name, monthly_fee: g.monthly_fee.toString(), display_order: g.display_order.toString() });
    setShowGradeDialog(true);
  }

  async function handleSaveGrade() {
    if (!gradeForm.name.trim()) { toast.error("Grade name is required"); return; }
    startTransition(async () => {
      try {
        const vals = {
          name: gradeForm.name.trim(),
          monthly_fee: parseFloat(gradeForm.monthly_fee) || 0,
          display_order: parseInt(gradeForm.display_order) || init.length + 1,
        };
        if (editingGrade) { await updateGrade(editingGrade.id, vals); toast.success("Grade updated"); }
        else { await createGrade(vals); toast.success("Grade added"); }
        setShowGradeDialog(false);
        router.refresh();
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : "Failed to save");
      }
    });
  }

  async function handleDelete() {
    if (!deletingGrade) return;
    startTransition(async () => {
      try {
        await deleteGrade(deletingGrade.id);
        toast.success("Grade deleted");
        setDeletingGrade(null);
        router.refresh();
      } catch { toast.error("Cannot delete — students may be assigned to this grade"); }
    });
  }

  async function handleSaveSettings() {
    startTransition(async () => {
      try {
        await updateSettings(school);
        toast.success("Settings saved");
      } catch { toast.error("Failed to save settings"); }
    });
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Invalid file type. Use PNG, JPG, WebP, or SVG");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("File too large. Max 2MB");
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/upload-logo", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      setSchool((p) => ({ ...p, school_logo: data.url }));
      toast.success("Logo uploaded");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      {/* School Info */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <CardTitle className="text-base">School Information</CardTitle>
          </div>
          <CardDescription>Shown on printed fee challans and certificates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>School Logo</Label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById("logo-upload")?.click()}
                  disabled={uploading}
                  className="h-9"
                >
                  {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  Upload from PC
                </Button>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={school.school_logo}
                  onChange={(e) => setSchool((p) => ({ ...p, school_logo: e.target.value }))}
                  placeholder="Or paste image URL / base64 data URL"
                />
                {school.school_logo && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setSchool((p) => ({ ...p, school_logo: "" }))}
                    className="h-8 w-8"
                  >
                    <ImageIcon className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Upload from PC, or enter an image URL or base64 data URL. Will appear on all documents.</p>
              {school.school_logo && (
                <div className="mt-2">
                  <img src={school.school_logo} alt="Logo preview" className="h-16 w-auto rounded border" />
                </div>
              )}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>School Name</Label>
            <Input
              value={school.school_name}
              onChange={(e) => setSchool((p) => ({ ...p, school_name: e.target.value }))}
              placeholder="e.g. Al-Noor Model School"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Address</Label>
              <Input
                value={school.school_address}
                onChange={(e) => setSchool((p) => ({ ...p, school_address: e.target.value }))}
                placeholder="School address"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={school.school_phone}
                onChange={(e) => setSchool((p) => ({ ...p, school_phone: e.target.value }))}
                placeholder="03XX-XXXXXXX"
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-1.5">
            <Label>Late Fee Amount (Rs)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number" min="0" className="max-w-32"
                value={school.late_fee_amount}
                onChange={(e) => setSchool((p) => ({ ...p, late_fee_amount: e.target.value }))}
              />
              <p className="text-xs text-muted-foreground">
                Charged between 8th–15th of each month
              </p>
            </div>
          </div>

          <Button size="sm" onClick={handleSaveSettings} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      {/* Grades */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base">Classes & Fees</CardTitle>
            </div>
            <Button size="sm" onClick={openAdd} disabled={isPending}>
              <Plus className="h-4 w-4 mr-1.5" />Add Grade
            </Button>
          </div>
          <CardDescription>Set the monthly tuition fee for each class</CardDescription>
        </CardHeader>
        <CardContent>
          {init.length === 0 ? (
            <div className="border border-dashed rounded-lg p-8 text-center">
              <GraduationCap className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No grades yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1 mb-3">Add your first class to get started</p>
              <Button size="sm" onClick={openAdd}><Plus className="h-4 w-4 mr-1.5" />Add First Grade</Button>
            </div>
          ) : (
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30 hover:bg-muted/30">
                    <TableHead className="text-xs font-semibold uppercase text-muted-foreground w-12">#</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-muted-foreground">Class</TableHead>
                    <TableHead className="text-xs font-semibold uppercase text-muted-foreground text-right">Monthly Fee</TableHead>
                    <TableHead className="w-16" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {init.map((g) => (
                    <TableRow key={g.id} className="group">
                      <TableCell className="text-muted-foreground text-sm">{g.display_order}</TableCell>
                      <TableCell className="font-medium text-sm">{g.name}</TableCell>
                      <TableCell className="text-right font-semibold text-sm">{formatCurrency(g.monthly_fee)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(g)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => setDeletingGrade(g)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Grade Dialog */}
      <Dialog open={showGradeDialog} onOpenChange={setShowGradeDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingGrade ? "Edit Grade" : "Add Grade"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Class Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Class 5 or Grade 9"
                value={gradeForm.name}
                onChange={(e) => setGradeForm((p) => ({ ...p, name: e.target.value }))}
                autoFocus
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Monthly Fee (Rs)</Label>
                <Input
                  type="number" min="0" placeholder="0"
                  value={gradeForm.monthly_fee}
                  onChange={(e) => setGradeForm((p) => ({ ...p, monthly_fee: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input
                  type="number" min="1"
                  value={gradeForm.display_order}
                  onChange={(e) => setGradeForm((p) => ({ ...p, display_order: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGradeDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveGrade} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingGrade ? "Save Changes" : "Add Grade"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deletingGrade} onOpenChange={(o) => { if (!o) setDeletingGrade(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Grade
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">
            Delete <strong>{deletingGrade?.name}</strong>? Students assigned to this grade will lose their class assignment.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingGrade(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
