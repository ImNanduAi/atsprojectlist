export default function SetupNotice({ message }) {
  return (
    <div className="empty" role="alert">
      <strong>Finish the setup</strong>
      <span>{message || 'File storage is not connected yet.'}</span>
      <span>In Vercel: Storage → Create → Blob (Public) → connect it to this project, then redeploy.</span>
    </div>
  );
}
