export async function fetchJson(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw data.error || new Error("Network error");
  return data;
}
