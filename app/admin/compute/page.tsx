import { redirect } from 'next/navigation';
import { MainLayout } from '@/components/MainLayout';
import { getRequiredAdminSession } from '@/lib/admin-auth';
import { ComputeAdmin } from './compute-admin';

export default async function ComputePage() {
  const session = await getRequiredAdminSession('/admin/compute');
  if (!session || !session.user.emailVerified) redirect('/dashboard');
  return <MainLayout><ComputeAdmin /></MainLayout>;
}
