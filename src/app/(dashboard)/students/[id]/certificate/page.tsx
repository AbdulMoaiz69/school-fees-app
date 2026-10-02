import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getStudent } from "@/app/actions/students";
import { getSettings } from "@/app/actions/settings";
import { getGrade } from "@/app/actions/grades";
import { CertificateClient } from "./certificate-client";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const student = await getStudent(id);
  if (!student) return { title: "Certificate Not Found" };
  return {
    title: `${student.status === "expelled" ? "Expulsion" : "Withdrawal"} Certificate - ${student.full_name}`,
  };
}

export default async function CertificatePage({ params }: Props) {
  const { id } = await params;
  const [student, settings] = await Promise.all([
    getStudent(id),
    getSettings(),
  ]);

  if (!student) notFound();
  if (student.status === "active") notFound();

  // Fetch last promoted class if exists
  let lastPromotedClass = null;
  if (student.last_promoted_class_id) {
    lastPromotedClass = await getGrade(student.last_promoted_class_id);
  }

  return <CertificateClient student={student} settings={settings} lastPromotedClass={lastPromotedClass} />;
}