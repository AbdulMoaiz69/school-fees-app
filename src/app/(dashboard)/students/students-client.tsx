"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Student, Grade, StudentStatus } from "@/lib/supabase/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Tabs, TabsList, TabsTrigger, TabsContent,
} from "@/components/ui/tabs";
import { bulkMoveClass } from "@/app/actions/students";
import { Search, Users, GraduationCap, ArrowUp, ArrowDown, ArrowUpDown, Loader2, UserX, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ClassListDownloadButton } from "@/components/students/class-list-download";

interface StudentsClientProps {
  activeStudents: Student[];
  inactiveStudents: Student[];
  grades: Grade[];
}

const SCHOLARSHIP_BADGE = {
  none: null,
  half: { label: "Half Scholar", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  full: { label: "Full Scholar", cls: "bg-purple-50 text-purple-700 border-purple-200" },
  sibling: { label: "Sibling 20%", cls: "bg-teal-50 text-teal-700 border-teal-200" },
  custom: { label: "Custom Disc.", cls: "bg-amber-50 text-amber-700 border-amber-200" },
};

const STATUS_LABELS: Record<StudentStatus, { label: string; color: string }> = {
  active: { label: "Active", color: "bg-green-500" },
  expelled: { label: "Expelled", color: "bg-red-500" },
  withdrawn: { label: "Withdrawn", color: "bg-amber-500" },
};

export function StudentsClient({ activeStudents, inactiveStudents, grades }: StudentsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"active" | "inactive">("active");
  const [search, setSearch] = useState("");
  const [activeGrade, setActiveGrade] = useState<string>("all");
  const [showBulk, setShowBulk] = useState(false);
  const [bulkGrade, setBulkGrade] = useState<string>("");
  const [bulkAction, setBulkAction] = useState<"promote" | "demote">("promote");
  const [isPending, startTransition] = useTransition();

  const currentStudents = activeTab === "active" ? activeStudents : inactiveStudents;

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return currentStudents.filter(
      (s) =>
        (activeGrade === "all" || s.grade_id === activeGrade) &&
        (!q || s.full_name.toLowerCase().includes(q) || s.registration_number.toLowerCase().includes(q))
    );
  }, [currentStudents, search, activeGrade]);

  const gradeCount = (id: string) => activeStudents.filter((s) => s.grade_id === id).length;

  // Bulk class move helpers
  const gradeIdx = grades.findIndex((g) => g.id === bulkGrade);
  const bulkTarget =
    gradeIdx >= 0 ? grades[gradeIdx + (bulkAction === "promote" ? 1 : -1)] : undefined;
  const bulkCount = bulkGrade ? gradeCount(bulkGrade) : 0;

  function openBulk() {
    setBulkGrade(activeGrade !== "all" ? activeGrade : grades[0]?.id ?? "");
    setBulkAction("promote");
    setShowBulk(true);
  }

  function runBulk() {
    if (!bulkGrade || !bulkTarget) return;
    startTransition(async () => {
      try {
        const moved = await bulkMoveClass(bulkGrade, bulkAction === "promote" ? 1 : -1);
        toast.success(`${bulkAction === "promote" ? "Promoted" : "Demoted"} ${moved} student${moved !== 1 ? "s" : ""} to ${bulkTarget.name}`);
        setShowBulk(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Bulk action failed");
      }
    });
  }

  return (
    <div className="flex flex-col h-full">
      {/* Search + filter bar */}
      <div className="px-6 pt-5 pb-4 border-b bg-background space-y-3">
        {/* Tabs for Active/Inactive */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Active ({activeStudents.length})
            </TabsTrigger>
            <TabsTrigger value="inactive" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Inactive ({inactiveStudents.length})
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Search + filter bar */}
        <div className="flex items-center justify-between gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              className="pl-9"
              placeholder={activeTab === "active" ? "Search by name or reg. no…" : "Search inactive by name or reg. no…"}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {activeTab === "active" && (
            <Button variant="outline" size="sm" onClick={openBulk} disabled={grades.length === 0}>
              <ArrowUpDown className="h-4 w-4 mr-2" />
              Promote / Demote Class
            </Button>
          )}
        </div>

        {/* Grade filter pills - only for active students */}
        {activeTab === "active" && (
          <div className="flex gap-2 flex-wrap items-center">
            <FilterPill
              active={activeGrade === "all"}
              onClick={() => setActiveGrade("all")}
              label="All"
              count={activeStudents.length}
            />
            {grades.map((g) => (
              <div key={g.id} className="flex items-center gap-0.5">
                <FilterPill
                  active={activeGrade === g.id}
                  onClick={() => setActiveGrade(g.id)}
                  label={g.name}
                  count={gradeCount(g.id)}
                />
                <ClassListDownloadButton grade={g} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <EmptyState search={search} hasGrades={grades.length > 0} activeTab={activeTab} />
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-4">
              {filtered.length} student{filtered.length !== 1 ? "s" : ""}
              {activeGrade !== "all" && ` in ${grades.find((g) => g.id === activeGrade)?.name}`}
              {activeTab === "inactive" && " (inactive)"}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filtered.map((s) => (
                <StudentCard key={s.id} student={s} isInactive={activeTab === "inactive"} />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Bulk promote / demote by class - only for active */}
      {activeTab === "active" && (
        <Dialog open={showBulk} onOpenChange={setShowBulk}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Promote / Demote a Class</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Class</label>
                <Select value={bulkGrade} onValueChange={(v) => setBulkGrade(v ?? "")}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a class" />
                  </SelectTrigger>
                  <SelectContent>
                    {grades.map((g) => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} ({gradeCount(g.id)})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Action</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={bulkAction === "promote" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBulkAction("promote")}
                  >
                    <ArrowUp className="h-4 w-4 mr-1.5" /> Promote
                  </Button>
                  <Button
                    type="button"
                    variant={bulkAction === "demote" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBulkAction("demote")}
                  >
                    <ArrowDown className="h-4 w-4 mr-1.5" /> Demote
                  </Button>
                </div>
              </div>

              <div className="rounded-lg border bg-muted/40 p-3 text-sm">
                {!bulkGrade ? (
                  <span className="text-muted-foreground">Select a class to continue.</span>
                ) : !bulkTarget ? (
                  <span className="text-amber-700">
                    {grades[gradeIdx]?.name} is already the {bulkAction === "promote" ? "highest" : "lowest"} class — nowhere to {bulkAction}.
                  </span>
                ) : bulkCount === 0 ? (
                  <span className="text-muted-foreground">No active students in {grades[gradeIdx]?.name}.</span>
                ) : (
                  <span>
                    Move <strong>{bulkCount}</strong> active student{bulkCount !== 1 ? "s" : ""} from{" "}
                    <strong>{grades[gradeIdx]?.name}</strong> to <strong>{bulkTarget.name}</strong>.
                  </span>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulk(false)}>Cancel</Button>
              <Button onClick={runBulk} disabled={isPending || !bulkTarget || bulkCount === 0}>
                {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Confirm
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function FilterPill({
  active, onClick, label, count,
}: {
  active: boolean; onClick: () => void; label: string; count: number;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border transition-colors",
        active
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-muted-foreground border-border hover:border-primary/30 hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex items-center justify-center rounded-full w-4 h-4 text-[10px]",
          active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}

function StudentCard({ student, isInactive }: { student: Student; isInactive: boolean }) {
  const badge = SCHOLARSHIP_BADGE[student.scholarship_type];
  const initials = student.full_name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  const statusInfo = STATUS_LABELS[student.status];

  return (
    <Link href={`/students/${student.id}`}>
      <div className="group bg-card border rounded-xl p-4 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0 text-primary font-semibold text-sm group-hover:bg-primary/15 transition-colors">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
              {student.full_name}
            </p>
            <p className="text-xs font-mono text-muted-foreground">{student.registration_number}</p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" />
            <span>{student.grade?.name ?? "No Class"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {badge && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badge.cls}`}>
                {badge.label}
              </span>
            )}
            {isInactive && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/80 border ${statusInfo.color} text-white`}>
                {statusInfo.label}
              </span>
            )}
            {isInactive && student.exit_date && (
              <span className="text-[10px] text-muted-foreground">
                {new Date(student.exit_date).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

function EmptyState({ search, hasGrades, activeTab }: { search: string; hasGrades: boolean; activeTab: string }) {
  if (!hasGrades && activeTab === "active") {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground/20 mb-4" />
        <p className="font-semibold text-muted-foreground">No grades set up yet</p>
        <p className="text-sm text-muted-foreground/70 mt-1">
          Go to <strong>Settings</strong> to add classes and fee amounts first
        </p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Users className="h-12 w-12 text-muted-foreground/20 mb-4" />
      <p className="font-semibold text-muted-foreground">
        {search ? "No students found" : activeTab === "inactive" ? "No inactive students" : "No students in this class"}
      </p>
      {search && (
        <p className="text-sm text-muted-foreground/70 mt-1">
          Try a different name or registration number
        </p>
      )}
    </div>
  );
}