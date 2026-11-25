import Link from 'next/link';
import Footer from '@/components/Footer';

export default function NotFound() {
  return (
    <main className="page">
      <div className="empty">
        <strong>Project not found</strong>
        <span>It may have been removed.</span>
        <Link href="/" className="btn">Back to all projects</Link>
      </div>
      <Footer />
    </main>
  );
}
