# Product Structure

## Screen model

The frontend now behaves like a small product shell instead of a single demo page:

- Auth entry
- Workspace home
- Asset library
- Asset detail / transcript review
- Asset detail / transcript review / in-video search
- Workspace search
- Settings / workspace management

## Routing choice

The app uses lightweight hash routing instead of a router dependency. That keeps the repo aligned with the current Vite setup, works cleanly in the existing Docker/dev flow, and avoids requiring new server-side SPA route handling before the product shell is ready.

Routes:

- `#/`
- `#/library`
- `#/assets/:assetId`
- `#/search`
- `#/settings`

## Why this structure is better

- It separates browse, review, search, and settings into focused screens.
- It lets search stay available in two narrow product-grade entry points: workspace-wide from Search, and current-video-only from Asset Detail.
- It keeps the real backend-owned workflow intact: auth -> workspace -> upload lecture video -> processing -> transcript review -> explicit index -> search -> transcript context.
- It introduces a stable app frame with navigation and clearer context without inventing assistant or AI flows.

## Intentionally deferred

- Chat or assistant UX
- Timestamp seek or media playback controls
- Collaboration features
- Cross-workspace asset movement
- Advanced search filters or analytics
