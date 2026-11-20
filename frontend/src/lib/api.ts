const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8080';

export async function saveSimulation(config: unknown, result: unknown, traceId?: string): Promise<void> {
  // Never issue network calls during tests or SSR.
  if (import.meta.env.VITEST) return;
  try {
    await fetch(`${API_URL}/api/simulations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(traceId ? { 'X-Trace-Id': traceId } : {}),
      },
      body: JSON.stringify({ config, result }),
    });
  } catch {
    // Persistence is best-effort; never block the simulation.
  }
}