type Fetcher = typeof fetch;

export async function factoryRequest<T = Record<string, unknown>>(
  path: string,
  method: "POST" | "PATCH",
  payload: unknown,
  fetcher: Fetcher = fetch,
): Promise<T> {
  const response = await fetcher(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
  } & T;
  if (!response.ok) throw new Error(body.error || `factory_request_failed:${response.status}`);
  return body;
}
