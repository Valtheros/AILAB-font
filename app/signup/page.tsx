import { redirect } from "next/navigation";
import { AuthPage } from "@/components/auth/auth-page";
import { getCurrentSession } from "@/lib/session";
import { safeCallbackURL } from "@/lib/auth-redirect";

export default async function SignupPage({ searchParams }: {
  searchParams: Promise<{ callbackURL?: string | string[] }>;
}) {
  const session = await getCurrentSession();
  const params = await searchParams;
  if (session) redirect(safeCallbackURL(Array.isArray(params.callbackURL) ? params.callbackURL[0] : params.callbackURL));
  return <AuthPage mode="signup" />;
}
