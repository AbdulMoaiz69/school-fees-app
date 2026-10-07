"use client";

import { useState, useMemo, useTransition, Fragment } from "react";
import Link from "next/link";
import type { FeeChallan, Grade } from "@/lib/supabase/types";
import { generateMonthlyFees } from "@/app/actions/fees";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  formatCurrency, getChallanStatus, getMonthName, getStatusLabel, MONTHS,
} from "@/lib/fee-utils";
import { cn } from "@/lib/utils";
import { Search, Zap, Receipt, Loader2, ArrowRight, CheckCircle2, Clock, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

const STATUS_CLS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unpaid: "bg-amber-50 text-amber-700 border-amber-200",
  late_fee: "bg-orange-50 text-orange-700 border-orange-200",
  arrears: "bg-red-50 text-red-700 border-red-200",
};

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i);

interface FeesClientProps {
  initialChallans: FeeChallan[];
  grades: Grade[];
  initialMonth: number;
  initialYear: number;
}

export function FeesClient({ initialChallans, grades, initialMonth, initialYear }: FeesClientProps) {
  const router = useRouter();
  const [challans, setChallans] = useState(initialChallans);
  const [month, setMonth] = useState(initialMonth);
  const [year, setYear] = useState(initialYear);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [classFilter, setClassFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return challans.filter((c) => {
      const matchSearch = !q
        || c.student?.full_name?.toLowerCase().includes(q)
        || c.student?.registration_number?.toLowerCase().includes(q);
      const matchFilter =
        filter === "all" || (filter === "paid" && c.is_paid) || (filter === "unpaid" && !c.is_paid);
      const matchClass =
        classFilter === "all" || (c.student?.grade_id ?? "none") === classFilter;
      return matchSearch && matchFilter && matchClass;
    });
  }, [challans, search, filter, classFilter]);

  // Group the filtered challans class-wise, ordered by the grades' display order.
  const classGroups = useMemo(() => {
    const byClass = new Map<string, FeeChallan[]>();
    for (const c of filtered) {
      const key = c.student?.grade_id ?? "none";
      const bucket = byClass.get(key);
      if (bucket) bucket.push(c);
      else byClass.set(key, [c]);
    }
    const groups: { key: string; name: string; challans: FeeChallan[] }[] = [];
    for (const g of grades) {
      const list = byClass.get(g.id);
      if (list) groups.push({ key: g.id, name: g.name, challans: list });
    }
    const noClass = byClass.get("none");
    if (noClass) groups.push({ key: "none", name: "No Class", challans: noClass });
    return groups;
  }, [filtered, grades]);

  const paidCount = challans.filter((c) => c.is_paid).length;
  const unpaidCount = challans.length - paidCount;
  const totalCollected = challans.filter((c) => c.is_paid).reduce((s, c) => s + c.total, 0);

  function handlePeriodChange(m: string | null, y?: number) {
    if (!m) return;
    const nm = parseInt(m), ny = y ?? year;
    setMonth(nm); if (y) setYear(ny);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/challans?month=${nm}&year=${ny}`);
        if (res.ok) setChallans(await res.json());
      } catch { /* ignore */ }
      router.refresh();
    });
  }

  async function handleGenerate() {
    startTransition(async () => {
      try {
        const count = await generateMonthlyFees(month, year);
        toast.success(`Generated ${count} challans for ${getMonthName(month)} ${year}`);
        router.refresh();
      } catch (err: unknown) {
        toast.error(err instanceof Error ? err.message : "Failed to generate fees");
      }
    });
  }

  return (
    <div className="p-6 space-y-5">
      {/* Header controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Period picker */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={month.toString()} onValueChange={(v) => handlePeriodChange(v)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={year.toString()} onValueChange={(v) => handlePeriodChange(month.toString(), v ? parseInt(v) : undefined)}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={handleGenerate} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            <span className="ml-1.5">Generate Fees</span>
          </Button>
        </div>

        {/* Search + filter */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input className="pl-9 w-52" placeholder="Search student…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v ?? "all")}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Classes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {grades.map((g) => (
                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter((v ?? "all") as typeof filter)}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="paid">Paid</SelectItem>
              <SelectItem value="unpaid">Unpaid</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary strip */}
      {challans.length > 0 && (
        <div className="flex items-center gap-4 flex-wrap text-sm">
          <div className="flex items-center gap-2 text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            <span className="font-semibold">{paidCount} paid</span>
            <span className="text-emerald-600/70">· {formatCurrency(totalCollected)}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-700">
            <Clock className="h-4 w-4" />
            <span className="font-semibold">{unpaidCount} pending</span>
          </div>
        </div>
      )}

      {/* Table or empty state */}
      {challans.length === 0 ? (
        <div className="border border-dashed rounded-xl flex flex-col items-center justify-center py-20 text-center">
          <Receipt className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">No challans for {getMonthName(month)} {year}</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Click &ldquo;Generate Fees&rdquo; to create challans for all active students
          </p>
          <Button size="sm" onClick={handleGenerate} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2" />}
            Generate Fees
          </Button>
        </div>
      ) : (
        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Student</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Class</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Due</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground text-right">Amount</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">
                    No challans match the current filters
                  </TableCell>
                </TableRow>
              ) : (
                classGroups.map((group) => {
                  const groupTotal = group.challans.reduce((s, c) => s + c.total, 0);
                  const groupCollected = group.challans
                    .filter((c) => c.is_paid)
                    .reduce((s, c) => s + c.total, 0);
                  return (
                    <Fragment key={group.key}>
                      <TableRow className="bg-muted/30 hover:bg-muted/30 border-t">
                        <TableCell colSpan={6} className="py-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <span className="flex items-center gap-2 font-semibold text-sm">
                              <GraduationCap className="h-4 w-4 text-muted-foreground" />
                              {group.name}
                              <span className="text-xs font-normal text-muted-foreground">
                                {group.challans.length} student{group.challans.length !== 1 ? "s" : ""}
                              </span>
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {formatCurrency(groupCollected)} <span className="text-muted-foreground/50">/</span> {formatCurrency(groupTotal)} collected
                            </span>
                          </div>
                        </TableCell>
                      </TableRow>
                      {group.challans.map((c) => {
                        const status = getChallanStatus(c);
                        return (
                          <TableRow key={c.id} className="group hover:bg-muted/20">
                            <TableCell>
                              <div>
                                <p className="font-medium text-sm">{c.student?.full_name}</p>
                                <p className="text-xs text-muted-foreground font-mono">{c.student?.registration_number}</p>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{c.student?.grade?.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {new Date(c.due_date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-sm">{formatCurrency(c.total)}</TableCell>
                            <TableCell>
                              <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border ${STATUS_CLS[status]}`}>
                                {getStatusLabel(status)}
                              </span>
                            </TableCell>
                            <TableCell>
                              <Link
                                href={`/fees/${c.id}`}
                                className={cn(buttonVariants({ variant: "ghost", size: "icon" }), "h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity")}
                              >
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
