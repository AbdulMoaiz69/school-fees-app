"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Grade, Student, ScholarshipType } from "@/lib/supabase/types";
import { createStudent, updateStudent, searchStudents } from "@/app/actions/students";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Search, X, Users } from "lucide-react";
import { formatCurrency, computeDiscount } from "@/lib/fee-utils";

interface StudentFormProps {
  grades: Grade[];
  student?: Student;
  siblingName?: string;
}

export function StudentForm({ grades, student, siblingName }: StudentFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    full_name: student?.full_name ?? "",
    grade_id: student?.grade_id ?? "",
    parent_name: student?.parent_name ?? "",
    parent_phone: student?.parent_phone ?? "",
    address: student?.address ?? "",
    scholarship_type: student?.scholarship_type ?? "none",
    admission_date: student?.admission_date ?? "",
    date_of_birth: student?.date_of_birth ?? "",
    previous_school: student?.previous_school ?? "",
    security_fee: student?.security_fee != null ? String(student.security_fee) : "",
  });

  // Sibling discount: link to an already-enrolled student
  const [siblingId, setSiblingId] = useState<string | null>(student?.sibling_id ?? null);
  const [siblingLabel, setSiblingLabel] = useState<string>(siblingName ?? "");
  const [siblingQuery, setSiblingQuery] = useState("");
  const [siblingResults, setSiblingResults] = useState<Student[]>([]);
  const [, startSearch] = useTransition();

  function onSiblingSearch(q: string) {
    setSiblingQuery(q);
    if (q.trim().length < 2) { setSiblingResults([]); return; }
    startSearch(async () => {
      try {
        const res = await searchStudents(q.trim());
        setSiblingResults(res.filter((s) => s.id !== student?.id));
      } catch { setSiblingResults([]); }
    });
  }

  function selectSibling(s: Student) {
    setSiblingId(s.id);
    setSiblingLabel(`${s.full_name} (${s.registration_number})`);
    setSiblingQuery("");
    setSiblingResults([]);
  }

  function clearSibling() {
    setSiblingId(null);
    setSiblingLabel("");
    setSiblingQuery("");
    setSiblingResults([]);
  }

  const set = (key: keyof typeof form, value: string | null) =>
    setForm((prev) => ({ ...prev, [key]: value ?? "" }));

  const selectedGrade = grades.find((g) => g.id === form.grade_id);
  const baseFee = selectedGrade?.monthly_fee ?? 0;
  const scholarshipType = form.scholarship_type as ScholarshipType;
  const discount = computeDiscount(baseFee, scholarshipType);
  const effectiveFee = baseFee - discount;

  async function handleSubmit(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!form.full_name.trim()) { toast.error("Student name is required"); return; }
    if (!form.grade_id) { toast.error("Please select a class"); return; }
    if (scholarshipType === "sibling" && !siblingId) { toast.error("Select the enrolled sibling"); return; }

    const sibling_id = scholarshipType === "sibling" ? siblingId : null;

    setLoading(true);
    try {
      if (student) {
        await updateStudent(student.id, {
          ...form,
          date_of_birth: form.date_of_birth || null,
          previous_school: form.previous_school.trim() || null,
          scholarship_type: scholarshipType,
          admission_date: form.admission_date || undefined,
          security_fee: parseFloat(form.security_fee) || 0,
          sibling_id,
        });
        toast.success("Student updated");
        router.push(`/students/${student.id}`);
      } else {
        const s = await createStudent({
          ...form,
          date_of_birth: form.date_of_birth || undefined,
          previous_school: form.previous_school.trim() || undefined,
          scholarship_type: scholarshipType,
          admission_date: form.admission_date || undefined,
          security_fee: parseFloat(form.security_fee) || 0,
          sibling_id,
        });
        toast.success("Student added successfully");
        router.push(`/students/${s.id}`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
      {/* Student info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Student Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="full_name">Full Name <span className="text-destructive">*</span></Label>
            <Input
              id="full_name"
              placeholder="e.g. Muhammad Ali Khan"
              value={form.full_name}
              onChange={(e) => set("full_name", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="grade_id">Class / Grade <span className="text-destructive">*</span></Label>
              <Select value={form.grade_id} onValueChange={(v) => set("grade_id", v ?? "")}>
                <SelectTrigger id="grade_id">
                  <SelectValue placeholder="Select a class…" />
                </SelectTrigger>
                <SelectContent>
                  {grades.length === 0 ? (
                    <SelectItem value="_empty" disabled>
                      No grades — add them in Settings
                    </SelectItem>
                  ) : (
                    grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} — {formatCurrency(g.monthly_fee)}/mo
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="admission_date">Admission Date</Label>
              <Input
                id="admission_date"
                type="date"
                value={form.admission_date}
                onChange={(e) => set("admission_date", e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="date_of_birth">Date of Birth</Label>
              <Input
                id="date_of_birth"
                type="date"
                value={form.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="previous_school">Previous School</Label>
              <Input
                id="previous_school"
                placeholder="e.g. Army Public School (optional)"
                value={form.previous_school}
                onChange={(e) => set("previous_school", e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scholarship_type">Scholarship / Fee Waiver</Label>
            <Select
              value={form.scholarship_type}
              onValueChange={(v) => set("scholarship_type", v ?? "none")}
            >
              <SelectTrigger id="scholarship_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Scholarship — Full Fee</SelectItem>
                <SelectItem value="half">Half Scholarship — 50% off tuition</SelectItem>
                <SelectItem value="full">Full Scholarship — 100% waiver</SelectItem>
                <SelectItem value="sibling">Sibling Discount — 20% off tuition</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Sibling selection — only for the sibling discount */}
          {scholarshipType === "sibling" && (
            <div className="space-y-1.5">
              <Label>
                Enrolled Sibling <span className="text-destructive">*</span>
                <span className="text-muted-foreground text-xs ml-1">(must already be enrolled)</span>
              </Label>
              {siblingId ? (
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted/40 px-3 py-2">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    {siblingLabel || "Linked sibling"}
                  </span>
                  <button type="button" onClick={clearSibling} className="text-muted-foreground hover:text-foreground" title="Change sibling">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    className="pl-9"
                    placeholder="Search sibling by name or reg. no…"
                    value={siblingQuery}
                    onChange={(e) => onSiblingSearch(e.target.value)}
                  />
                  {siblingResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border bg-popover shadow-md">
                      {siblingResults.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => selectSibling(s)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-sm hover:bg-muted/60 text-left"
                        >
                          <span className="font-medium">{s.full_name}</span>
                          <span className="text-xs text-muted-foreground font-mono">
                            {s.registration_number}{s.grade?.name ? ` · ${s.grade.name}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                  {siblingQuery.trim().length >= 2 && siblingResults.length === 0 && (
                    <p className="text-xs text-muted-foreground mt-1.5">No enrolled students match &ldquo;{siblingQuery}&rdquo;.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="security_fee">Security Fee / Deposit <span className="text-muted-foreground text-xs">(refundable, collected at admission)</span></Label>
            <Input
              id="security_fee"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={form.security_fee}
              onChange={(e) => set("security_fee", e.target.value)}
            />
          </div>

          {/* Fee preview */}
          {form.grade_id && (
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-4 py-3 border">
              <span className="text-sm text-muted-foreground">Monthly fee for this student</span>
              <div className="text-right">
                {form.scholarship_type !== "none" && (
                  <p className="text-xs text-muted-foreground line-through">{formatCurrency(baseFee)}</p>
                )}
                <p className="font-semibold text-sm">
                  {form.scholarship_type === "full" ? "Free" : formatCurrency(effectiveFee)}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Parent info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            Parent / Guardian
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="parent_name">Parent Name</Label>
              <Input
                id="parent_name"
                placeholder="Parent or guardian name"
                value={form.parent_name}
                onChange={(e) => set("parent_name", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="parent_phone">Phone Number</Label>
              <Input
                id="parent_phone"
                placeholder="03XX-XXXXXXX"
                value={form.parent_phone}
                onChange={(e) => set("parent_phone", e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address">Address</Label>
            <Textarea
              id="address"
              placeholder="Home address (optional)"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={loading}>
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {student ? "Save Changes" : "Add Student"}
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={loading}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
