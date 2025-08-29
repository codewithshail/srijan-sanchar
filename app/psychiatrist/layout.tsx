import { checkPsychiatristOrAdmin } from "@/lib/auth";

export default async function PsychiatristLayout({ children }: { children: React.ReactNode }) {
  await checkPsychiatristOrAdmin();
  return <>{children}</>;
}