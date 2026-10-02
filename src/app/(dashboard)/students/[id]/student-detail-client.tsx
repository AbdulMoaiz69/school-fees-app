"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Student, FeeChallan, Grade } from "@/lib/supabase/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  promoteStudent, demoteStudent, retainStudent,
  expelStudent, withdrawStudent, reinstateStudent,
} from "@/app/actions/students";
import {
  formatCurrency,
  getChallanStatus,
  getMonthName,
  getStatusLabel,
} from "@/lib/fee-utils";
import {
  Receipt, Phone, MapPin, User, Calendar, GraduationCap, Cake, School,
  ArrowUp, ArrowDown, RotateCw, UserX, LogOut, Undo2, Loader2, AlertTriangle, Settings2, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const SCHOLARSHIP_MAP = {
  none: { label: "No Scholarship", color: "secondary" as const },
  half: { label: "Half Scholarship", color: "outline" as const },
  full: { label: "Full Scholarship", color: "default" as const },
  sibling: { label: "Sibling Discount (20%)", color: "outline" as const },
  custom: { label: "Custom Discount", color: "outline" as const },
};

const STATUS_BADGE: Record<string, { label: string; cls: string } | null> = {
  active: null,
  expelled: { label: "Expelled", cls: "bg-red-50 text-red-700 border-red-200" },
  withdrawn: { label: "Withdrawn", cls: "bg-gray-100 text-gray-700 border-gray-300" },
};

interface StudentDetailClientProps {
  student: Student;
  challans: FeeChallan[];
  grades: Grade[];
}

export function StudentDetailClient({ student, challans, grades }: StudentDetailClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [exitDialog, setExitDialog] = useState<null | "expel" | "withdraw">(null);
  const [reason, setReason] = useState("");

  const scholarship = SCHOLARSHIP_MAP[student.scholarship_type];
  // Default to "active" so the page works before the lifecycle DB migration is applied.
  const status = student.status ?? "active";
  const statusBadge = STATUS_BADGE[status];
  const isActive = status === "active";

  // Outstanding dues (from the challans already loaded for this student)
  const unpaid = challans.filter((c) => !c.is_paid);
  const duesTotal = unpaid.reduce((s, c) => s + c.total, 0);
  const hasDues = unpaid.length > 0;

  // Class ladder (grades arrive ordered by display_order)
  const gradeIdx = grades.findIndex((g) => g.id === student.grade_id);
  const nextGrade = gradeIdx >= 0 ? grades[gradeIdx + 1] : undefined;
  const prevGrade = gradeIdx >= 0 ? grades[gradeIdx - 1] : undefined;

  function run(fn: () => Promise<unknown>, successMsg: string) {
    startTransition(async () => {
      try {
        await fn();
        toast.success(successMsg);
        setExitDialog(null);
        setReason("");
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Action failed");
      }
    });
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: info + management */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-lg shrink-0">
                  {student.full_name
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase()}
                </div>
                <div>
                  <CardTitle className="text-base">{student.full_name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground mt-0.5">
                    {student.registration_number}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={scholarship.color}>{scholarship.label}</Badge>
                {statusBadge && (
                  <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusBadge.cls}`}>
                    {statusBadge.label}
                  </span>
                )}
              </div>

              <Separator />

              <InfoRow
                icon={GraduationCap}
                label="Class"
                value={student.grade?.name ?? "Not assigned"}
              />
              <InfoRow
                icon={ShieldCheck}
                label="Security Deposit"
                value={student.security_fee > 0 ? formatCurrency(student.security_fee) : "None"}
              />
              {student.date_of_birth && (
                <InfoRow
                  icon={Cake}
                  label="Date of Birth"
                  value={new Date(student.date_of_birth).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                />
              )}
              {student.previous_school && (
                <InfoRow
                  icon={School}
                  label="Previous School"
                  value={student.previous_school}
                />
              )}
              {student.parent_name && (
                <InfoRow icon={User} label="Parent" value={student.parent_name} />
              )}
              {student.parent_phone && (
                <InfoRow icon={Phone} label="Phone" value={student.parent_phone} />
              )}
              {student.address && (
                <InfoRow icon={MapPin} label="Address" value={student.address} />
              )}
              {student.admission_date && (
                <InfoRow
                  icon={Calendar}
                  label="Admitted"
                  value={new Date(student.admission_date).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                />
              )}
            </CardContent>
          </Card>

          {/* Management card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" /> Manage Student
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isActive ? (
                <>
                  {/* Academic actions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Academic</p>
                    <div className="grid grid-cols-1 gap-2">
                      <Button
                        variant="outline" size="sm" className="justify-start"
                        disabled={isPending || !nextGrade}
                        onClick={() => run(() => promoteStudent(student.id), `Promoted to ${nextGrade?.name}`)}
                      >
                        <ArrowUp className="h-4 w-4 mr-2 text-emerald-600" />
                        Promote{nextGrade ? ` → ${nextGrade.name}` : " (highest class)"}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="justify-start"
                        disabled={isPending || !prevGrade}
                        onClick={() => run(() => demoteStudent(student.id), `Demoted to ${prevGrade?.name}`)}
                      >
                        <ArrowDown className="h-4 w-4 mr-2 text-amber-600" />
                        Demote{prevGrade ? ` → ${prevGrade.name}` : " (lowest class)"}
                      </Button>
                      <Button
                        variant="outline" size="sm" className="justify-start"
                        disabled={isPending}
                        onClick={() => run(() => retainStudent(student.id), `Retained in ${student.grade?.name ?? "current class"}`)}
                      >
                        <RotateCw className="h-4 w-4 mr-2 text-blue-600" />
                        Retain in {student.grade?.name ?? "current class"}
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Exit actions */}
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Exit</p>
                    {hasDues && (
                      <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>{unpaid.length} unpaid challan{unpaid.length !== 1 ? "s" : ""} ({formatCurrency(duesTotal)}). Dues must be cleared before exit.</span>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline" size="sm"
                        className="justify-start border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                        disabled={isPending}
                        onClick={() => { setReason(""); setExitDialog("expel"); }}
                      >
                        <UserX className="h-4 w-4 mr-2" /> Expel
                      </Button>
                      <Button
                        variant="outline" size="sm" className="justify-start"
                        disabled={isPending}
                        onClick={() => { setReason(""); setExitDialog("withdraw"); }}
                      >
                        <LogOut className="h-4 w-4 mr-2" /> Withdraw
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                /* Inactive: show exit details + reinstate */
                <div className="space-y-3">
                  <div className="rounded-lg border bg-muted/40 p-3 space-y-1.5">
                    <p className="text-sm font-medium">
                      {student.status === "expelled" ? "Expelled" : "Withdrawn"}
                      {student.exit_date && (
                        <span className="text-muted-foreground font-normal">
                          {" "}on {new Date(student.exit_date).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}
                        </span>
                      )}
                    </p>
                    {student.exit_reason && (
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium text-foreground">Reason: </span>{student.exit_reason}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline" size="sm" className="w-full justify-center"
                    disabled={isPending}
                    onClick={() => run(() => reinstateStudent(student.id), "Student reinstated")}
                  >
                    {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Undo2 className="h-4 w-4 mr-2" />}
                    Reinstate Student
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Fee History */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Fee Challans
              </CardTitle>
              <span className="text-xs text-muted-foreground">{challans.length} total</span>
            </CardHeader>
            <CardContent>
              {challans.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  No challans generated yet
                </p>
              ) : (
                <div className="space-y-2">
                  {challans.map((challan) => (
                    <ChallanRow key={challan.id} challan={challan} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Expel / Withdraw dialog */}
      <Dialog open={exitDialog !== null} onOpenChange={(o) => { if (!o) setExitDialog(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {exitDialog === "expel" ? "Expel Student" : "Withdraw Student"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm font-medium">{student.full_name}</p>
              <p className="text-xs text-muted-foreground">{student.registration_number} · {student.grade?.name ?? "No Class"}</p>
            </div>

            {hasDues ? (
              /* Blocked: outstanding dues */
              <div className="space-y-3">
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Dues not cleared</p>
                    <p className="text-xs mt-0.5">
                      This student has {unpaid.length} unpaid challan{unpaid.length !== 1 ? "s" : ""} totaling{" "}
                      <span className="font-semibold">{formatCurrency(duesTotal)}</span>. Clear all dues before {exitDialog === "expel" ? "expelling" : "withdrawing"}.
                    </p>
                  </div>
                </div>
                <div className="border rounded-lg divide-y max-h-44 overflow-y-auto">
                  {unpaid.map((c) => (
                    <Link key={c.id} href={`/fees/${c.id}`} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40">
                      <span>{getMonthName(c.month)} {c.year}</span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs text-amber-700">{getStatusLabel(getChallanStatus(c))}</span>
                        <span className="font-medium">{formatCurrency(c.total)}</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              /* Allowed: capture reason (+ security refund notice) */
              <div className="space-y-3">
                {student.security_fee > 0 && (
                  <div className="flex items-start gap-2 rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                    <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold">Refund security deposit: {formatCurrency(student.security_fee)}</p>
                      <p className="text-xs mt-0.5">
                        Return this deposit to the parent. It will be removed from the Security Fees Treasury once the student exits.
                      </p>
                    </div>
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="exit_reason">
                    Reason {exitDialog === "expel" ? <span className="text-destructive">*</span> : <span className="text-muted-foreground text-xs">(optional)</span>}
                  </Label>
                  <Textarea
                    id="exit_reason"
                    rows={3}
                    placeholder={exitDialog === "expel" ? "e.g. Repeated misconduct after warnings" : "e.g. Relocating to another city"}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setExitDialog(null)}>Cancel</Button>
            {!hasDues && (
              <Button
                variant={exitDialog === "expel" ? "destructive" : "default"}
                disabled={isPending || (exitDialog === "expel" && !reason.trim())}
                onClick={() =>
                  exitDialog === "expel"
                    ? run(() => expelStudent(student.id, reason), "Student expelled")
                    : run(() => withdrawStudent(student.id, reason || undefined), "Student withdrawn")
                }
              >
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {exitDialog === "expel" ? "Expel Student" : "Withdraw Student"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function ChallanRow({ challan }: { challan: FeeChallan }) {
  const status = getChallanStatus(challan);
  const statusLabel = getStatusLabel(status);

  const badgeClass = {
    paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
    unpaid: "bg-amber-50 text-amber-700 border-amber-200",
    late_fee: "bg-orange-50 text-orange-700 border-orange-200",
    arrears: "bg-red-50 text-red-700 border-red-200",
    overdue: "bg-red-50 text-red-700 border-red-200",
  }[status];

  return (
    <Link href={`/fees/${challan.id}`}>
      <div className="flex items-center justify-between p-3 rounded-lg border hover:border-primary/30 hover:bg-muted/30 transition-all cursor-pointer">
        <div>
          <p className="text-sm font-medium">
            {getMonthName(challan.month)} {challan.year}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Due: {new Date(challan.due_date).toLocaleDateString("en-PK", {
              day: "numeric",
              month: "short",
            })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold">{formatCurrency(challan.total)}</p>
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded border inline-block mt-0.5 ${badgeClass}`}
          >
            {statusLabel}
          </span>
        </div>
      </div>
    </Link>
  );
}
