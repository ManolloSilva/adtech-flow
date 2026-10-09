# Operations & Deployment

This directory documents deployment, containerization, and local development operations for AdTech Flow.

---

## 1. Local Development via Docker

You can run the full environment with Docker Compose:

```bash
# Build and run containers
docker-compose up --build

# Access the frontend
# Open http://localhost:5173
```

---

## 2. Production Static Hosting

AdTech Flow is an in-browser Single Page Application (SPA). It can be deployed to any static host:
- **Cloudflare Pages**
- **Vercel**
- **GitHub Pages**
- **Firebase Hosting**

### Build Command:
```bash
cd frontend
npm ci
npm run build
# Output artifact: frontend/dist/
```

### Static Headers:
Ensure the static server includes Service Worker headers for MSW:
```
Service-Worker-Allowed: /
```
