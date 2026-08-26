import { redirect } from "next/navigation";
import AdminLoginForm from "@/components/AdminLoginForm";
import { isAuthenticated } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Área da equipe | Simplifica",
  robots: { index: false, follow: false },
};

export default async function AdminLoginPage() {
  if (await isAuthenticated()) redirect("/admin");
  return <AdminLoginForm />;
}
