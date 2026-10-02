"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import type { Student, Grade } from "@/lib/supabase/types";

interface ClassListDownloadButtonProps {
  grade: Grade;
}

// Scholarship label helper
function scholarshipLabel(type: string): string {
  switch (type) {
    case "half":
      return "Half Scholarship";
    case "full":
      return "Full Scholarship";
    case "sibling":
      return "Sibling Discount";
    default:
      return "—";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-PK", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ClassListDownloadButton({ grade }: ClassListDownloadButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleDownload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/class-list/${grade.id}`);
      if (!res.ok) throw new Error("Failed to fetch class list");
      const { students, settings } = (await res.json()) as {
        students: Student[];
        settings: Record<string, string>;
      };

      const schoolName = settings["school_name"] ?? "School";
      const schoolAddress = settings["school_address"] ?? "";
      const schoolPhone = settings["school_phone"] ?? "";
      const today = new Date().toLocaleDateString("en-PK", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });

      const rows = students
        .map(
          (s, i) => `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            <td class="center">${i + 1}</td>
            <td class="center mono">${s.registration_number}</td>
            <td>${s.full_name}</td>
            <td>${s.parent_name ?? "—"}</td>
            <td class="center">${formatDate(s.date_of_birth)}</td>
            <td class="center">${formatDate(s.admission_date)}</td>
            <td>${s.address ?? "—"}</td>
            <td class="center">${s.parent_phone ?? "—"}</td>
            <td class="center">${
              s.scholarship_type !== "none" ? scholarshipLabel(s.scholarship_type) : "—"
            }</td>
            <td>${s.previous_school ?? "—"}</td>
          </tr>`
        )
        .join("");

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Class List – ${grade.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 10px;
      color: #111;
      padding: 18px 24px;
    }
    .header {
      text-align: center;
      margin-bottom: 14px;
      border-bottom: 2px solid #1e3a5f;
      padding-bottom: 10px;
    }
    .school-name {
      font-size: 18px;
      font-weight: 700;
      color: #1e3a5f;
      letter-spacing: 0.5px;
    }
    .school-meta {
      font-size: 9px;
      color: #555;
      margin-top: 2px;
    }
    .report-title {
      font-size: 13px;
      font-weight: 700;
      color: #1e3a5f;
      margin-top: 6px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      font-size: 9px;
      color: #555;
      margin-bottom: 10px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    thead tr {
      background: #1e3a5f;
      color: #fff;
    }
    thead th {
      padding: 6px 5px;
      text-align: left;
      font-size: 9px;
      font-weight: 600;
      white-space: nowrap;
    }
    th.center, td.center { text-align: center; }
    tbody tr.even { background: #f3f7fc; }
    tbody tr.odd { background: #ffffff; }
    tbody td {
      padding: 5px 5px;
      border-bottom: 1px solid #dde4ee;
      vertical-align: top;
      word-break: break-word;
    }
    .mono { font-family: "Courier New", monospace; font-size: 9px; }
    .footer {
      margin-top: 16px;
      display: flex;
      justify-content: space-between;
      border-top: 1px solid #ccc;
      padding-top: 8px;
      font-size: 9px;
      color: #666;
    }
    .summary {
      background: #f3f7fc;
      border: 1px solid #dde4ee;
      border-radius: 4px;
      padding: 6px 10px;
      font-size: 9.5px;
      margin-bottom: 10px;
      display: flex;
      gap: 24px;
    }
    .summary span b { color: #1e3a5f; }
    @media print {
      body { padding: 10px 12px; }
      @page { margin: 10mm; size: A4 landscape; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="school-name">${schoolName}</div>
    ${
      schoolAddress || schoolPhone
        ? `<div class="school-meta">${[schoolAddress, schoolPhone].filter(Boolean).join(" &nbsp;|&nbsp; ")}</div>`
        : ""
    }
    <div class="report-title">Class Student List — ${grade.name}</div>
  </div>

  <div class="meta-row">
    <span>Generated: <b>${today}</b></span>
    <span>Class: <b>${grade.name}</b> &nbsp;|&nbsp; Monthly Fee: <b>Rs ${Number(grade.monthly_fee).toLocaleString("en-PK")}</b></span>
  </div>

  <div class="summary">
    <span>Total Students: <b>${students.length}</b></span>
    <span>Scholarship Students: <b>${students.filter((s) => s.scholarship_type !== "none").length}</b></span>
    <span>Full Scholarship: <b>${students.filter((s) => s.scholarship_type === "full").length}</b></span>
    <span>Half Scholarship: <b>${students.filter((s) => s.scholarship_type === "half").length}</b></span>
    <span>Sibling Discount: <b>${students.filter((s) => s.scholarship_type === "sibling").length}</b></span>
  </div>

  <table>
    <thead>
      <tr>
        <th class="center" style="width:28px">#</th>
        <th class="center" style="width:72px">Admission ID</th>
        <th style="width:120px">Full Name</th>
        <th style="width:110px">Father Name</th>
        <th class="center" style="width:78px">Date of Birth</th>
        <th class="center" style="width:78px">Admission Date</th>
        <th style="width:130px">Address</th>
        <th class="center" style="width:80px">Phone</th>
        <th class="center" style="width:85px">Scholarship</th>
        <th style="width:100px">Previous School</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="10" style="text-align:center;padding:16px;color:#999;">No students found in this class.</td></tr>'}
    </tbody>
  </table>

  <div class="footer">
    <span>${schoolName} — Confidential</span>
    <span>Page 1</span>
    <span>Printed on ${today}</span>
  </div>

  <script>
    window.onload = function () { window.print(); };
  </script>
</body>
</html>`;

      // Open in a new window and trigger print → Save as PDF
      const win = window.open("", "_blank", "width=1100,height=750");
      if (!win) {
        alert("Please allow pop-ups for this site to download the class list.");
        return;
      }
      win.document.write(html);
      win.document.close();
    } catch (err) {
      console.error(err);
      alert("Failed to generate class list. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [grade]);

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-5 w-5 ml-0.5 text-muted-foreground hover:text-primary"
      title={`Download ${grade.name} class list`}
      onClick={(e) => {
        e.stopPropagation();
        handleDownload();
      }}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : (
        <FileDown className="h-3 w-3" />
      )}
    </Button>
  );
}
