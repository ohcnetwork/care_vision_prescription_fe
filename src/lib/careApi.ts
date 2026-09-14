import { getCareRuntime } from "../types/care";

export class CareApiError extends Error {
  constructor(public readonly status: number) {
    super(`Care could not load the response history. HTTP status: ${status}.`);
  }
}

export function careApiUrl(): string {
  const runtime = getCareRuntime();
  const base = runtime.__CORE_ENV__?.apiUrl ?? runtime.CARE_API_URL;
  if (!base) throw new Error("Care did not supply the API URL.");
  return base;
}

// The host uses the same token and header in src/Utils/request/utils.ts.
export async function getCareJson(
  path: string,
  query: Record<string, string>,
  signal: AbortSignal,
): Promise<unknown> {
  const url = new URL(path, careApiUrl());
  url.search = new URLSearchParams(query).toString();
  const token = localStorage.getItem("care_access_token");
  if (!token) throw new CareApiError(401);
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
    signal,
  });
  if (!response.ok) throw new CareApiError(response.status);
  return response.json();
}
