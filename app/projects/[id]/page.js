import { getProject } from '@/lib/store';
import { COMPANY } from '@/lib/brand';
import StandaloneProject from '@/components/StandaloneProject';
import NotFound from '@/app/not-found';

export const dynamic = 'force-dynamic';

async function load(id) {
  try { return await getProject(id); } catch (e) { console.error(e); return null; }
}
export async function generateMetadata({ params }) {
  const { id } = await params;
  const p = await load(id);
  return { title: p ? p.name : 'Project not found' };
}
export default async function ProjectPage({ params }) {
  const { id } = await params;
  const p = await load(id);
  if (!p) return <NotFound />;
  return <StandaloneProject project={p} company={COMPANY} />;
}
