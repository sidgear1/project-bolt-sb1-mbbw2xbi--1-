import { useEffect, useState } from "react";

type KoreanGuide = { meaning: string; romanisation: string; breakdown: Array<{ part: string; detail: string }>; grammar: string };

// Hover cards are grammar guides, not dictionary-definition cards. Hide notes that
// merely repeat a word's obvious meaning or describe its everyday category. Useful
// morphology remains visible: particles, sentence roles, endings, tense, politeness,
// modifiers, irregular forms, and how multi-part Korean forms are constructed.
const COMMON_KNOWLEDGE_NOTES = [
  /^A noun for /i,
  /^An adverb\/noun-like word describing /i,
  /^A noun: the place /i,
  /^A thing word/i,
  /^This is the polite way to say /i,
  /^A place word/i,
  /^A compound noun: literally /i,
  /^A warm, casual reaction/i,
  /^The standard polite greeting/i,
  /^A formal, widely used way /i,
  /^Learn this as one polite fixed expression/i,
  /^A compound noun for /i,
  /^A thing word:/i,
  /^Here it means /i,
  /^A noun\. Here /i,
  /^A place\/landscape word/i,
  /^A person word/i,
  /^In .+ it forms the greeting/i,
  /^A landscape (?:word|thing word)/i,
  /^The standard noun /i,
  /^A place\/object word/i,
  /^A food word/i,
  /^A drink word/i,
  /^A borrowed brand name/i,
  /^Part of the borrowed /i,
  /^Used here inside the borrowed /i,
  /^A fruit word/i,
  /^No separate particle or ending is visible here/i,
];

const grammarOnly = (note: string) => COMMON_KNOWLEDGE_NOTES.some((pattern) => pattern.test(note)) ? "" : note;
const guide = (meaning: string, romanisation: string, breakdown: KoreanGuide["breakdown"], grammar: string): KoreanGuide => ({ meaning, romanisation, breakdown, grammar: grammarOnly(grammar) });

