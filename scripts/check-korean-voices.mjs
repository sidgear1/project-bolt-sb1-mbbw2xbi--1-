import { access, readFile } from 'node:fs/promises';

const lines = JSON.parse(await readFile(new URL('../korean-voice-lines.json', import.meta.url), 'utf8'));
function id(text, voice) {
  let hash = 2166136261;
  const characterVoice = ['bella', 'josh', 'shopkeeper', 'busWoman', 'wife'].includes(voice);
  const key = characterVoice ? `ko:${voice}:${text}` : `ko:${text}`;
  for (const char of key) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); }
  return `line-ko-${(hash >>> 0).toString(36)}.mp3`;
}
const missing = [];
for (const line of lines) {
  const filename = id(line.text, line.voice);
  try { await access(new URL(`../public/audio/voices/${filename}`, import.meta.url)); }
  catch { missing.push({ ...line, filename }); }
}
console.log(JSON.stringify({ total: lines.length, present: lines.length - missing.length, missing }, null, 2));
