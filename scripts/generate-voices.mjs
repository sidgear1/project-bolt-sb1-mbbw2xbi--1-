import { readFile, mkdir, writeFile, access, readdir } from 'node:fs/promises';

const root = new URL('..', import.meta.url);
const lines = JSON.parse(await readFile(new URL('../voice-lines.json', import.meta.url), 'utf8'));
const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const apiKeys = [...env.matchAll(/^VITE_ELEVENLABS_API_KEY(?:_\d+)?=(.+)$/gm)].map(match => match[1].trim()).filter(Boolean);
if (!apiKeys.length) throw new Error('At least one VITE_ELEVENLABS_API_KEY entry is required in .env.local');

const voiceIds = { male: 'JBFqnCBsd6RMkjVDRZzb', female: 'EXAVITQu4vr4xnSDxMaL', character: 'VR6AewLTigWG4xSOukaG', bella: 'pFZP5JQG7iQjIQuC4Bku', josh: 'TxGEqnHWrfWFTfGW9XjX', shopkeeper: 'EXAVITQu4vr4xnSDxMaL', busWoman: '21m00Tcm4TlvDq8ikWAM', wife: 'AZnzlk1XvdvUeBnXmlld', adventure: 'JBFqnCBsd6RMkjVDRZzb' };
async function sourceFiles(directory) { const items = await readdir(directory, { withFileTypes: true }); const nested = await Promise.all(items.map(item => item.isDirectory() ? sourceFiles(new URL(`${item.name}/`, directory)) : item.name.endsWith('.tsx') || item.name.endsWith('.ts') ? [new URL(item.name, directory)] : [])); return nested.flat(); }
const directLines = [];
for (const file of await sourceFiles(new URL('../src/', import.meta.url))) {
  const source = await readFile(file, 'utf8');
  for (const match of source.matchAll(/speak\(\s*(['"])(.*?)\1\s*,\s*(['"])(male|female|character|bella|josh|shopkeeper|busWoman|wife|adventure)\3/g)) directLines.push({ text: match[2], voice: 'male', language: /[\u3400-\u9fff]/.test(match[2]) ? 'zh' : 'en' });
  // Dialogue data is commonly stored in scene objects before the scene calls
  // speak(). Include those authored values as well as literal speak() calls.
  for (const match of source.matchAll(/(?:spoken|textZh|narrative|speakText|dialogue|prompt|responseIt|englishLabel|italian)\s*:\s*(['"])(.*?)\1/g)) directLines.push({ text: match[2], voice: 'male', language: /[\u3400-\u9fff]/.test(match[2]) ? 'zh' : 'en' });
  // Bella's authored scene lines need their own little-girl MP3 rather than
  // sharing the narrator filename for identical text.
  for (const match of source.matchAll(/speaker:\s*'Bella'[\s\S]{0,260}?spoken:\s*'([^']+)'/g)) directLines.push({ text: match[1], voice: 'bella', language: /[\u3400-\u9fff]/.test(match[1]) ? 'zh' : 'en' });
  for (const match of source.matchAll(/speaker:\s*'Bella'[\s\S]{0,260}?textZh:\s*'([^']+)'/g)) directLines.push({ text: match[1], voice: 'bella', language: 'zh' });
  // A few compact scenes keep their narration in ALL_CAPS arrays/objects.
  // Extract their quoted entries so a reference such as HOME_LINES[step]
  // resolves to a downloaded MP3 too.
  for (const block of source.matchAll(/const\s+[A-Z][A-Z0-9_]*\s*=\s*(?:\[[\s\S]*?\]|\{[\s\S]*?\});/g)) {
    for (const entry of block[0].matchAll(/(['"])(.*?)\1/g)) {
      const text = entry[2];
      if (/[A-Za-z\u3400-\u9fff]/.test(text)) directLines.push({ text, voice: 'male', language: /[\u3400-\u9fff]/.test(text) ? 'zh' : 'en' });
    }
  }
}
for (const line of directLines) if (!lines.some(existing => existing.text === line.text && existing.voice === line.voice && existing.language === line.language)) lines.push(line);
for (const line of [
  { text: 'Delicious!', voice: 'bella', language: 'en' },
  { text: 'Thank you!', voice: 'bella', language: 'en' },
  { text: 'Thank you', voice: 'bella', language: 'en' },
  { text: 'You are welcome!', voice: 'shopkeeper', language: 'en' },
  { text: 'You are welcome', voice: 'shopkeeper', language: 'en' },
  { text: 'Okay!', voice: 'bella', language: 'en' },
  { text: 'I am unhappy', voice: 'bella', language: 'en' },
]) if (!lines.some(existing => existing.text === line.text && existing.voice === line.voice && existing.language === line.language)) lines.push(line);
function id(text, voice, language) { let hash = 2166136261; const fileKey = voice === 'bella' ? `${language}:bella:${text}` : `${language}:${text}`; for (const char of fileKey) { hash ^= char.charCodeAt(0); hash = Math.imul(hash, 16777619); } return `line-${language}-${(hash >>> 0).toString(36)}`; }
const out = new URL('../public/audio/voices/', import.meta.url);
await mkdir(out, { recursive: true });
for (const line of lines) {
  const file = new URL(`${id(line.text, line.voice, line.language)}.mp3`, out);
  try { await access(file); console.log(`Exists: ${file.pathname.split('/').pop()}`); continue; } catch { /* generate once */ }
  const voice = line.language === 'zh' ? 'Xb7hH8MSUJpSbSDYk0k2' : voiceIds[line.voice];
  let response;
  for (const apiKey of apiKeys) {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, { method: 'POST', headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' }, body: JSON.stringify({ text: line.text, model_id: 'eleven_multilingual_v2' }) });
    if (response.ok) break;
  }
  if (!response.ok) {
    console.log(`Skipped (ElevenLabs ${response.status}): ${file.pathname.split('/').pop()}`);
    continue;
  }
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`Generated with ElevenLabs: ${file.pathname.split('/').pop()}`);
}
