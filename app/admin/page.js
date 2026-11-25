import Footer from '@/components/Footer';
import LoginForm from '@/components/LoginForm';
import AdminClient from '@/components/AdminClient';
import SetupNotice from '@/components/SetupNotice';
import { isAdmin, USING_DEFAULT_PASSWORD } from '@/lib/auth';
import { listProjects, configured } from '@/lib/store';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin', robots: { index: false } };

export default async function Admin() {
  const ok = await isAdmin();
  let projects = [], problem = null;
  if (ok) {
    if (!configured()) problem = 'File storage is not connected yet.';
    else { try { projects = await listProjects(); } catch (e) { problem = e.message; } }
  }
  return (
    <main className="page">
      {!ok ? <LoginForm defaultPassword={USING_DEFAULT_PASSWORD} />
        : problem ? <SetupNotice message={problem} />
        : <AdminClient projects={projects} />}
      <Footer />
    </main>
  );
}
