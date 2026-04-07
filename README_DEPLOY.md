# DataHub Integrated (Frontend + Backend)

This package combines the Next.js frontend and the QuickBooks backend into one Vercel-ready project.

## What changed
- Frontend and backend are merged into a single repository.
- Frontend now defaults to calling the backend at `/api/backend` when `NEXT_PUBLIC_API_URL` is not set.
- Backend is exposed through a Vercel serverless function at `api/backend/[...path]`.
- QuickBooks OAuth callback now supports the integrated deployment path: `/api/backend/api/auth/callback`.

## Recommended Vercel environment variables
Set these in Vercel Project Settings → Environment Variables:
- `APP_URL`
- `QB_REALM_ID`
- `QB_ACCESS_TOKEN`
- `QB_REFRESH_TOKEN`
- `QB_BASIC_TOKEN`
- `QB_BASE_URL`
- `QB_CLIENT_ID`
- `QB_CLIENT_SECRET`

## Local development
1. Copy `.env.example` to `.env.local`
2. For split local development:
   - set `NEXT_PUBLIC_API_URL=http://localhost:5000`
   - run backend with `npm run dev:backend`
   - run frontend with `npm run dev`

## Important note about QuickBooks token persistence on Vercel
This integration is deployable as-is, but Vercel serverless functions do not provide durable file storage for rotating QuickBooks tokens.
If QuickBooks rotates your refresh token, you should move token storage to a database, KV store, or another persistent secret store for long-term production stability.
