import { checkAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await checkAdmin(); // This server-side check protects the entire /admin route
  return <>{children}</>;
}