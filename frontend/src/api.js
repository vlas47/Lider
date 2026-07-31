let csrfToken = "";


export function setCsrfToken(value) {
  csrfToken = value || "";
}


function cookie(name) {
  const prefix = `${name}=`;
  return document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length) || "";
}


export function endpoint(path) {
  return new URL(path.replace(/^\//, ""), window.location.href).toString();
}


export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const token = csrfToken || decodeURIComponent(cookie("ai_lapin_csrftoken"));
  if (token && !headers.has("X-CSRFToken")) {
    headers.set("X-CSRFToken", token);
  }

  const response = await fetch(endpoint(path), {
    credentials: "same-origin",
    cache: "no-store",
    ...options,
    headers,
  });
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : await response.text();
  if (!response.ok) {
    const message = typeof payload === "object" ? payload.error : payload;
    throw new Error(message || `HTTP ${response.status}`);
  }
  return payload;
}
