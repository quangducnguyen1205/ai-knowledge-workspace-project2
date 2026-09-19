# Project2 snapshot provenance

This public repository is a presentation snapshot. The real product continues in three private
repositories. No Project3 implementation or later private history is included here.

| Component | Source repository | Snapshot commit | Commit date | Selection rule |
|---|---|---|---|---|
| Spring product core | `ai-knowledge-workspace` | `e8662d3e706a08a590968460083c7cb12cb3a7c2` (`Project2`) | 2026-05-24 | Explicit Project2 milestone |
| FastAPI processing | `DemoFastAPI` | `ad00c8cc6414d64b4f154cf3337a6532878a55a4` | 2026-04-20 | Latest processing commit before the Project2 milestone |
| React frontend | `ai-knowledge-workspace-fe` | `46e62c9a8361b538ed2a58e25db0a4230747d3d6` | 2026-04-24 | Latest frontend commit before the Project2 milestone |

The component trees are exported snapshots, not Git submodules. Their original `.git` histories are
intentionally absent so the public repository cannot expose later Project3 work.

The root `docker-compose.yml`, root `Makefile`, component `Dockerfile.project2` files, frontend
`.env.project2` and generated frontend lockfile are presentation packaging added after the
milestone. They do not change the Project2 product behavior; they connect the three historical
snapshots into one reproducible local topology.
