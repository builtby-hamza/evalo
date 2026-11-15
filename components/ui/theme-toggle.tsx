"use client";

import { useSyncExternalStore } from "react";

const themeEvent = "evalo-theme-change";

function readTheme() {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  function syncStorage(event: StorageEvent) {
    if (event.key !== "evalo-theme" && event.key !== null) return;
    document.documentElement.dataset.theme = event.newValue === "dark" ? "dark" : "light";
    onChange();
  }
  window.addEventListener(themeEvent, onChange);
  window.addEventListener("storage", syncStorage);
  return () => {
    window.removeEventListener(themeEvent, onChange);
    window.removeEventListener("storage", syncStorage);
  };
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "light");
  function toggleTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("evalo-theme", next); } catch { /* Theme still works when storage is unavailable. */ }
    window.dispatchEvent(new Event(themeEvent));
  }
  return (
    <button className="theme-toggle" type="button" role="switch" aria-label="Dark mode" aria-checked={theme === "dark"} onClick={toggleTheme}>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" /></svg>
      <span>Dark mode</span><span className="theme-track" aria-hidden="true"><span /></span>
    </button>
  );
}
