"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FeeChallan } from "@/lib/supabase/types";
import { markChallanPaid, markChallanUnpaid, updateChallan } from "@/app/actions/fees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { getChallanStatus, getMonthName, getStatusLabel, formatCurrency } from "@/lib/fee-utils";
import { PrintableChallan } from "@/components/fees/printable-challan";
import { CheckCircle, XCircle, Printer, Loader2, Pencil, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props { challan: FeeChallan; settings: Record<string, string>; }

const STATUS_CLS: Record<string, string> = {
  paid: "text-emerald-700 bg-emerald-50 border-emerald-200",
  unpaid: "text-amber-700 bg-amber-50 border-amber-200",
  late_fee: "text-orange-700 bg-orange-50 border-orange-200",
  arrears: "text-red-700 bg-red-50 border-red-200",
};

const FEE_FIELDS: [keyof EditForm, string][] = [
  ["stationary_fee", "Stationary"],
  ["security_fee", "Security Fee"],
  ["admission_fee", "Admission Fee"],
  ["mcs_fee", "MCS"],
  ["arrears", "Arrears"],
];

type EditForm = {
  stationary_fee: string;
  security_fee: string;
  admission_fee: string;
  mcs_fee: string;
  arrears: string;
};

export function ChallanDetailClient({ challan, settings }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPayDialog, setShowPayDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [paidBy, setPaidBy] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  const [editForm, setEditForm] = useState<EditForm>({
    stationary_fee: challan.stationary_fee.toString(),
    security_fee: challan.security_fee.toString(),
    admission_fee: challan.admission_fee.toString(),
    mcs_fee: challan.mcs_fee.toString(),
    arrears: challan.arrears.toString(),
  });

  const status = getChallanStatus(challan);

  async function handleMarkPaid() {
    if (!paidBy.trim()) { toast.error("Enter who received the payment"); return; }
    startTransition(async () => {
      try {
        await markChallanPaid(challan.id, paidBy, paymentNotes);
        toast.success("Marked as paid");
        setShowPayDialog(false);
        router.refresh();
      } catch { toast.error("Failed to update"); }
    });
  }

  async function handleMarkUnpaid() {
    startTransition(async () => {
      try {
        await markChallanUnpaid(challan.id);
        toast.success("Marked as unpaid");
        router.refresh();
      } catch { toast.error("Failed to update"); }
    });
  }

  async function handleSaveEdit() {
    startTransition(async () => {
      try {
        await updateChallan(challan.id, Object.fromEntries(
          FEE_FIELDS.map(([k]) => [k, parseFloat(editForm[k]) || 0])
        ) as Parameters<typeof updateChallan>[1]);
        toast.success("Challan updated");
        setShowEditDialog(false);
        router.refresh();
      } catch { toast.error("Failed to update challan"); }
    });
  }

  return (
    <div className="p-6 space-y-4">
      {/* Action bar */}
      <div className="flex items-center justify-between no-print">
        <div className="flex items-center gap-3">
          <Link href="/fees" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "gap-1.5 -ml-2")}>
            <ChevronLeft className="h-4 w-4" /> Fee Challans
          </Link>
          <span className={`text-xs font-semibold px-3 py-1 rounded-full border ${STATUS_CLS[status]}`}>
            {getStatusLabel(status)}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!challan.is_paid && (
            <Button size="sm" variant="outline" onClick={() => setShowEditDialog(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />Edit Fees
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1.5" />Print
          </Button>
          {challan.is_paid ? (
            <Button size="sm" variant="outline" onClick={handleMarkUnpaid} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <XCircle className="h-4 w-4 mr-1.5" />}
              Mark Unpaid
            </Button>
          ) : (
            <Button size="sm" onClick={() => setShowPayDialog(true)} disabled={isPending}>
              {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <CheckCircle className="h-4 w-4 mr-1.5" />}
              Mark as Paid
            </Button>
          )}
        </div>
      </div>

      <PrintableChallan challan={challan} settings={settings} />

      {/* Mark Paid Dialog */}
      <Dialog open={showPayDialog} onOpenChange={setShowPayDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-muted/50 rounded-lg p-4">
              <p className="text-sm text-muted-foreground">{challan.student?.full_name}</p>
              <p className="text-sm text-muted-foreground">{getMonthName(challan.month)} {challan.year}</p>
              <p className="text-2xl font-bold mt-1">{formatCurrency(challan.total)}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="paid_by">Received by <span className="text-destructive">*</span></Label>
              <Input id="paid_by" placeholder="Finance operator name" value={paidBy} onChange={(e) => setPaidBy(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" placeholder="e.g. Cash payment, bank transfer…" rows={2} value={paymentNotes} onChange={(e) => setPaymentNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayDialog(false)}>Cancel</Button>
            <Button onClick={handleMarkPaid} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirm Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Fees Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Edit Fee Components</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            {FEE_FIELDS.map(([key, label]) => (
              <div key={key} className="space-y-1.5">
                <Label htmlFor={key}>{label} <span className="text-muted-foreground text-xs">(Rs)</span></Label>
                <Input
                  id={key} type="number" min="0" step="1"
                  value={editForm[key]}
                  onChange={(e) => setEditForm((p) => ({ ...p, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>Cancel</Button>
            <Button onClick={handleSaveEdit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
