import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import OverviewPage from "@/app/overview/page";

export default async function HomePage() {
  const session = await getCurrentSession();
  if (session) redirect("/dashboard");
  return <OverviewPage />;
}
