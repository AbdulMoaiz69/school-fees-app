import type { FeeChallan, ScholarshipType } from "./supabase/types";

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function getMonthName(month: number) {
  return MONTHS[month - 1];
}

export function formatCurrency(amount: number) {
  return `Rs ${amount.toLocaleString("en-PK", { minimumFractionDigits: 0 })}`;
}

export function getDueDate(month: number, year: number): Date {
  return new Date(year, month - 1, 8);
}

export function getLateFeeDeadline(month: number, year: number): Date {
  return new Date(year, month - 1, 15);
}

export function getChallanStatus(challan: FeeChallan): "paid" | "unpaid" | "overdue" | "late_fee" | "arrears" {
  if (challan.is_paid) return "paid";
  const today = new Date();
  const due = new Date(challan.due_date);
  const lateFeeDeadline = getLateFeeDeadline(challan.month, challan.year);
  const nextMonthStart = new Date(challan.year, challan.month, 1);

  if (today >= nextMonthStart) return "arrears";
  if (today > lateFeeDeadline) return "arrears";
  if (today > due) return "late_fee";
  return "unpaid";
}

export const SIBLING_DISCOUNT_RATE = 0.2; // 20% off tuition for enrolled siblings

export function computeDiscount(tuitionFee: number, scholarship: ScholarshipType, customAmountPkr = 0): number {
  if (scholarship === "full") return tuitionFee;
  if (scholarship === "half") return Math.floor(tuitionFee / 2);
  if (scholarship === "sibling") return Math.floor(tuitionFee * SIBLING_DISCOUNT_RATE);
  if (scholarship === "custom") return Math.min(customAmountPkr, tuitionFee);
  return 0;
}

export function getScholarshipLabel(scholarship: ScholarshipType, customAmountPkr = 0): string {
  switch (scholarship) {
    case "full": return "Full Scholarship (100%)";
    case "half": return "Half Scholarship (50%)";
    case "sibling": return "Sibling Discount (20%)";
    case "custom": return `Custom Discount (Rs ${customAmountPkr.toLocaleString("en-PK")})`;
    default: return "No Scholarship";
  }
}

export function computeTotal(challan: {
  tuition_fee: number;
  stationary_fee: number;
  security_fee: number;
  admission_fee: number;
  mcs_fee: number;
  late_fee: number;
  arrears: number;
  discount: number;
}): number {
  const gross =
    challan.tuition_fee +
    challan.stationary_fee +
    challan.security_fee +
    challan.admission_fee +
    challan.mcs_fee +
    challan.late_fee +
    challan.arrears;
  return Math.max(0, gross - challan.discount);
}

export function getStatusBadgeVariant(status: ReturnType<typeof getChallanStatus>) {
  switch (status) {
    case "paid": return "default" as const;
    case "unpaid": return "secondary" as const;
    case "late_fee": return "outline" as const;
    case "arrears": return "destructive" as const;
    case "overdue": return "destructive" as const;
  }
}

export function getStatusLabel(status: ReturnType<typeof getChallanStatus>) {
  switch (status) {
    case "paid": return "Paid";
    case "unpaid": return "Unpaid";
    case "late_fee": return "Late Fee Applied";
    case "arrears": return "Arrears";
    case "overdue": return "Overdue";
  }
}

export function generateRegistrationNumber(existingNumbers: string[]): string {
  const year = new Date().getFullYear().toString().slice(-2);
  let num = existingNumbers.length + 1;
  let reg = `STU-${year}-${String(num).padStart(4, "0")}`;
  while (existingNumbers.includes(reg)) {
    num++;
    reg = `STU-${year}-${String(num).padStart(4, "0")}`;
  }
  return reg;
}
