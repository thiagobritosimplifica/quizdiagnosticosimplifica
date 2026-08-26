import { redirect } from "next/navigation";
import AdminDashboard from "@/components/AdminDashboard";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Painel de diagnósticos | Simplifica",
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  if (!(await isAuthenticated())) redirect("/admin/login");
  return <AdminDashboard />;
}
