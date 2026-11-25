import { COMPANY, SHORT, TAGLINE } from '@/lib/brand';
import { listProjects, configured } from '@/lib/store';
import Showcase from '@/components/Showcase';
import Intro from '@/components/Intro';
import SetupNotice from '@/components/SetupNotice';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let projects = [], problem = null;
  if (!configured()) problem = 'File storage is not connected yet.';
  else { try { projects = await listProjects(); } catch (e) { console.error(e); problem = 'Projects could not be loaded right now.'; } }
  return (
    <>
      <Intro />
      {problem && !projects.length ? <main className="page"><SetupNotice message={problem} /></main>
        : <Showcase projects={projects} company={COMPANY} tagline={TAGLINE} short={SHORT} />}
    </>
  );
}
