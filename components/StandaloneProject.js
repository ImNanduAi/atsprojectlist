'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import ProjectView from './ProjectView';

/** The /projects/[id] page: the same full-screen viewer, opened directly (for shared links). */
export default function StandaloneProject({ project, company }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  return (
    <ProjectView
      project={project}
      company={company}
      origin={null}
      closing={closing}
      onRequestClose={() => setClosing(true)}
      onClosed={() => router.push('/')}
    />
  );
}
