export const API_URL = "http://localhost:8000"; // твой FastAPI бек

export async function apiPost(path: string, body: any) {
  const res = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include", // важно если бек шлёт cookie
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }

  return res.json();
}
