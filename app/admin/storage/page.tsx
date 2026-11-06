import { redirect } from "next/navigation";
import { MainLayout } from "@/components/MainLayout";
import { getRequiredAdminSession } from "@/lib/admin-auth";
import { StorageAdmin } from "./storage-admin";

export default async function StoragePage() {
  const session = await getRequiredAdminSession("/admin/storage");
  if (!session || !session.user.emailVerified) redirect("/dashboard");
  return <MainLayout><StorageAdmin /></MainLayout>;
}