const KOREAN_GUIDE: Record<string, KoreanGuide> = {
  "사과": guide("apple", "sa-gwa", [{ part: "사과", detail: "apple — a standalone noun for the fruit" }], ""),
  "저녁": guide("evening / dinner", "jeo-nyeok", [{ part: "저녁", detail: "standalone noun" }], "The particle determines its role: 에 marks a time/location, while 을 marks the noun as the object."),
  "음료": guide("drinks / beverages", "eum-ryo", [{ part: "음", detail: "drink / beverage" }, { part: "료", detail: "material or item; used in many noun compounds" }], "A noun for drinks or beverages. It names the drinks section, not one specific drink."),
  "혼자": guide("alone / by yourself", "hon-ja", [{ part: "혼자", detail: "alone; by yourself" }], "An adverb/noun-like word describing doing something without anyone else."),
  "학교": guide("school", "hak-gyo", [{ part: "학", detail: "learning / study" }, { part: "교", detail: "school" }], "A noun: the place connected with learning."),
  "갈": guide("will go / going to", "gal", [{ part: "가", detail: "from 가다 — to go" }, { part: "ㄹ", detail: "turns the verb into a modifier for the noun after it" }], "From 가다 (to go). 갈 describes the following noun, as in ‘preparation to go to school’."),
  "준비": guide("preparation / getting ready", "jun-bi", [{ part: "준비", detail: "preparation; getting ready" }], "A noun. With 하다 it becomes 준비하다: ‘to prepare’."),
  "다": guide("all / completely", "da", [{ part: "다", detail: "all; completely" }], "Placed before a verb, it means the action was done completely or all of it was done."),
  "했잖아": guide("you did, remember?", "haet-ja-na", [{ part: "했어", detail: "did — past form of 하다, to do" }, { part: "-잖아", detail: "reminds the listener of something they already know" }], "A casual reminder: ‘you did it already, you know / remember?’"),
  "커피": guide("coffee", "keo-pi", [{ part: "커피", detail: "coffee — noun" }], "A thing word. Add a particle to show its job in a sentence."),
  "저는": guide("I (topic form)", "jeo-neun", [{ part: "저", detail: "I — humble first-person pronoun" }, { part: "는", detail: "topic marker — ‘as for me’" }], "저 is the topic: this sentence is about me."),
  "저": guide("I", "jeo", [{ part: "저", detail: "humble first-person pronoun" }], "This is the polite way to say ‘I’."),
  "슬퍼요": guide("am unhappy / sad", "seul-peo-yo", [{ part: "슬퍼", detail: "sad / unhappy" }, { part: "요", detail: "polite ending" }], "A polite complete description: Korean adjectives work like verbs."),
  "아이스크림": guide("ice cream", "a-i-seu-keu-rim", [{ part: "아이스크림", detail: "ice cream — loanword noun" }], "A thing word."),
  "가게": guide("shop / store", "ga-ge", [{ part: "가게", detail: "shop / store — noun" }], "A place word."),
  "닭고기": guide("chicken meat", "dal-go-gi", [{ part: "닭", detail: "chicken" }, { part: "고기", detail: "meat" }], "A compound noun: literally ‘chicken meat’."),
  "감자": guide("potato", "gam-ja", [{ part: "감자", detail: "potato — noun" }], "A thing word."),
  "물": guide("water", "mul", [{ part: "물", detail: "water — noun" }], "A thing word."),
  "침대": guide("bed", "chim-dae", [{ part: "침대", detail: "bed — noun" }], "A thing word."),
  "나르다": guide("to carry", "na-reu-da", [{ part: "나르", detail: "carry" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form, before tense or politeness is added."),
  "달리다": guide("to run", "dal-li-da", [{ part: "달리", detail: "run" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form."),
  "뛰다": guide("to jump", "ttwi-da", [{ part: "뛰", detail: "jump" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form."),
  "오르다": guide("to climb / go up", "o-reu-da", [{ part: "오르", detail: "climb / go up" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form."),
  "시작하다": guide("to start", "si-jak-ha-da", [{ part: "시작", detail: "start / beginning" }, { part: "하다", detail: "to do" }], "A ‘do’ verb: literally ‘do a start’."),
  "보다": guide("to see / look at", "bo-da", [{ part: "보", detail: "see / look" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form. In a command or sentence, its ending changes to match politeness and tense."),
  "앉다": guide("to sit / sitting", "anj-da", [{ part: "앉", detail: "sit" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form for sitting down or being seated."),
  "따라가다": guide("to follow", "tta-ra-ga-da", [{ part: "따라", detail: "following / along" }, { part: "가", detail: "go" }, { part: "다", detail: "dictionary-form ending" }], "The base verb form for following someone or something as it moves."),
  "좋아": guide("good / I like it", "jo-a", [{ part: "좋", detail: "good; like" }, { part: "아", detail: "casual conversational ending" }], "A warm, casual reaction. Context decides whether it means ‘good’ or ‘I like it’."),
  "일어서다": guide("to stand up", "il-eo-seo-da", [{ part: "일어서", detail: "stand up / rise" }, { part: "다", detail: "dictionary-form ending" }], "A movement verb in its base dictionary form."),
  "걷다": guide("to walk", "geot-da", [{ part: "걷", detail: "walk" }, { part: "다", detail: "dictionary-form ending" }], "The base form of the action ‘to walk’."),
  "줍다": guide("to pick up", "jup-da", [{ part: "줍", detail: "pick up something from the ground" }, { part: "다", detail: "dictionary-form ending" }], "The base form of an irregular Korean verb."),
  "내려놓다": guide("to put down", "nae-ryeo-no-ta", [{ part: "내려", detail: "down / downward" }, { part: "놓다", detail: "put / place" }], "A compound action: move something downward and place it."),
  "끝내다": guide("to finish", "kkeut-nae-da", [{ part: "끝", detail: "end" }, { part: "내다", detail: "bring about / complete" }], "A transitive verb: the subject finishes or completes something."),
  "마시다": guide("to drink", "ma-si-da", [{ part: "마시", detail: "drink" }, { part: "다", detail: "dictionary-form ending" }], "The base form of the verb ‘to drink’."),
  "하다": guide("to do", "ha-da", [{ part: "하", detail: "do" }, { part: "다", detail: "dictionary-form ending" }], "하다 combines with many nouns to create verbs, such as 시작하다, ‘to start’."),
  "주다": guide("to give", "ju-da", [{ part: "주", detail: "give" }, { part: "다", detail: "dictionary-form ending" }], "The base form of ‘to give’. It can also help make polite requests."),
  "가다": guide("to go", "ga-da", [{ part: "가", detail: "go" }, { part: "다", detail: "dictionary-form ending" }], "The base form of the movement verb ‘to go’."),
  "준비하다": guide("to prepare / get ready", "jun-bi-ha-da", [{ part: "준비", detail: "preparation" }, { part: "하다", detail: "to do" }], "A 하다 verb: literally ‘do preparation’."),
  "커피를": guide("coffee (object form)", "keo-pi-reul", [{ part: "커피", detail: "coffee" }, { part: "를", detail: "object marker — coffee receives the action" }], "In 커피를 마시다, the 를 marks coffee as the thing being drunk."),
  "사과와": guide("apple and …", "sa-gwa-wa", [{ part: "사과", detail: "apple" }, { part: "와", detail: "and — used after a vowel" }], "와 connects this noun to the next noun: ‘apple and …’."),
  "닭고기와": guide("chicken and …", "dal-go-gi-wa", [{ part: "닭고기", detail: "chicken meat" }, { part: "와", detail: "and — used after a vowel" }], "와 joins chicken to the noun that follows it."),
  "바나나": guide("banana", "ba-na-na", [{ part: "바나나", detail: "banana — loanword noun" }], "A thing word. Add a particle to show its role in a sentence."),
  "긴장한": guide("nervous / tense", "gin-jang-han", [{ part: "긴장하", detail: "be nervous / tense" }, { part: "ㄴ", detail: "turns it into a description of the following noun" }], "This modifier must be followed by the person or thing being described."),
  "그녀에게": guide("to her", "geu-nyeo-e-ge", [{ part: "그녀", detail: "she / her" }, { part: "에게", detail: "to — marks a person receiving something" }], "에게 marks her as the recipient, as in ‘give flowers to her’."),
  "꽃을": guide("flower(s) (object form)", "kkoch-eul", [{ part: "꽃", detail: "flower" }, { part: "을", detail: "object marker — answers ‘what?’" }], "을 marks the flowers as the thing being given."),
  "안녕하세요": guide("hello", "an-nyeong-ha-se-yo", [{ part: "안녕", detail: "peace / well-being" }, { part: "하세요", detail: "polite honorific form of ‘do / be’" }], "The standard polite greeting, suitable for most everyday situations."),
  "감사합니다": guide("thank you", "gam-sa-ham-ni-da", [{ part: "감사", detail: "thanks / gratitude" }, { part: "합니다", detail: "formal polite ‘do’ ending" }], "A formal, widely used way to say thank you."),
  "천만에요": guide("you’re welcome", "cheon-man-e-yo", [{ part: "천만", detail: "literally ‘ten million’; part of the fixed expression" }, { part: "에요", detail: "polite ending" }], "Learn this as one polite fixed expression meaning ‘you’re welcome’."),
  "주세요": guide("please give me", "ju-se-yo", [{ part: "주", detail: "give" }, { part: "세요", detail: "polite request ending" }], "Put it after an item to request it politely: 아이스크림 주세요."),
  "하나": guide("one / one item", "ha-na", [{ part: "하나", detail: "the native-Korean number one" }], "Used when counting one item. In orders it means ‘one of these’."),
  "창문": guide("window", "chang-mun", [{ part: "창", detail: "window / opening" }, { part: "문", detail: "door" }], "A compound noun for a window."),
  "열쇠": guide("key", "yeol-soe", [{ part: "열쇠", detail: "key — a standalone noun" }], "A thing word: a key used to open a lock."),
  "다리": guide("bridge / leg", "da-ri", [{ part: "다리", detail: "bridge or leg, depending on context" }], "Here it means ‘bridge’. Korean uses the same sound for ‘bridge’ and ‘leg’; context distinguishes them."),
  "나무": guide("tree / wood", "na-mu", [{ part: "나무", detail: "tree; also wood as a material" }], "A noun. Here it names the trees in the scene."),
  "강": guide("river", "gang", [{ part: "강", detail: "river — noun" }], "A place/landscape word for a river."),
  "친구": guide("friend", "chin-gu", [{ part: "친구", detail: "friend — noun" }], "A person word. Particles added after it show its role in a sentence."),
  "좋은": guide("good", "jo-eun", [{ part: "좋", detail: "good" }, { part: "은", detail: "modifier ending describing the following noun" }], "좋은 comes before a noun, as in 좋은 아침, ‘good morning’."),
  "아침": guide("morning", "a-chim", [{ part: "아침", detail: "morning — time noun" }], "In 좋은 아침 it forms the greeting ‘good morning’."),
  "하늘": guide("sky", "ha-neul", [{ part: "하늘", detail: "sky — noun" }], "A landscape word naming the sky above."),
  "나뭇잎": guide("leaf / leaves", "na-mun-nip", [{ part: "나무", detail: "tree" }, { part: "잎", detail: "leaf" }], "The pronunciation changes where the two parts meet."),
  "바위": guide("rock / boulder", "ba-wi", [{ part: "바위", detail: "rock or boulder — noun" }], "A landscape thing word."),
  "물살": guide("current / flow of water", "mul-ssal", [{ part: "물", detail: "water" }, { part: "살", detail: "forceful flow / current" }], "A compound noun for moving water or a current."),
  "자동차": guide("car / automobile", "ja-dong-cha", [{ part: "자동", detail: "automatic / self-moving" }, { part: "차", detail: "vehicle" }], "The standard noun for a car or automobile."),
  "횡단보도": guide("crosswalk", "hoeng-dan-bo-do", [{ part: "횡단", detail: "crossing from side to side" }, { part: "보도", detail: "pedestrian path" }], "A compound noun for a pedestrian crossing."),
  "도로": guide("road", "do-ro", [{ part: "도로", detail: "road — noun" }], "A place word for a road or roadway."),
  "숲": guide("forest / woods", "sup", [{ part: "숲", detail: "forest / woods — noun" }], "A place word naming an area filled with trees."),
  "계단": guide("stairs", "gye-dan", [{ part: "계단", detail: "stairs / staircase — noun" }], "A place/object word for a flight of stairs."),
  "정원": guide("garden", "jeong-won", [{ part: "정원", detail: "garden — noun" }], "A place word for a planned garden."),
  "조각상": guide("statue", "jo-gak-sang", [{ part: "조각", detail: "sculpture / carving" }, { part: "상", detail: "figure / statue" }], "A compound noun for a sculpted figure."),
  "바다": guide("sea / ocean", "ba-da", [{ part: "바다", detail: "sea / ocean — noun" }], "A landscape word for the sea or ocean."),
  "그림자": guide("shadow", "geu-rim-ja", [{ part: "그림자", detail: "shadow — noun" }], "A thing word naming the dark shape made when light is blocked."),
  "피자": guide("pizza", "pi-ja", [{ part: "피자", detail: "pizza — loanword noun" }], "A food word borrowed into Korean."),
  "주스": guide("juice", "ju-seu", [{ part: "주스", detail: "juice — loanword noun" }], "A drink word borrowed into Korean."),
  "코카콜라": guide("Coca-Cola", "ko-ka-kol-la", [{ part: "코카콜라", detail: "Coca-Cola — brand name written in Hangul" }], "A borrowed brand name represented with Korean sounds."),
  "피시": guide("fish", "pi-si", [{ part: "피시", detail: "‘fish’ written as a Korean loanword" }], "Part of the borrowed food name 피시 앤 칩스."),
  "앤": guide("and", "aen", [{ part: "앤", detail: "English ‘and’ written as a Korean loanword" }], "Used here inside the borrowed phrase 피시 앤 칩스."),
  "칩스": guide("chips", "chip-seu", [{ part: "칩스", detail: "‘chips’ written as a Korean loanword" }], "Part of the borrowed food name 피시 앤 칩스."),
  "오렌지": guide("orange", "o-ren-ji", [{ part: "오렌지", detail: "orange — loanword noun" }], "A fruit word borrowed into Korean."),
  "딸기": guide("strawberry", "ttal-gi", [{ part: "딸기", detail: "strawberry — noun" }], "A fruit word used as a standalone noun."),
};

function romaniseHangul(term: string) {
  const initials = ["g", "kk", "n", "d", "tt", "r", "m", "b", "pp", "s", "ss", "", "j", "jj", "ch", "k", "t", "p", "h"];
  const vowels = ["a", "ae", "ya", "yae", "eo", "e", "yeo", "ye", "o", "wa", "wae", "oe", "yo", "u", "wo", "we", "wi", "yu", "eu", "ui", "i"];
  const finals = ["", "k", "k", "ks", "n", "nj", "nh", "t", "l", "lk", "lm", "lb", "ls", "lt", "lp", "lh", "m", "p", "ps", "t", "t", "ng", "t", "t", "k", "t", "p", "h"];
  return [...term].map(character => {
    const code = character.charCodeAt(0) - 0xac00;
    if (code < 0 || code > 11171) return character;
    return `${initials[Math.floor(code / 588)]}${vowels[Math.floor((code % 588) / 28)]}${finals[code % 28]}`;
  }).join("-");
}

function fallbackFor(term: string): KoreanGuide | null {
  // A lone syllable may simply be one rendered letter from a longer answer.
  // Never guess that it is a particle or ending without the full word.
  if ([...term].length < 2) return null;
  const particles: Array<[string, string, string, string]> = [["에게", "recipient form", "to — marks a person receiving something", "recipient"], ["에서", "place form", "at / in — where an action happens", "place"], ["으로", "direction / means form", "toward / by means of", "direction or means"], ["로", "direction / means form", "toward / by means of", "direction or means"], ["을", "object form", "object marker — answers ‘what?’", "object"], ["를", "object form", "object marker — answers ‘what?’", "object"], ["은", "topic form", "topic marker — ‘as for …’", "topic"], ["는", "topic form", "topic marker — ‘as for …’", "topic"], ["이", "subject form", "subject marker", "subject"], ["가", "subject form", "subject marker", "subject"], ["와", "joined noun", "and — connects this noun to another", "joined noun"], ["과", "joined noun", "and — connects this noun to another", "joined noun"], ["도", "addition form", "also / too", "additional item"], ["에", "place form", "to / at / in — destination or location", "place"]];
  const found = particles.find(([particle]) => term.endsWith(particle));
  if (found) {
    const [particle, meaning, detail, role] = found;
    const base = term.slice(0, -particle.length);
    return guide(meaning, romaniseHangul(term), [{ part: base, detail: `the person, thing, or place being used as the ${role}` }, { part: particle, detail }], `The ending tells you that ${base} is the ${role} in this sentence.`);
  }
  if (term.endsWith("다")) return guide("dictionary verb / adjective", romaniseHangul(term), [{ part: term.slice(0, -1), detail: "word stem" }, { part: "다", detail: "dictionary-form ending" }], "This is the base form found in a dictionary, before tense or politeness is added.");
  if (term.endsWith("요")) return guide("polite word or expression", romaniseHangul(term), [{ part: term.slice(0, -1), detail: "main meaning" }, { part: "요", detail: "makes it polite" }], "This is a polite form used when speaking respectfully.");
  // Do not manufacture an empty card for an unknown Hangul word or syllable.
  // A guide is useful only when we can explain real grammar or morphology.
  return null;
}

function findGuideAtPointer(event: MouseEvent): { term: string; entry: KoreanGuide } | null {
  const target = event.target;
  if (!(target instanceof HTMLElement) || target.closest("input, textarea")) return null;
  const explicitGuide = target.closest<HTMLElement>("[data-korean-guide]")?.dataset.koreanGuide?.trim();
  if (explicitGuide) {
    const entry = KOREAN_GUIDE[explicitGuide] ?? fallbackFor(explicitGuide);
    if (entry) return { term: explicitGuide, entry };
  }
  const range = document.caretRangeFromPoint?.(event.clientX, event.clientY);
  const node = range?.startContainer.nodeType === Node.TEXT_NODE ? range.startContainer : null;
  const text = node?.textContent ?? "";
  const offset = range?.startOffset ?? -1;
  if (offset < 0) return null;
  let term = [...text.matchAll(/[\uAC00-\uD7AF]+/g)].find((word) => offset >= (word.index ?? 0) && offset <= (word.index ?? 0) + word[0].length)?.[0];
  // Some task bars draw every Hangul syllable in its own span for letter-by-letter
  // feedback. Treat those adjacent syllables as the one Korean word the player sees.
  if (term && /^[\uAC00-\uD7AF]$/.test(term) && target.parentElement) {
    const siblings = [...target.parentElement.childNodes];
    const targetIndex = siblings.findIndex((sibling) => sibling === target || sibling.contains(node));
    const hangulAt = (index: number) => /^[\uAC00-\uD7AF]+$/.test(siblings[index]?.textContent?.trim() ?? "");
    if (targetIndex >= 0 && hangulAt(targetIndex)) {
      let start = targetIndex;
      let end = targetIndex;
      while (start > 0 && hangulAt(start - 1)) start -= 1;
      while (end < siblings.length - 1 && hangulAt(end + 1)) end += 1;
      term = siblings.slice(start, end + 1).map((sibling) => sibling.textContent?.trim() ?? "").join("");
    }
  }
  if (!term) return null;
  const entry = KOREAN_GUIDE[term] ?? fallbackFor(term);
  return entry ? { term, entry } : null;
}

export default function GlobalKoreanWordGuide() {
  const [hovered, setHovered] = useState<{ term: string; entry: KoreanGuide; x: number; y: number } | null>(null);
  useEffect(() => {
    const move = (event: MouseEvent) => {
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (
        target?.closest(".roam-video-screen") ||
        document.querySelector(".global-task-panel-editing, .bus-layout-item.is-editing")
      ) {
        setHovered(null);
        return;
      }
      const found = findGuideAtPointer(event);
      setHovered(found ? { ...found, x: Math.min(window.innerWidth - 340, event.clientX + 16), y: Math.min(window.innerHeight - 250, event.clientY + 16) } : null);
    };
    window.addEventListener("mousemove", move, true);
    return () => window.removeEventListener("mousemove", move, true);
  }, []);
  if (!hovered) return null;
  return <aside className="global-korean-word-guide fixed z-[500] w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-[#f0d88f]/65 bg-[#071c22]/95 p-3 text-left text-[#fff8e8] shadow-2xl backdrop-blur-md" style={{ left: hovered.x, top: hovered.y, pointerEvents: "none" }} aria-live="polite">
    <strong className="block text-lg text-[#ffe08a]">{hovered.term}</strong>
    <span className="block text-sm font-semibold text-sky-200">{hovered.entry.romanisation} · {hovered.entry.meaning}</span>
    {hovered.entry.breakdown.length > 0 && <div className="mt-2 space-y-1 border-y border-white/15 py-2 text-xs">{hovered.entry.breakdown.map((item) => <div key={item.part} className="grid grid-cols-[auto_1fr] gap-x-2"><b className="text-[#f7d678]">{item.part}</b><span className="text-white/85">{item.detail}</span></div>)}</div>}
    {hovered.entry.grammar && <p className="mt-2 text-xs leading-relaxed text-white/80">{hovered.entry.grammar}</p>}
  </aside>;
}
