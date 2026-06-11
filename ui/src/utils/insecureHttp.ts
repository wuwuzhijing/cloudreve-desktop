import { invoke } from "@tauri-apps/api/core";

type InsecureHttpResponse = {
  status: number;
  body: string;
};

type InsecureHttpOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: unknown;
};

export async function insecureHttpJson<T>(
  url: string,
  options: InsecureHttpOptions = {},
): Promise<T> {
  const method = options.method ?? "GET";

  const headers: Record<string, string> = {
    ...(options.headers ?? {}),
  };

  let body: string | undefined;

  if (options.body !== undefined) {
    body =
      typeof options.body === "string"
        ? options.body
        : JSON.stringify(options.body);

    if (!headers["Content-Type"] && !headers["content-type"]) {
      headers["Content-Type"] = "application/json";
    }
  }

  const response = await invoke<InsecureHttpResponse>("insecure_http_text", {
    method,
    url,
    headers,
    body,
  });

  if (response.status < 200 || response.status >= 300) {
    throw new Error(`HTTP ${response.status}: ${response.body}`);
  }

  return JSON.parse(response.body) as T;
}