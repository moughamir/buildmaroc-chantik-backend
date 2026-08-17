import { describe, test, expect } from 'bun:test';

// Smoke tests — validate core endpoints return expected status codes
// These tests require a running backend (bun run dev) on port 8080
// Run with: SERVER_URL=http://localhost:8080 bun test

const BASE = process.env.SERVER_URL || 'http://localhost:8080';

describe('Health endpoints', () => {
  test('GET /health returns 200 with status ok', async () => {
    const res = await fetch(`${BASE}/health`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(body.timestamp).toBeDefined();
  });

  test('GET /api/v1/health returns 200', async () => {
    const res = await fetch(`${BASE}/api/v1/health`);
    expect(res.status).toBe(200);
  });
});

describe('API core endpoints', () => {
  test('GET /api/v1/projects returns array (or 401 without auth)', async () => {
    const res = await fetch(`${BASE}/api/v1/projects`);
    // Without auth session, should return 401 or empty array (dev bypass may be active)
    expect([200, 401]).toContain(res.status);
  });

  test('GET /api/v1/docs returns Swagger UI HTML', async () => {
    const res = await fetch(`${BASE}/api/v1/docs`);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('swagger');
  });

  test('GET /api/v1/doc returns OpenAPI JSON', async () => {
    const res = await fetch(`${BASE}/api/v1/doc`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.openapi).toBe('3.0.0');
    expect(body.info.title).toBe('CHANTIK API');
  });

  test('GET /nonexistent returns 404', async () => {
    const res = await fetch(`${BASE}/api/v1/nonexistent`);
    expect(res.status).toBe(404);
  });
});

describe('Auth endpoints', () => {
  test('POST /api/auth/sign-in/email without body returns error', async () => {
    const res = await fetch(`${BASE}/api/auth/sign-in/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    // Should return 400 or 422 (validation error) — not 500
    expect([400, 401, 422]).toContain(res.status);
  });
});