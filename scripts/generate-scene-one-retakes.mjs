import { mkdir, readFile, writeFile } from 'node:fs/promises';

const env = await readFile(new URL('../.env.local', import.meta.url), 'utf8');
const apiKeys = [...env.matchAll(/^VITE_ELEVENLABS_API_KEY(?:_\d+)?=(.+)$/gm)]
  .map(match => match[1].trim())
  .filter(Boolean);
if (!apiKeys.length) throw new Error('An ElevenLabs API key is required.');

const jobs = [
  {
    output: 'line-ko-1fwzy80-scene-one-v2.mp3',
    voice: 'IKne3meq5aSn9XLyUdCD',
    text: '[concerned] Bella?',
  },
  {
    output: 'line-en-u0azch-scene-one-v2.mp3',
    voice: 'cgSgspJ2msm6clMCkdW9',
    text: '[crying softly] Waaah...',
  },
];

const outputDirectory = new URL('../public/audio/voices/', import.meta.url);
await mkdir(outputDirectory, { recursive: true });

for (const job of jobs) {
  let response;
  for (const apiKey of apiKeys) {
    response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${job.voice}`, {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text: job.text,
        model_id: 'eleven_v3',
        voice_settings: { stability: 0.3, similarity_boost: 0.8, style: 0.45, use_speaker_boost: true },
      }),
    });
    if (response.ok) break;
  }
  if (!response?.ok) throw new Error(`ElevenLabs failed for ${job.output}: ${response?.status ?? 'no response'}`);
  await writeFile(new URL(job.output, outputDirectory), Buffer.from(await response.arrayBuffer()));
  console.log(`Generated natural retake: ${job.output}`);
}
