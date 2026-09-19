# AI Knowledge Workspace — Project2 baseline

Public, reproducible snapshot of the AI Knowledge Workspace at the end of Project2.

The repository intentionally contains only the Project2 baseline. Ongoing Project3 and graduation
thesis development happens in private repositories.

## What Project2 demonstrates

- React/Vite product UI that calls only Spring Boot.
- Spring Boot product core for session auth, workspaces, assets, processing state, canonical
  transcript snapshots, explicit indexing, and workspace-scoped search.
- FastAPI internal processing service using Celery, Redis, PostgreSQL, FFmpeg, and Whisper.
- PostgreSQL as durable product/processing storage and Elasticsearch as a derived transcript search
  index.
- A complete demo path: register/login, create or select workspace, upload video, poll processing,
  retrieve transcript, index it, and search within a workspace.

See [PROJECT2_SNAPSHOT.md](PROJECT2_SNAPSHOT.md) for exact source commits and provenance.

## Architecture

```text
Browser
  -> React/Vite frontend (:5173)
  -> Spring Boot product core (:8081)
       -> workspace PostgreSQL
       -> Elasticsearch
       -> FastAPI processing API (:8000)
            -> processing PostgreSQL
            -> Redis -> Celery worker -> FFmpeg/Whisper
```

## One-command demo

Requirements: Docker Desktop with Docker Compose v2 and enough memory for Elasticsearch and
Whisper. Four GB of free Docker memory is a practical minimum.

```bash
cp .env.example .env
make up
make ps
```

Open <http://localhost:5173>.

Useful checks:

```bash
curl http://localhost:8000/health
curl http://localhost:8081/health
curl http://localhost:9201/_cluster/health
```

The first real transcription downloads the Whisper `base` model into a named Docker volume, so it
can take longer and requires internet access once. Later runs reuse the cache.

Stop the demo without deleting its data:

```bash
make down
```

## Demo order

1. Open the frontend and register or log in.
2. Use the default workspace or create another workspace.
3. Upload a short MP4/MOV/WebM lecture clip.
4. Poll until processing reaches a terminal state.
5. Open the transcript.
6. Trigger explicit indexing.
7. Search for a phrase inside the active workspace and open its transcript context.

Use a short clip for class demonstrations because transcription runs locally on CPU by default.

## Repository layout

```text
spring-product-core/  Spring Boot snapshot at the Project2 marker
processing-service/  FastAPI/Celery snapshot selected at the Project2 cutoff
frontend/            React/Vite snapshot selected at the Project2 cutoff
docs/                Presentation and demo material for the public snapshot
```

## Project2 boundaries

This baseline deliberately does not claim production-grade RBAC, external object storage,
event-driven outbox/inbox delivery, semantic/vector retrieval, production identity, full
observability, or high-availability deployment. Those are later evolution areas, not Project2
features.

