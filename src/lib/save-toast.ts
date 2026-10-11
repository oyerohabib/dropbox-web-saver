import type { SaveToastStatus } from "./types";

const SUCCESS_HIDE_DELAY_MS = 5_000;

const STYLES = `
  :host {
    all: initial;
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 2147483647;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  }
  .toast {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    width: 340px;
    max-width: calc(100vw - 40px);
    padding: 14px 14px 14px 16px;
    border: 1px solid #e3e8ef;
    border-left: 4px solid #0061fe;
    border-radius: 12px;
    background: #ffffff;
    color: #1e1919;
    box-shadow: 0 8px 24px rgba(16, 24, 40, 0.16);
    font-size: 13px;
    line-height: 1.4;
    box-sizing: border-box;
  }
  .toast.enter { animation: slide-in 180ms ease-out; }
  .toast.success { border-left-color: #1e8e3e; }
  .toast.error { border-left-color: #d93025; }
  .icon {
    display: grid;
    place-items: center;
    flex: none;
    width: 22px;
    height: 22px;
    border-radius: 50%;
    color: #ffffff;
    font-size: 13px;
    font-weight: 700;
  }
  .success .icon { background: #1e8e3e; }
  .error .icon { background: #d93025; }
  .spinner {
    width: 16px;
    height: 16px;
    border: 2px solid #0061fe;
    border-right-color: transparent;
    border-radius: 50%;
    animation: spin 700ms linear infinite;
  }
  .body { flex: 1; min-width: 0; }
  .title { font-weight: 600; font-size: 14px; }
  .detail {
    margin-top: 2px;
    color: #637282;
    overflow-wrap: anywhere;
  }
  .link {
    display: inline-block;
    margin-top: 6px;
    color: #0061fe;
    font-weight: 600;
    text-decoration: none;
  }
  .link:hover { text-decoration: underline; }
  .close {
    flex: none;
    width: 24px;
    height: 24px;
    margin: -4px -4px 0 0;
    padding: 0;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: #637282;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .close:hover { background: #f1f4f9; color: #1e1919; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes slide-in {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

const TITLES: Record<Exclude<SaveToastStatus["state"], "hidden">, string> = {
  saving: "Saving to Dropbox…",
  success: "Saved to Dropbox",
  error: "Couldn't save to Dropbox",
};

let toastRoot: ShadowRoot | null = null;
let hideTimer: ReturnType<typeof setTimeout> | undefined;

function createElement(tag: string, className: string, text?: string): HTMLElement {
  const element = document.createElement(tag);
  element.className = className;
  if (text) element.textContent = text;
  return element;
}

function removeToast() {
  clearTimeout(hideTimer);
  toastRoot?.host.remove();
  toastRoot = null;
}

function scheduleHide() {
  clearTimeout(hideTimer);
  hideTimer = setTimeout(removeToast, SUCCESS_HIDE_DELAY_MS);
}

function describeStatus(status: SaveToastStatus): string {
  if (status.state === "error") return status.message || "Something went wrong.";
  const destination = status.folderPath ? ` → ${status.folderPath}` : "";
  return `${status.filename ?? "File"}${destination}`;
}

export function showSaveToast(status: SaveToastStatus) {
  clearTimeout(hideTimer);
  if (status.state === "hidden") {
    removeToast();
    return;
  }

  const isNew = !toastRoot?.host.isConnected;
  if (isNew) {
    const host = document.createElement("web-saver-toast");
    toastRoot = host.attachShadow({ mode: "closed" });
    (document.body ?? document.documentElement).append(host);
  }
  const root = toastRoot!;

  const toast = createElement("div", `toast ${status.state}${isNew ? " enter" : ""}`);
  toast.setAttribute("role", status.state === "error" ? "alert" : "status");
  toast.setAttribute("aria-live", status.state === "error" ? "assertive" : "polite");

  const icon = createElement("div", "icon", status.state === "success" ? "✓" : status.state === "error" ? "!" : "");
  if (status.state === "saving") icon.append(createElement("div", "spinner"));

  const body = createElement("div", "body");
  body.append(createElement("div", "title", TITLES[status.state]), createElement("div", "detail", describeStatus(status)));
  if (status.state === "success" && status.dropboxUrl) {
    const link = createElement("a", "link", "Open in Dropbox") as HTMLAnchorElement;
    link.href = status.dropboxUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    body.append(link);
  }

  const close = createElement("button", "close", "×");
  close.setAttribute("aria-label", "Dismiss");
  close.addEventListener("click", removeToast);

  toast.append(icon, body, close);
  if (status.state === "success") {
    toast.addEventListener("mouseenter", () => clearTimeout(hideTimer));
    toast.addEventListener("mouseleave", scheduleHide);
    scheduleHide();
  }

  const style = document.createElement("style");
  style.textContent = STYLES;
  root.replaceChildren(style, toast);
}
