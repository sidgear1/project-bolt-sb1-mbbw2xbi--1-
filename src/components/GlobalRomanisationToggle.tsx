import { useEffect, useRef, useState } from "react";
import { Settings, Volume2, VolumeX } from "lucide-react";

const STORAGE_KEY = "taletalk-romanisation-enabled";

const HIDDEN_SCREEN_SELECTOR = [
  ".world-map-scene",
  ".hub-shell",
  ".adventure-highlight-menu",
  ".roam-location-screen",
  ".scene-preload",
  ".roam-preload",
  ".menu-loading-screen",
  "[aria-label='Preparing game']",
  // Both profile-selection layouts used by the Choose Your Story screen.
  "main.relative.mx-auto.my-4.max-w-4xl.rounded-3xl",
  "main.w-full.max-w-3xl.rounded-3xl",
].join(", ");

// Romanisation is the beginner-friendly default. An existing explicit choice
// is never overwritten; this only initialises a completely new game install.
if (localStorage.getItem(STORAGE_KEY) === null) localStorage.setItem(STORAGE_KEY, "true");

export default function GlobalRomanisationToggle() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === "true");
  const [muted, setMuted] = useState(() => localStorage.getItem("taletalk-sound-muted") === "true");
  const [visible, setVisible] = useState(() => !document.querySelector(HIDDEN_SCREEN_SELECTOR));
  const [open, setOpen] = useState(false);
  const controlsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sync = (event: Event) => setEnabled(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("taletalk-romanisation-change", sync);
    return () => window.removeEventListener("taletalk-romanisation-change", sync);
  }, []);

  useEffect(() => {
    if (!open) return;
    const close = (event: PointerEvent) => {
      if (!controlsRef.current?.contains(event.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close, true);
    return () => window.removeEventListener("pointerdown", close, true);
  }, [open]);

  useEffect(() => {
    // The World Map and main menu own their own controls. Showing the scene
    // strip there creates duplicate buttons and disconnected sound state.
    const updateVisibility = () => requestAnimationFrame(() => setVisible(!document.querySelector(HIDDEN_SCREEN_SELECTOR)));
    updateVisibility();
    const observer = new MutationObserver(updateVisibility);
    observer.observe(document.getElementById("root")!, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sync = (event: Event) => setMuted(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("taletalk-sound-change", sync);
    return () => window.removeEventListener("taletalk-sound-change", sync);
  }, []);

  const toggleRomanisation = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(STORAGE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("taletalk-romanisation-change", { detail: next }));
  };

  const toggleSound = () => {
    const next = !muted;
    setMuted(next);
    localStorage.setItem("taletalk-sound-muted", String(next));
    document.querySelectorAll<HTMLMediaElement>("audio,video").forEach(media => { media.muted = next; });
    window.dispatchEvent(new CustomEvent("taletalk-sound-change", { detail: next }));
  };

  const openMenu = () => {
    const buttons = [...document.querySelectorAll<HTMLButtonElement>("button")]
      .filter(button => !button.closest(".global-scene-controls"));
    const isMenu = (button: HTMLButtonElement) => /^(map|menu|地图|菜单)$/i.test(
      `${button.getAttribute("aria-label") ?? ""} ${button.textContent ?? ""}`.trim(),
    );
    const menuButton = buttons.find(button => isMenu(button) && Boolean(button.closest("header,.scene-header")))
      ?? buttons.find(isMenu);
    menuButton?.click();
  };

  if (!visible) return null;
  return <div ref={controlsRef} className="global-scene-controls">
    <button type="button" className={`global-romanisation-toggle ${enabled ? "is-enabled" : ""}`} onClick={toggleRomanisation} aria-pressed={enabled} title="Show or hide Romanisation everywhere">
      <span>Romanisation</span><b aria-hidden="true">{enabled ? "✓" : ""}</b>
    </button>
    <button type="button" className="global-scene-settings-trigger" onClick={() => setOpen(value => !value)} aria-label="Adventure settings" aria-expanded={open}><Settings size={20} /></button>
    {open && <div className="global-scene-settings-menu">
      <button type="button" className="global-scene-control global-sound-control" onClick={toggleSound} aria-label={muted ? "Turn sound on" : "Mute sound"}>
        {muted ? <VolumeX size={15} /> : <Volume2 size={15} />}<span>{muted ? "Sound on" : "Sound off"}</span>
      </button>
      <button type="button" className="global-scene-control" onClick={openMenu}>Menu</button>
    </div>}
  </div>;
}
