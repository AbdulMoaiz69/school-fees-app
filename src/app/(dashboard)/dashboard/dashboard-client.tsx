"use client";

import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, getMonthName } from "@/lib/fee-utils";
import type { ExpenseAnalytics } from "@/app/actions/expenses";
import { cn } from "@/lib/utils";
import {
  Users, CheckCircle2, Clock, Banknote, Award, GraduationCap, Zap, TrendingUp,
  Wallet, TrendingDown, Scale,
} from "lucide-react";

interface DashboardClientProps {
  stats: {
    totalStudents: number;
    totalChallans: number;
    paidCount: number;
    unpaidCount: number;
    totalCollected: number;
    totalExpected: number;
    predictedCollection: number;
    fullScholarships: number;
    halfScholarships: number;
  };
  settings: Record<string, string>;
  treasury: ExpenseAnalytics;
  month: number;
  year: number;
}

export function DashboardClient({ stats, settings, treasury, month, year }: DashboardClientProps) {
  const rate = stats.totalChallans > 0 ? Math.round((stats.paidCount / stats.totalChallans) * 100) : 0;
  const schoolName = settings.school_name || "School";
  const netThisMonth = stats.totalCollected - treasury.thisMonthExpenses;

  return (
    <div className="p-6 space-y-6">
      {/* Welcome header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{schoolName}</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Fee summary for <strong>{getMonthName(month)} {year}</strong>
          </p>
        </div>
        {stats.totalChallans === 0 && (
          <Link href="/fees" className={cn(buttonVariants({ size: "sm" }))}>
            <Zap className="h-4 w-4 mr-1.5" />Generate Fees
          </Link>
        )}
      </div>

      {/* Top row — key numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <StatCard title="Total Students" value={stats.totalStudents} icon={Users} color="blue" href="/students" />
        <StatCard
          title="Fees Collected"
          value={formatCurrency(stats.totalCollected)}
          sub={`of ${formatCurrency(stats.totalExpected)}`}
          icon={Banknote} color="green"
        />
        <StatCard
          title="Predicted Collection"
          value={formatCurrency(stats.predictedCollection)}
          sub="if all students pay"
          icon={TrendingUp} color="blue"
        />
        <StatCard
          title="Paid Challans"
          value={stats.paidCount}
          sub={`${stats.unpaidCount} still pending`}
          icon={CheckCircle2} color="emerald"
          href={stats.paidCount > 0 ? "/fees" : undefined}
        />
        <StatCard
          title="Collection Rate"
          value={`${rate}%`}
          sub={`${stats.totalChallans} challans total`}
          icon={TrendingUp}
          color={rate >= 80 ? "emerald" : rate >= 50 ? "amber" : "red"}
        />
      </div>

      {/* Treasury row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          title="Treasury Balance"
          value={formatCurrency(treasury.treasuryBalance)}
          sub="opening + fees − expenses"
          icon={Wallet}
          color={treasury.treasuryBalance >= 0 ? "emerald" : "red"}
          href="/expenses"
        />
        <StatCard
          title="Expenses This Month"
          value={formatCurrency(treasury.thisMonthExpenses)}
          sub={`${getMonthName(month)} spending`}
          icon={TrendingDown}
          color="red"
          href="/expenses"
        />
        <StatCard
          title="Net This Month"
          value={formatCurrency(netThisMonth)}
          sub="collected − expenses"
          icon={Scale}
          color={netThisMonth >= 0 ? "emerald" : "red"}
        />
      </div>

      {/* Second row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard title="Pending" value={stats.unpaidCount} sub="challans unpaid" icon={Clock} color={stats.unpaidCount > 0 ? "amber" : "emerald"} href="/fees" />
        <StatCard title="Full Scholarship" value={stats.fullScholarships} sub="100% fee waiver" icon={Award} color="purple" />
        <StatCard title="Half Scholarship" value={stats.halfScholarships} sub="50% fee waiver" icon={GraduationCap} color="indigo" />
      </div>

      {/* Progress bar */}
      {stats.totalChallans > 0 && (
        <div className="bg-card border rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Monthly Collection Progress</span>
            <span className="font-bold text-primary">{rate}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-700"
              style={{ width: `${rate}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="text-emerald-600 font-medium">{formatCurrency(stats.totalCollected)} collected</span>
            <span>{formatCurrency(stats.totalExpected - stats.totalCollected)} remaining</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.totalChallans === 0 && (
        <div className="border border-dashed rounded-xl flex flex-col items-center justify-center py-16 text-center">
          <Banknote className="h-12 w-12 text-muted-foreground/20 mb-4" />
          <p className="font-semibold text-muted-foreground">No challans yet for {getMonthName(month)}</p>
          <p className="text-sm text-muted-foreground/70 mt-1 mb-4">
            Generate fees to create challans for all active students
          </p>
          <Link href="/fees" className={cn(buttonVariants({ size: "sm" }))}>
            <Zap className="h-4 w-4 mr-2" />Go to Fee Challans
          </Link>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title, value, sub, icon: Icon, color, href,
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; href?: string;
}) {
  const colors: Record<string, string> = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
    red: "text-red-600 bg-red-50",
    purple: "text-purple-600 bg-purple-50",
    indigo: "text-indigo-600 bg-indigo-50",
  };

  const inner = (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide truncate">{title}</p>
        <p className="text-2xl font-bold mt-1 leading-none">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1.5 truncate">{sub}</p>}
      </div>
      <div className={cn("p-2 rounded-lg shrink-0", colors[color] ?? "text-gray-600 bg-gray-50")}>
        <Icon className="h-4 w-4" />
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href}>
        <Card className="hover:border-primary/30 hover:shadow-sm transition-all cursor-pointer">
          <CardContent className="p-5">{inner}</CardContent>
        </Card>
      </Link>
    );
  }
  return (
    <Card>
      <CardContent className="p-5">{inner}</CardContent>
    </Card>
  );
}
