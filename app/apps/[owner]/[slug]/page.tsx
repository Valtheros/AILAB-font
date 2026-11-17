import { MainLayout } from "@/components/MainLayout";
import { AppViewer } from "@/components/model-apps/app-viewer";

export default async function SharedAppPage({ params }: { params: Promise<{ owner: string; slug: string }> }) {
  const { owner, slug } = await params;
  return <MainLayout><AppViewer key={`${owner}:${slug}`} owner={owner} slug={slug} /></MainLayout>;
}
