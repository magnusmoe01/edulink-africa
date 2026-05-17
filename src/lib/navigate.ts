export function navigate(path: string) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function openInNewTab(path: string) {
  window.open(path, "_blank", "noopener,noreferrer");
}
