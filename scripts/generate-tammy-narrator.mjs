import { readFile, mkdir, writeFile, access } from 'node:fs/promises';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const apiKeys = [...env.matchAll(/^VITE_ELEVENLABS_API_KEY(?:_\d+)?=(.+)$/gm)]
  .map(match => match[1].trim())
  .filter(Boolean);
if (!apiKeys.length) throw new Error('No ElevenLabs API key is configured.');

const voice = 'VR6AewLTigWG4xSOukaG'; // Arnold: deeper, serious storyteller.
const lines = [
  'New York.',
  'A concrete jungle with a concrete heart.',
  'A place where softness has no place, with only rough corners, rough edges, and rougher people.',
  'Here, you conquer or become conquered.',
  'In the heart of it lies Tammy the cat: lost, afraid, and unsure of what to make of this new world.',
  'Tammy makes her way towards the bins, looking for food.',
  'Tammy makes her way towards the bins, looking for shelter.',
  'Tammy edges closer to the bins, searching for a place to rest.',
  'A mouse appears—vicious and defensive of its space.',
  'Tammy tells him about the strange city and how far away home feels.',
  'The big cat listens without interrupting.',
  '“You should not be alone out here,” he says. “Follow me.”',
  'Tammy takes a careful step after him.',
  'Together they leave the noisy street behind.',
  'The big cat knows every turn, every quiet corner, and every safe path.',
  '“Stay close,” he says. Tammy follows his warm, steady footsteps.',
  'At last, they reach a hidden place away from the city rush.',
  'This is the big cat’s lair—his home.',
  'It is safe, quiet, and warmer than Tammy expected.',
  '“You can rest here,” the big cat says. “We will help you find your way.”',
  'For the first time since she was lost, Tammy feels a little less afraid.',
  'She looks around the lair and begins to believe she is not alone.',
  'The big cat has given Tammy more than shelter: he has given her hope.',
  'Tonight, Tammy has a safe home to rest in.',
  'Tomorrow, her journey home will begin.',
  'It looks like some kind of delivery box. Someone must have put Tammy in there before taking her away. She worries about how worried her mother must be.',
  'The alleyway is cold and wet. There is no forgiveness in this concrete pavement.',
  'Tammy looks up to see if anyone is looking down at her. There is no one there, but it still feels like the world is looking down at her.',
];

function fileId(text) {
  let hash = 2166136261;
  for (const char of `en:tammyNarrator:${text}`) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `line-en-${(hash >>> 0).toString(36)}`;
}

const output = new URL('../public/audio/voices/', import.meta.url);
await mkdir(output, { recursive: true });

for (const text of [...new Set(lines)]) {
  const file = new URL(`${fileId(text)}.mp3`, output);
  try {
    await access(file);
    console.log(`Exists: ${file.pathname.split('/').pop()}`);
    continue;
  } catch { /* generate it */ }

  let response;
  for (const apiKey of apiKeys) {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.62, similarity_boost: 0.82, style: 0.18, use_speaker_boost: true },
      }),
    });
    if (response.ok) break;
  }
  if (!response?.ok) {
    console.log(`Skipped (${response?.status ?? 'network error'}): ${file.pathname.split('/').pop()}`);
    continue;
  }
  await writeFile(file, Buffer.from(await response.arrayBuffer()));
  console.log(`Generated: ${file.pathname.split('/').pop()}`);
}
