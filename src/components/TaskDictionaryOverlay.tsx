import { useEffect, useState } from "react";

const glossary: Record<string, [string, string]> = {
  "i am": ["我是／我处于…状态", "am 是 be 动词第一人称单数现在时，用于 I am。"], am: ["是", "be 动词第一人称单数现在时。"], be: ["是；成为", "动词原形；形式包括 am、is、are、was、were。"],
  unhappy: ["不开心的", "形容词：un-（不）+ happy（开心）。"], happy: ["开心的", "形容词：感到高兴。"], shop: ["商店", "名词：买东西的地方。"],
  coffee: ["咖啡", "名词：咖啡豆制成的饮料。"], drink: ["喝", "动词：喝液体。"], "drink coffee": ["喝咖啡", "动词短语：drink + coffee。"],
  bed: ["床", "名词：睡觉用的床。"], view: ["看；观看", "动词：看见或观看。"], follow: ["跟随", "动词：在某人或某物后面走。"],
  start: ["开始", "动词：开始做某事。"], run: ["跑", "动词：快速移动。"], jump: ["跳", "动词：双脚离地跳起。"], climb: ["爬", "动词：向上攀爬。"], walk: ["走路", "动词：步行。"], carry: ["搬运", "动词：拿着某物移动。"], finish: ["完成", "动词：做完或结束。"],
  chicken: ["鸡肉", "名词：鸡的肉。"], potatoes: ["土豆", "名词 potato 的复数。"], water: ["水", "名词：饮用的水。"], "ice cream": ["冰淇淋", "名词：冷冻甜点。"],
};

export default function TaskDictionaryOverlay() {
  const [tip, setTip] = useState<{ word: string; meaning: string; note: string; x: number; y: number } | null>(null);
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      setTip(null);
      return;
      const target = event.target as HTMLElement;
      if (target.closest(".sports-day-adventure")) { setTip(null); return; }
      if (!target.closest(".scene-panel, .shop-task-box, .bilingual-type-cue, .cop-dialogue-panel")) { setTip(null); return; }
      const text = target.textContent?.trim().toLowerCase() ?? "";
      const entry = Object.keys(glossary).sort((a, b) => b.length - a.length).find(word => new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(text));
      if (!entry) { setTip(null); return; }
      const [meaning, note] = glossary[entry]; setTip({ word: entry, meaning, note, x: event.clientX + 14, y: event.clientY + 14 });
    };
    window.addEventListener("mousemove", onMove, true); return () => window.removeEventListener("mousemove", onMove, true);
  }, []);
  return tip ? <div className="fixed z-[2147483644] max-w-72 rounded-lg border border-amber-200 bg-[#fffdf6] px-3 py-2 text-xs text-slate-900 shadow-2xl" style={{ left: tip.x, top: tip.y, pointerEvents: "none" }}><b>{tip.word} · {tip.meaning}</b><br />{tip.note}</div> : null;
}
