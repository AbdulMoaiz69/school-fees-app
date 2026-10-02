"use client";

import { useEffect, useState } from "react";
import { Printer, Download, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/fee-utils";
import Link from "next/link";
import type { Student, Grade } from "@/lib/supabase/types";

interface CertificateClientProps {
  student: Student;
  settings: Record<string, string>;
}

export function CertificateClient({ student, settings }: CertificateClientProps) {
  const [isPrinting, setIsPrinting] = useState(false);

  const schoolName = settings.school_name ?? "School Name";
  const schoolAddress = settings.school_address ?? "School Address";
  const schoolPhone = settings.school_phone ?? "";

  const currentClass = student.grade?.name ?? "Not Assigned";
  const lastPromotedClass = student.last_promoted_class?.name ?? "N/A";
  const exitType = student.status === "expelled" ? "Expulsion" : "Withdrawal";
  const exitDate = student.exit_date ? new Date(student.exit_date).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }) : "N/A";

  function handlePrint() {
    setIsPrinting(true);
    window.print();
    setTimeout(() => setIsPrinting(false), 100);
  }

  useEffect(() => {
    const handleAfterPrint = () => setIsPrinting(false);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, []);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6 no-print">
        <Link href={`/students/${student.id}`} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Student
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrint} disabled={isPrinting}>
            <Printer className="h-4 w-4 mr-2" />
            Print Certificate
          </Button>
          <Button variant="outline" size="sm" onClick={handlePrint}>
            <Download className="h-4 w-4 mr-2" />
            Save as PDF
          </Button>
        </div>
      </div>

      {/* Certificate */}
      <div className="border-2 border-gray-300 rounded-lg p-8 bg-white shadow-lg" style={{ fontFamily: "Georgia, serif" }}>
        {/* School Header */}
        <div className="text-center mb-8 border-b-2 border-gray-300 pb-6">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full border-2 border-primary bg-primary/10 flex items-center justify-center">
            <svg className="w-12 h-12 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 3L1 9l11 6 9-4.91V17h2V9L12 3z" />
              <path d="M5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-1">{schoolName}</h1>
          <p className="text-gray-600">{schoolAddress}</p>
          {schoolPhone && <p className="text-gray-600">Phone: {schoolPhone}</p>}
        </div>

        {/* Certificate Title */}
        <div className="text-center mb-8">
          <p className="text-sm text-gray-500 uppercase tracking-wider mb-2">Official Certificate</p>
          <h2 className="text-4xl font-bold text-gray-900 mb-2">{exitType} Certificate</h2>
          <p className="text-lg text-gray-600">Certificate No: <span className="font-mono font-semibold">{student.registration_number}-{exitType.slice(0, 3).toUpperCase()}</span></p>
        </div>

        {/* Body */}
        <div className="space-y-4 text-gray-800 leading-relaxed">
          <p className="text-lg">
            This is to certify that <strong className="text-xl underline">{student.full_name}</strong>,
            child of <strong>{student.parent_name ?? "N/A"}</strong>,
            bearing Registration Number <strong className="font-mono">{student.registration_number}</strong>,
          </p>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p><strong>Date of Birth:</strong> {student.date_of_birth ? new Date(student.date_of_birth).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : "N/A"}</p>
              <p><strong>Address:</strong> {student.address ?? "N/A"}</p>
            </div>
            <div>
              <p><strong>Current Class:</strong> {currentClass}</p>
              <p><strong>Last Promoted Class:</strong> {lastPromotedClass}</p>
            </div>
          </div>

          <p className="mt-4">
            has been <strong>{exitType.toLowerCase()}ed</strong> from this institution on <strong>{exitDate}</strong>.
          </p>

          {student.exit_reason && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p><strong>Reason for {exitType.toLowerCase()}:</strong></p>
              <p className="mt-1">{student.exit_reason}</p>
            </div>
          )}

          {student.character_remarks && (
            <div className="bg-gray-50 p-4 rounded-lg border">
              <p><strong>Character Remarks:</strong></p>
              <p className="mt-1">{student.character_remarks}</p>
            </div>
          )}

          <p className="mt-6">
            During their time at this institution, the student's conduct and character have been noted as per school records.
          </p>

          {student.security_fee > 0 && (
            <div className="bg-amber-50 p-4 rounded-lg border border-amber-200 mt-4">
              <p className="font-semibold text-amber-800">Security Deposit Refund</p>
              <p className="text-sm text-amber-700 mt-1">
                A refundable security deposit of <strong>{formatCurrency(student.security_fee)}</strong> was collected at admission.
                This amount should be refunded to the parent/guardian upon {exitType.toLowerCase()}.
              </p>
            </div>
          )}
        </div>

        {/* Footer Signatures */}
        <div className="mt-12 grid grid-cols-2 gap-8">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="font-semibold">Principal / Headmaster</p>
              <p className="text-sm text-gray-500">Signature & Seal</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">Date: {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="font-semibold">Class Teacher / Administrator</p>
              <p className="text-sm text-gray-500">Signature</p>
            </div>
            <p className="text-xs text-gray-400 mt-2">Date: {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}</p>
          </div>
        </div>

        {/* Footer Note */}
        <div className="mt-8 text-center text-xs text-gray-500 border-t border-gray-200 pt-4">
          <p>This certificate is issued without any liability on the part of the school.</p>
          <p className="mt-1">Generated on {new Date().toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })} at {new Date().toLocaleTimeString("en-PK")}</p>
        </div>
      </div>

      {/* Print Instructions */}
      <div className="no-print mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
        <p className="font-semibold">Instructions:</p>
        <ul className="list-disc list-inside mt-2 space-y-1">
          <li>Click "Print Certificate" to print or save as PDF</li>
          <li>Use "Save as PDF" in the print dialog to create a digital copy</li>
          <li>Ensure the school seal is affixed on the printed copy</li>
          <li>Both Principal and Class Teacher signatures are required for validity</li>
        </ul>
      </div>
    </div>
  );
}