"use client";

import { Fragment, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { FeeChallan } from "@/lib/supabase/types";
import { formatCurrency, getMonthName } from "@/lib/fee-utils";
import { Separator } from "@/components/ui/separator";

interface PrintableChallanProps {
  challan: FeeChallan;
  settings: Record<string, string>;
}

export function PrintableChallan({ challan, settings }: PrintableChallanProps) {
  // Portal target only exists after mount (avoids SSR mismatch)
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const schoolName = settings.school_name ?? "School Name";
  const schoolAddress = settings.school_address ?? "";
  const schoolPhone = settings.school_phone ?? "";
  const schoolLogo = settings.school_logo ?? "";
  const student = challan.student;
  const monthYear = `${getMonthName(challan.month)} ${challan.year}`;

  const feeRows = [
    { label: "Tuition Fee", amount: challan.tuition_fee },
    ...(challan.stationary_fee > 0
      ? [{ label: "Stationary", amount: challan.stationary_fee }]
      : []),
    ...(challan.security_fee > 0
      ? [{ label: "Security Fee", amount: challan.security_fee }]
      : []),
    ...(challan.admission_fee > 0
      ? [{ label: "Admission Fee", amount: challan.admission_fee }]
      : []),
    ...(challan.mcs_fee > 0
      ? [{ label: "MCS", amount: challan.mcs_fee }]
      : []),
    ...(challan.arrears > 0
      ? [{ label: "Arrears", amount: challan.arrears }]
      : []),
    ...(challan.late_fee > 0
      ? [{ label: "Late Fee", amount: challan.late_fee }]
      : []),
  ];

  const discount = challan.discount;
  const scholarshipLabel =
    challan.scholarship_type === "full"
      ? "Full Scholarship (100%)"
      : challan.scholarship_type === "half"
      ? "Half Scholarship (50%)"
      : challan.scholarship_type === "sibling"
      ? "Sibling Discount (20%)"
      : null;

  return (
    <>
      {/* Screen preview card */}
      <div className="no-print bg-card border rounded-xl p-6 max-w-2xl space-y-4">
        <div className="text-center border-b pb-4">
          {schoolLogo && <img src={schoolLogo} alt="School Logo" className="h-20 w-auto mx-auto mb-2" />}
          <h2 className="text-xl font-bold">{schoolName}</h2>
          {schoolAddress && <p className="text-sm text-muted-foreground">{schoolAddress}</p>}
          {schoolPhone && <p className="text-sm text-muted-foreground">{schoolPhone}</p>}
          <p className="text-sm font-semibold mt-2">FEE CHALLAN — {monthYear}</p>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Student</p>
            <p className="font-semibold">{student?.full_name}</p>
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              {student?.registration_number}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Class</p>
            <p className="font-semibold">{student?.grade?.name}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Due Date</p>
            <p className="font-semibold">
              {new Date(challan.due_date).toLocaleDateString("en-PK", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide">Status</p>
            <p className={`font-semibold ${challan.is_paid ? "text-emerald-600" : "text-amber-600"}`}>
              {challan.is_paid ? "PAID" : "UNPAID"}
            </p>
          </div>
        </div>

        <Separator />

        <div className="space-y-2">
          {feeRows.map((row) => (
            <div key={row.label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{row.label}</span>
              <span className="font-medium">{formatCurrency(row.amount)}</span>
            </div>
          ))}
          {discount > 0 && (
            <div className="flex justify-between text-sm text-green-600">
              <span>{scholarshipLabel ?? "Discount"}</span>
              <span>- {formatCurrency(discount)}</span>
            </div>
          )}
          <Separator />
          <div className="flex justify-between font-bold text-base">
            <span>Total</span>
            <span>{formatCurrency(challan.total)}</span>
          </div>
        </div>

        {challan.is_paid && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-800">
            <span className="font-semibold">Paid</span>
            {challan.paid_at && (
              <span className="text-emerald-600 ml-2">
                on{" "}
                {new Date(challan.paid_at).toLocaleDateString("en-PK", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            )}
            {challan.paid_by && (
              <span className="text-emerald-600 ml-1">by {challan.paid_by}</span>
            )}
          </div>
        )}
      </div>

      {/* Printable Area (A4) — portaled to <body> so it isn't hidden by the app shell on print */}
      {mounted && createPortal(
        <div className="print-root">
        <div style={{ width: "100%", fontFamily: "Arial, sans-serif", fontSize: "11pt", boxSizing: "border-box", color: "#000", background: "#fff" }}>
          {/* Two copies on one A4 — Office Copy (top) + Student Copy (bottom), cut along the dashed line */}
          {(["Office Copy", "Student Copy"] as const).map((copyLabel, idx) => (
            <Fragment key={copyLabel}>
              {idx === 1 && (
                <div style={{ textAlign: "center", fontSize: "7pt", color: "#999", borderTop: "1px dashed #aaa", margin: "4mm 0", paddingTop: "1mm", letterSpacing: "0.1em" }}>
                  ✂ cut here
                </div>
              )}
              <div
                style={{
                  border: "1px solid #ccc",
                  padding: "5mm",
                  position: "relative",
                  breakInside: "avoid",
                  pageBreakInside: "avoid",
                }}
              >
              {/* Copy label */}
              <div
                style={{
                  position: "absolute",
                  top: "3mm",
                  right: "4mm",
                  fontSize: "8pt",
                  color: "#888",
                  border: "1px solid #ccc",
                  padding: "0.5mm 2.5mm",
                  borderRadius: "2mm",
                }}
              >
                {copyLabel}
              </div>

              {/* School Header */}
              <div style={{ textAlign: "center", borderBottom: "2px solid #000", paddingBottom: "2mm", marginBottom: "3mm" }}>
                {schoolLogo && <img src={schoolLogo} alt="School Logo" style={{ height: "50px", width: "auto", marginBottom: "2mm" }} />}
                <h2 style={{ margin: 0, fontSize: "13pt", fontWeight: "bold" }}>{schoolName}</h2>
                {schoolAddress && <p style={{ margin: "0.5mm 0 0", fontSize: "8pt", color: "#555" }}>{schoolAddress}</p>}
                {schoolPhone && <p style={{ margin: "0.5mm 0 0", fontSize: "8pt", color: "#555" }}>Tel: {schoolPhone}</p>}
                <p style={{ margin: "1.5mm 0 0", fontSize: "10pt", fontWeight: "bold" }}>
                  FEE CHALLAN — {monthYear.toUpperCase()}
                </p>
              </div>

              {/* Student Info Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2mm 4mm", marginBottom: "3mm" }}>
                <InfoCell label="Student Name" value={student?.full_name ?? ""} />
                <InfoCell label="Registration No." value={student?.registration_number ?? ""} mono />
                <InfoCell label="Class / Grade" value={student?.grade?.name ?? ""} />
                <InfoCell
                  label="Due Date"
                  value={new Date(challan.due_date).toLocaleDateString("en-PK", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                />
                {student?.parent_name && (
                  <InfoCell label="Parent Name" value={student.parent_name} />
                )}
                {student?.parent_phone && (
                  <InfoCell label="Contact" value={student.parent_phone} />
                )}
              </div>

              {/* Fee Table */}
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "9.5pt" }}>
                <thead>
                  <tr style={{ borderBottom: "1.5px solid #000" }}>
                    <th style={{ textAlign: "left", padding: "1mm 2mm", fontWeight: "bold" }}>Description</th>
                    <th style={{ textAlign: "right", padding: "1mm 2mm", fontWeight: "bold" }}>Amount (Rs)</th>
                  </tr>
                </thead>
                <tbody>
                  {feeRows.map((row, i) => (
                    <tr key={row.label} style={{ borderBottom: "0.5px solid #e0e0e0", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                      <td style={{ padding: "1mm 2mm" }}>{row.label}</td>
                      <td style={{ textAlign: "right", padding: "1mm 2mm" }}>
                        {row.amount.toLocaleString("en-PK")}
                      </td>
                    </tr>
                  ))}
                  {discount > 0 && (
                    <tr style={{ color: "#16a34a" }}>
                      <td style={{ padding: "1mm 2mm" }}>{scholarshipLabel ?? "Discount"}</td>
                      <td style={{ textAlign: "right", padding: "1mm 2mm" }}>
                        - {discount.toLocaleString("en-PK")}
                      </td>
                    </tr>
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ borderTop: "2px solid #000", fontWeight: "bold" }}>
                    <td style={{ padding: "1.5mm 2mm" }}>TOTAL</td>
                    <td style={{ textAlign: "right", padding: "1.5mm 2mm", fontSize: "11pt" }}>
                      Rs {challan.total.toLocaleString("en-PK")}
                    </td>
                  </tr>
                </tfoot>
              </table>

              {/* Footer row */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "3mm", marginTop: "3mm", paddingTop: "2mm", borderTop: "0.5px solid #ccc" }}>
                <div>
                  <p style={{ fontSize: "7.5pt", color: "#888", margin: 0 }}>Cashier Signature</p>
                  <div style={{ marginTop: "3mm", borderBottom: "1px solid #000", width: "100%" }} />
                </div>
                <div>
                  <p style={{ fontSize: "7.5pt", color: "#888", margin: 0 }}>Date Paid</p>
                  <div style={{ marginTop: "3mm", borderBottom: "1px solid #000", width: "100%" }} />
                </div>
                <div>
                  <p style={{ fontSize: "7.5pt", color: "#888", margin: 0 }}>Stamp</p>
                  <div style={{ marginTop: "2mm", height: "7mm", border: "1px dashed #ccc" }} />
                </div>
              </div>

              {challan.is_paid && (
                <div
                  style={{
                    position: "absolute",
                    top: "35%",
                    left: "32%",
                    transform: "rotate(-20deg)",
                    opacity: 0.15,
                    fontSize: "40pt",
                    fontWeight: "bold",
                    color: "#16a34a",
                    pointerEvents: "none",
                    userSelect: "none",
                  }}
                >
                  PAID
                </div>
              )}
              </div>
            </Fragment>
          ))}
        </div>
        </div>,
        document.body
      )}
    </>
  );
}

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <p style={{ margin: 0, fontSize: "8pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</p>
      <p style={{ margin: "0.5mm 0 0", fontWeight: "600", fontFamily: mono ? "monospace" : "inherit" }}>{value}</p>
    </div>
  );
}
