# Customer Support Chat

Live customer↔agent chat. New customers are auto-assigned an available
agent (least-loaded `ONLINE` first); returning customers continue their
open conversation. Real-time over WebSocket, REST fallback intact.

## Run locally (no Docker)

Needs Postgres on `localhost:5433` (`customer_support` / `support_user`).

```powershell
# backend :8080
cd server
$env:JAVA_TOOL_OPTIONS="-Duser.timezone=UTC"; .\mvnw.cmd spring-boot:run

# frontend :3000
cd web
bun install
bun run dev
```

Open `http://localhost:3000` (chat) and `/agents` (dashboard).

## Deploy (Docker Compose)

```bash
cp .env.example .env   # set DB_PASSWORD
docker compose up --build
```

Services: `db` (postgres, internal), `server` (`:8080`), `web` (`:3000`).
Browser WebSocket target is baked at web build time via
`NEXT_PUBLIC_WS_URL`; server-side API proxy via `API_URL` build arg.
Backend reads `SPRING_DATASOURCE_*`, `CORS_ALLOWED_ORIGINS`,
`WS_ALLOWED_ORIGINS`, `DDL_AUTO` from the environment (see
`server/src/main/resources/application.yaml` defaults).

Split-host deploys: build `web` with `API_URL` pointing at the backend
as reachable from the web container, `NEXT_PUBLIC_WS_URL` as reachable
from the browser, and set the backend `*_ALLOWED_ORIGINS` to the web URL.
