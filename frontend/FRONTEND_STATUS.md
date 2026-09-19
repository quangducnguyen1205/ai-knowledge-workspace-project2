# FRONTEND_STATUS

## 1. Purpose

This repo now implements a small product-grade frontend for AI Knowledge Workspace before any future AI expansion. The frontend stays grounded in the real Spring-owned backend contract and focuses on the current authenticated product flow:

- auth
- workspace selection and management
- lecture video upload
- processing and transcript review
- explicit indexing
- workspace-scoped search
- asset-scoped search from Asset Detail
- transcript context

It is intentionally not a chatbot surface, not a RAG shell, and not an AI assistant experience.

## 2. Current Stack

- Vite
- React 18
- TypeScript
- TanStack Query for server state, polling, and cache invalidation
- Plain CSS with a custom product shell and screen layouts
- Lightweight hash-based routing implemented locally in the app
- Docker-first local development with `/api` requests proxied to the Spring backend

## 3. Current Product IA

The frontend now behaves like a routed web app instead of a single giant shell:

- Auth entry
- Workspace home
- Asset library
- Asset detail / transcript review
- Asset detail / transcript review / in-video search
- Workspace search
- Settings / workspace management

## 4. Implemented Product Flow

- Sign in or create account through the authenticated product entry surface
- Resolve the signed-in user through `GET /api/me`
- Load the visible owned workspace scope
- Switch workspaces from the persistent app shell
- Create, rename, and conservatively delete workspaces through Settings
- Land in a workspace home screen with readiness summaries and next actions
- Open a dedicated asset library screen
- Upload lecture videos into the active workspace
- Review library-wide asset status in a full browse/manage screen
- Open a dedicated asset detail screen for transcript review
- Search within the currently viewed video from Asset Detail once that asset is searchable
- Rename and delete assets
- Poll processing state until terminal
- Load transcript rows only when the backend says they are ready
- Explicitly index transcript rows to unlock search
- Open a dedicated workspace search screen
- Search only within the active workspace
- Optionally restrict search to the current asset from Asset Detail
- Open transcript context around a selected result

## 5. Backend API Surface Used

- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/me`
- `GET /api/workspaces`
- `POST /api/workspaces`
- `PATCH /api/workspaces/{workspaceId}`
- `DELETE /api/workspaces/{workspaceId}`
- `GET /api/assets`
- `POST /api/assets/upload`
- `PATCH /api/assets/{assetId}`
- `DELETE /api/assets/{assetId}`
- `GET /api/assets/{assetId}/status`
- `GET /api/assets/{assetId}/transcript`
- `POST /api/assets/{assetId}/index`
- `GET /api/search`
- `GET /api/assets/{assetId}/transcript/context`

## 6. Local Run Path

- Recommended path: Docker
- Main commands:
  - `docker compose up --build`
  - `docker compose logs -f frontend`
  - `docker compose down`
- Expected frontend URL: `http://localhost:5173`
- Expected backend URL: `http://localhost:8081`

## 7. Verification Notes

- Dockerized production build passed with `docker compose run --rm frontend npm run build`
- Auth boundary, workspace queries, asset queries, transcript flow, explicit indexing, and search remain backend-aligned
- The new routed shell compiles cleanly without adding external router dependencies

## 8. Design / Product Notes

- The UI now uses a persistent app shell with navigation instead of a demo hero plus three fixed panels
- Routing is hash-based to stay compatible with the current frontend setup and avoid new backend/server route assumptions
- Upload copy and accepted file input remain lecture-video-first to match the current real product path
- Search stays disabled until explicit indexing produces searchable assets
- Asset Detail can reuse the same transcript-hit/context search pattern, but scoped to the current asset
- No assistant/chat UI, no fake AI affordances, and no unsupported media seek behavior were added

## 9. Intentionally Deferred

- Chat or assistant flows
- Timestamp seek or media playback controls
- Collaboration features
- Cross-workspace asset movement
- Advanced search filters
- Analytics dashboards
- Broader auth-platform features beyond the current supported backend path

## 10. Quick Summary

- The frontend now feels like a small real product rather than a single-shell demo
- Navigation, layout hierarchy, empty states, and success/error handling are stronger and more realistic
- Workspace management is now a first-class settings workflow
- Asset review and search each have dedicated screens
- Scope remains tightly pre-AI and honest to the backend contract
