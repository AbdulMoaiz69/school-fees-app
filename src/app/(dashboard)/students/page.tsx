import { Header } from "@/components/layout/header";
import { getStudents } from "@/app/actions/students";
import { getInactiveStudents } from "@/app/actions/students";
import { getGrades } from "@/app/actions/grades";
import { StudentsClient } from "./students-client";
import { buttonVariants } from "@/components/ui/button";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";

export default async function StudentsPage() {
  const [students, inactiveStudents, grades] = await Promise.all([
    getStudents(),
    getInactiveStudents(),
    getGrades(),
  ]);

  return (
    <div>
      <Header title="Students" description={`${students.length} active students`}>
        <Link href="/students/new" className={cn(buttonVariants({ size: "sm" }))}>
          <UserPlus className="h-4 w-4 mr-2" />
          Add Student
        </Link>
      </Header>
      <StudentsClient 
        activeStudents={students} 
        inactiveStudents={inactiveStudents} 
        grades={grades} 
      />
    </div>
  );
}
