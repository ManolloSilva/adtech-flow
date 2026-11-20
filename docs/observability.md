# Observability

AdTech Flow emits three correlated signals for the key user journey (running an auction):

## Signals

- **Structured logs** — backend emits JSON lines to stdout, each carrying a `traceId`. Frontend passes `X-Trace-Id` on persistence calls.
- **Metrics** — `GET /metrics` exposes Prometheus-format counters: `adtech_requests_total`, `adtech_simulations_saved_total`, `adtech_errors_total`.
- **Traces** — a single `traceId` flows from the frontend through the backend and is stored with the persisted simulation, so logs, metrics, and stored data correlate to one request.

## Viewing

- Logs: `docker compose logs backend` (JSON lines).
- Metrics: `curl http://localhost:8080/metrics`.
- Stored simulations: `GET http://localhost:8080/api/simulations`.

## Privacy

No customer data or credentials are sent to telemetry. Only auction config (floor, timeout, consent flag) and aggregate results (winning CPM, bidder) are persisted. No PII is collected.