"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2, Check, X } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import type { Student, Grade } from "@/lib/supabase/types";

interface ClassListDownloadButtonProps {
  grade: Grade;
}

type FieldKey =
  | "serial"
  | "registration_number"
  | "full_name"
  | "parent_name"
  | "date_of_birth"
  | "admission_date"
  | "address"
  | "parent_phone"
  | "scholarship_type"
  | "previous_school";

const ALL_FIELDS: { key: FieldKey; label: string; default: boolean }[] = [
  { key: "serial", label: "#", default: true },
  { key: "registration_number", label: "Admission ID", default: true },
  { key: "full_name", label: "Full Name", default: true },
  { key: "parent_name", label: "Father Name", default: true },
  { key: "date_of_birth", label: "Date of Birth", default: true },
  { key: "admission_date", label: "Admission Date", default: true },
  { key: "address", label: "Address", default: true },
  { key: "parent_phone", label: "Phone", default: true },
  { key: "scholarship_type", label: "Scholarship", default: true },
  { key: "previous_school", label: "Previous School", default: true },
];

const DEFAULT_FIELDS: FieldKey[] = ALL_FIELDS.filter((f) => f.default).map((f) => f.key);

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

function getCellValue(student: Student, field: FieldKey, index: number): string {
  switch (field) {
    case "serial":
      return String(index + 1);
    case "registration_number":
      return student.registration_number;
    case "full_name":
      return student.full_name;
    case "parent_name":
      return student.parent_name ?? "—";
    case "date_of_birth":
      return formatDate(student.date_of_birth);
    case "admission_date":
      return formatDate(student.admission_date);
    case "address":
      return student.address ?? "—";
    case "parent_phone":
      return student.parent_phone ?? "—";
    case "scholarship_type":
      return student.scholarship_type !== "none" ? scholarshipLabel(student.scholarship_type) : "—";
    case "previous_school":
      return student.previous_school ?? "—";
    default:
      return "—";
  }
}

function getCellAlign(field: FieldKey): string {
  const centerFields: FieldKey[] = ["serial", "registration_number", "date_of_birth", "admission_date", "parent_phone", "scholarship_type"];
  return centerFields.includes(field) ? "center" : "";
}

export function ClassListDownloadButton({ grade }: ClassListDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<FieldKey[]>(DEFAULT_FIELDS);

  function toggleField(field: FieldKey) {
    setSelectedFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  function selectAll() {
    setSelectedFields(ALL_FIELDS.map((f) => f.key));
  }

  function selectNone() {
    setSelectedFields([]);
  }

  const handleDownload = useCallback(async () => {
    if (selectedFields.length === 0) {
      alert("Please select at least one field.");
      return;
    }

    setLoading(true);
    setDialogOpen(false);
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

      // Build header row
      const headerCells = selectedFields
        .map((field) => {
          const fieldDef = ALL_FIELDS.find((f) => f.key === field);
          const align = getCellAlign(field) ? 'class="center"' : "";
          return `<th ${align}>${fieldDef?.label ?? field}</th>`;
        })
        .join("");

      // Build data rows
      const rows = students
        .map(
          (s, i) => `
          <tr class="${i % 2 === 0 ? "even" : "odd"}">
            ${selectedFields
              .map((field) => {
                const align = getCellAlign(field) ? 'class="center"' : "";
                const isMono = field === "registration_number" ? 'class="center mono"' : align;
                return `<td ${isMono}>${getCellValue(s, field, i)}</td>`;
              })
              .join("")}
          </tr>`
        )
        .join("");

      const colspan = selectedFields.length;

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
        ${headerCells}
      </tr>
    </thead>
    <tbody>
      ${rows || `<tr><td colspan="${colspan}" style="text-align:center;padding:16px;color:#999;">No students found in this class.</td></tr>`}
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
  }, [grade, selectedFields]);

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="h-5 w-5 ml-0.5 text-muted-foreground hover:text-primary"
        title={`Download ${grade.name} class list`}
        onClick={(e) => {
          e.stopPropagation();
          setDialogOpen(true);
        }}
        disabled={loading}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <FileDown className="h-3 w-3" />
        )}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Select Fields for Class List</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 py-2 max-h-80 overflow-y-auto">
            <div className="flex items-center justify-between px-2 pb-2 border-b text-xs text-muted-foreground">
              <span>Fields</span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={selectAll}
                  title="Select all"
                >
                  <Check className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={selectNone}
                  title="Select none"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {ALL_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded"
              >
                <input
                  type="checkbox"
                  id={`field-${field.key}`}
                  checked={selectedFields.includes(field.key)}
                  onChange={() => toggleField(field.key)}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <Label htmlFor={`field-${field.key}`} className="text-sm cursor-pointer mb-0 flex-1">
                  {field.label}
                </Label>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleDownload} disabled={loading || selectedFields.length === 0}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Generate & Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}