# ATS Project Gallery (Next.js + Vercel Blob)

Aatral AI Tech Solutions project showcase with an admin page. Built for **Vercel**: no database, no native modules.

**Stack:** Next.js 15 (App Router) · React 19 · Vercel Blob (files and project data) · Node 22.

## Deploy on Vercel

1. Push this project to GitHub. If it sits in a sub-folder of the repo (for example `project-gallery-v2`), open
   **Project Settings → General → Root Directory** in Vercel and set that folder.
2. In the Vercel project open **Storage → Create → Blob**, choose **Public**, and **connect** it to the project.
   This adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Open **Settings → Environment Variables** and add `ADMIN_PASSWORD` (your admin password).
   Optional: `SESSION_SECRET` (any long random text).
4. **Redeploy** (Deployments → ⋯ → Redeploy). Open `/admin`, log in, and add projects.

Node is pinned to 22 in `package.json` (`engines`). Remove any old `better-sqlite3` / `server.js` from your repo; they are not used.

## Admin page (`/admin`)
Project name, headline, client, category, details, up to 12 key features, photos, videos (files or YouTube/Vimeo links)
and one PDF brochure. New projects show on the site immediately. Photos are resized in the browser; videos and PDFs go
straight from the browser to Blob, so large files work (limits: video 300 MB, PDF 50 MB, photo 25 MB).

## Run on your computer
```
cp .env.example .env.local   # fill in BLOB_READ_WRITE_TOKEN (Vercel: Storage → your store → .env.local tab) and ADMIN_PASSWORD
npm install
npm run dev
```

## Notes
- Data from the earlier SQLite version is not migrated; re-add projects in the admin page.
- Without `ADMIN_PASSWORD` the temporary password `admin123` works, so always set it.
