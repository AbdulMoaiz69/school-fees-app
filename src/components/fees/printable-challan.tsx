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
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const schoolName = settings.school_name ?? "School Name";
  const schoolAddress = settings.school_address ?? "";
  const schoolPhone = settings.school_phone ?? "";
  const schoolLogo = settings.school_logo ?? "";
  const student = challan.student;
  const currentMonthYear = `${getMonthName(challan.month)} ${challan.year}`;

  const feeRows = [
    { label: `Tuition Fee (${currentMonthYear})`, amount: challan.tuition_fee },
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
      ? [{ label: "Arrears (Previous Months)", amount: challan.arrears }]
      : []),
    ...(challan.late_fee > 0
      ? [{
          label: challan.late_fee_note
            ? `Fine (${challan.late_fee_note})`
            : "Fine",
          amount: challan.late_fee
        }]
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
          {schoolLogo && <img src={schoolLogo} alt="School Logo" className="h-28 w-auto mx-auto mb-2" />}
          <h2 className="text-xl font-bold">{schoolName}</h2>
          {schoolAddress && <p className="text-sm text-muted-foreground">{schoolAddress}</p>}
          {schoolPhone && <p className="text-sm text-muted-foreground">{schoolPhone}</p>}
          <p className="text-sm font-semibold mt-2">FEE CHALLAN — {currentMonthYear}</p>
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

      {/* Printable Area (A4) — portaled to <body> */}
      {mounted && createPortal(
        <div className="print-root">
          <style jsx>{`
            @page {
              size: A4;
              margin: 0;
            }
            @media print {
              .print-root {
                width: 210mm;
                height: 297mm;
              }
            }
          `}</style>
          <div style={{
            width: "210mm",
            height: "297mm",
            fontFamily: "Arial, sans-serif",
            fontSize: "9pt",
            boxSizing: "border-box",
            color: "#000",
            background: "#fff",
            position: "relative",
            overflow: "hidden"
          }}>
            {/* Two copies on one A4 — Office Copy (top half) + Student Copy (bottom half) */}
            {(["Office Copy", "Student Copy"] as const).map((copyLabel, idx) => (
              <Fragment key={copyLabel}>
                <div
                  style={{
                    width: "100%",
                    height: "148.5mm",
                    boxSizing: "border-box",
                    border: "1px solid #ccc",
                    padding: "3mm 4mm",
                    position: "relative",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {/* Cut line divider */}
                  {idx === 1 && (
                    <div style={{
                      position: "absolute",
                      top: "-1px",
                      left: "0",
                      right: "0",
                      borderTop: "1px dashed #999",
                      textAlign: "center",
                      fontSize: "6pt",
                      color: "#999",
                      letterSpacing: "0.1em",
                      paddingTop: "0.5mm"
                    }}>
                      ✂ ✂ ✂ Cut Here ✂ ✂ ✂
                    </div>
                  )}

                  {/* Copy label */}
                  <div style={{
                    position: "absolute",
                    top: "2mm",
                    right: "3mm",
                    fontSize: "7pt",
                    color: "#888",
                    border: "1px solid #ccc",
                    padding: "0.3mm 2mm",
                    borderRadius: "1.5mm",
                    background: "#fafafa"
                  }}>
                    {copyLabel}
                  </div>

                  {/* School Header */}
                  <div style={{
                    textAlign: "center",
                    borderBottom: "1.5px solid #000",
                    paddingBottom: "1.5mm",
                    marginBottom: "2mm",
                    flexShrink: 0
                  }}>
                    {schoolLogo && <img src={schoolLogo} alt="School Logo" style={{ height: "55px", width: "auto", marginBottom: "1.5mm" }} />}
                    <h2 style={{ margin: 0, fontSize: "11pt", fontWeight: "bold", lineHeight: 1.2 }}>{schoolName}</h2>
                    {schoolAddress && <p style={{ margin: "0.3mm 0 0", fontSize: "7pt", color: "#555", lineHeight: 1.2 }}>{schoolAddress}</p>}
                    {schoolPhone && <p style={{ margin: "0.3mm 0 0", fontSize: "7pt", color: "#555" }}>Tel: {schoolPhone}</p>}
                    <p style={{ margin: "1mm 0 0", fontSize: "9pt", fontWeight: "bold", textTransform: "uppercase" }}>
                      FEE CHALLAN — {currentMonthYear.toUpperCase()}
                    </p>
                  </div>

                  {/* Student Info Grid */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "1.5mm 3mm",
                    marginBottom: "2mm",
                    fontSize: "8pt",
                    flexShrink: 0
                  }}>
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
                  <table style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "8.5pt",
                    flex: "1 1 auto",
                    minHeight: 0
                  }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #000" }}>
                        <th style={{ textAlign: "left", padding: "0.8mm 1.5mm", fontWeight: "bold", fontSize: "8pt" }}>Description</th>
                        <th style={{ textAlign: "right", padding: "0.8mm 1.5mm", fontWeight: "bold", fontSize: "8pt" }}>Amount (Rs)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {feeRows.map((row, i) => (
                        <tr key={row.label} style={{ borderBottom: "0.5px solid #e0e0e0", background: i % 2 === 0 ? "#fafafa" : "#fff" }}>
                          <td style={{ padding: "0.8mm 1.5mm", fontSize: "8.5pt" }}>{row.label}</td>
                          <td style={{ textAlign: "right", padding: "0.8mm 1.5mm", fontSize: "8.5pt" }}>
                            {row.amount.toLocaleString("en-PK")}
                          </td>
                        </tr>
                      ))}
                      {discount > 0 && (
                        <tr style={{ color: "#16a34a" }}>
                          <td style={{ padding: "0.8mm 1.5mm", fontSize: "8.5pt" }}>{scholarshipLabel ?? "Discount"}</td>
                          <td style={{ textAlign: "right", padding: "0.8mm 1.5mm", fontSize: "8.5pt" }}>
                            - {discount.toLocaleString("en-PK")}
                          </td>
                        </tr>
                      )}
                    </tbody>
                    <tfoot>
                      <tr style={{ borderTop: "1.5px solid #000", fontWeight: "bold" }}>
                        <td style={{ padding: "1.2mm 1.5mm", fontSize: "9pt" }}>TOTAL</td>
                        <td style={{ textAlign: "right", padding: "1.2mm 1.5mm", fontSize: "10pt" }}>
                          Rs {challan.total.toLocaleString("en-PK")}
                        </td>
                      </tr>
                    </tfoot>
                  </table>

                  {/* Footer row */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr",
                    gap: "2mm",
                    marginTop: "2mm",
                    paddingTop: "1.5mm",
                    borderTop: "0.5px solid #ccc",
                    fontSize: "6.5pt",
                    flexShrink: 0
                  }}>
                    <div>
                      <p style={{ margin: 0, color: "#888" }}>Cashier Signature</p>
                      <div style={{ marginTop: "2mm", borderBottom: "1px solid #000", width: "100%" }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#888" }}>Date Paid</p>
                      <div style={{ marginTop: "2mm", borderBottom: "1px solid #000", width: "100%" }} />
                    </div>
                    <div>
                      <p style={{ margin: 0, color: "#888" }}>Stamp</p>
                      <div style={{ marginTop: "1.5mm", height: "5mm", border: "1px dashed #ccc" }} />
                    </div>
                  </div>

                  {challan.is_paid && (
                    <div style={{
                      position: "absolute",
                      top: "35%",
                      left: "30%",
                      transform: "rotate(-20deg)",
                      opacity: 0.12,
                      fontSize: "32pt",
                      fontWeight: "bold",
                      color: "#16a34a",
                      pointerEvents: "none",
                      userSelect: "none",
                      whiteSpace: "nowrap"
                    }}>
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
      <p style={{ margin: 0, fontSize: "6.5pt", color: "#888", textTransform: "uppercase", letterSpacing: "0.05em", lineHeight: 1.2 }}>{label}</p>
      <p style={{ margin: "0.3mm 0 0", fontWeight: "600", fontFamily: mono ? "monospace" : "inherit", fontSize: "8pt", lineHeight: 1.2 }}>{value}</p>
    </div>
  );
}