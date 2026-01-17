import type { Env } from "../env";
import { logEvent } from "./log";

export function getSubmitProxyBase(env: Env, requestId?: string) {
  if (!env.SUBMIT_PROXY_URL) {
    throw new Error("SUBMIT_PROXY_URL is not set");
  }

  let url: URL;
  try {
    url = new URL(env.SUBMIT_PROXY_URL);
  } catch {
    logEvent("error", "submit_proxy.invalid_url", {
      requestId,
      endpoint: env.SUBMIT_PROXY_URL,
      reason: "invalid url",
    });
    throw new Error("SUBMIT_PROXY_URL must be a valid base URL");
  }

  const hasPath = url.pathname && url.pathname !== "/";
  const hasSearch = !!url.search;
  const hasHash = !!url.hash;
  if (hasPath || hasSearch || hasHash) {
    logEvent("error", "submit_proxy.invalid_url", {
      requestId,
      endpoint: env.SUBMIT_PROXY_URL,
      reason: "path or query not allowed",
    });
    throw new Error("SUBMIT_PROXY_URL must be a base URL with no path");
  }

  return url.origin.replace(/\/$/, "");
}

export async function submitProxyFetch(
  env: Env,
  requestId: string | undefined,
  path: string,
  init?: RequestInit
) {
  const base = getSubmitProxyBase(env, requestId);
  const url = `${base}${path}`;
  try {
    const res = await fetch(url, init);
    if (env.SUBMIT_PROXY && res.status >= 400) {
      const preview = await res.clone().text();
      if (preview.includes("error code: 1042")) {
        logEvent("warn", "submit_proxy.fetch_retry_binding", {
          requestId,
          endpoint: base,
          status: res.status,
        });
        const bindingUrl = `https://submit-proxy${path}`;
        return env.SUBMIT_PROXY.fetch(bindingUrl, init);
      }
    }
    return res;
  } catch (error: any) {
    logEvent("error", "submit_proxy.fetch_failed", {
      requestId,
      endpoint: base,
      error: error?.message || "submit proxy fetch failed",
    });
    if (env.SUBMIT_PROXY) {
      logEvent("info", "submit_proxy.fetch_binding", {
        requestId,
        endpoint: base,
      });
      const bindingUrl = `https://submit-proxy${path}`;
      return env.SUBMIT_PROXY.fetch(bindingUrl, init);
    }
    throw error;
  }
}
