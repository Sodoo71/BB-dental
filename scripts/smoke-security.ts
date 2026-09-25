import assert from "node:assert/strict";
const base = "http://127.0.0.1:3100";
const checks: { path: string; status: number; method?: string; origin?: string; body?: string }[] = [
  { path: "/login", status: 200 },
  { path: "/register", status: 200 },
  { path: "/super-admin", status: 307 },
  { path: "/doctor", status: 307 },
  { path: "/admin", status: 307 },
  { path: "/api/auth/me", status: 401 },
  { path: "/api/admin/users", status: 403 },
  { path: "/api/super-admin/settings", status: 403 },
  { path: "/api/auth/login", method: "POST", origin: "https://foreign.example", body: "{}", status: 403 },
  { path: "/api/auth/login", method: "POST", origin: "http://localhost:3100", body: "{}", status: 400 },
  { path: "/api/auth/register", method: "POST", origin: "http://localhost:3100", body: JSON.stringify({ name: "Test", email: "test@example.test", password: "long enough password", role: "SUPER_ADMIN" }), status: 400 },
  { path: "/api/telegram/webhook", method: "POST", body: "{}", status: 401 },
  { path: "/api/auth/bootstrap", method: "POST", origin: "http://localhost:3100", body: "{}", status: 410 },
];
for (const check of checks) {
  const response = await fetch(`${base}${check.path}`, { method: check.method, redirect: "manual", headers: { "Content-Type": "application/json", ...(check.origin ? { Origin: check.origin } : {}) }, body: check.body, signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, check.status, `${check.method ?? "GET"} ${check.path}`);
  console.info(`PASS ${check.method ?? "GET"} ${check.path}: ${response.status}`);
}
