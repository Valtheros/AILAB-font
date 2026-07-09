export function parseJsonText<T>(text: string, fallbackMessage: string): T {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(fallbackMessage);
  }
}

export function apiBaseUrl() {
  if (process.env.NEXT_PUBLIC_USE_API_PROXY === "false") {
    return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  }
  return "/api/backend";
}

export function artifactDownloadUrl(
  apiUrl: string,
  projectName: string,
  filePath: string,
) {
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${apiUrl}/api/runs/${encodeURIComponent(projectName)}/files/${encodedPath}`;
}

export function projectSlug(value: string) {
  const normalized = value
    .trim()
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[^A-Za-z0-9]+/, "")
    .slice(0, 96);
  return normalized || "cv_run";
}
