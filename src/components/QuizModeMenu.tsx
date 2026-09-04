import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type QuizModeValue = "easy" | "normal" | "hard" | "very-hard";

type Props = {
  value: QuizModeValue;
  options?: readonly QuizModeValue[];
  onChange: (value: QuizModeValue) => void;
};

const DEFAULT_OPTIONS: readonly QuizModeValue[] = ["easy", "normal", "hard", "very-hard"];
const MENU_WIDTH = 176;
const VIEWPORT_GAP = 8;

export default function QuizModeMenu({ value, options = DEFAULT_OPTIONS, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ left: VIEWPORT_GAP, top: VIEWPORT_GAP });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const placeMenu = () => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const estimatedHeight = options.length * 36 + 8;
    const left = Math.max(VIEWPORT_GAP, Math.min(window.innerWidth - MENU_WIDTH - VIEWPORT_GAP, rect.right - MENU_WIDTH));
    const below = rect.bottom + VIEWPORT_GAP;
    const top = below + estimatedHeight <= window.innerHeight - VIEWPORT_GAP
      ? below
      : Math.max(VIEWPORT_GAP, rect.top - estimatedHeight - VIEWPORT_GAP);
    setPosition({ left, top });
  };

  useLayoutEffect(() => {
    if (open) placeMenu();
  }, [open, options.length]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => placeMenu();
    const closeOnOutsidePress = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!buttonRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    document.addEventListener("pointerdown", closeOnOutsidePress);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("pointerdown", closeOnOutsidePress);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open, options.length]);

  return (
    <div className="bus-quiz-mode-control relative z-[71] mb-2 ml-auto w-fit">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        className="rounded-full border border-[#f0d88f]/65 bg-[#10211d] px-3 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-[#f7d678] shadow-lg"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(current => !current);
        }}
      >
        Mode
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          role="menu"
          aria-label="Quiz difficulty"
          className="fixed z-[2147483641] flex w-44 flex-col overflow-hidden rounded-xl border border-[#f0d88f]/50 bg-[#10211d] p-1 shadow-2xl"
          style={position}
          onClick={event => event.stopPropagation()}
        >
          {options.map(option => (
            <button
              key={option}
              type="button"
              role="menuitemradio"
              aria-checked={option === value}
              className={`flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs capitalize ${option === value ? "bg-[#c4942a] text-[#1b1408]" : "text-white hover:bg-white/10"}`}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
            >
              <span>{option === "very-hard" ? "Very Hard" : option}</span>
              <span aria-hidden="true">{option === value ? "selected" : ""}</span>
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  );
}
