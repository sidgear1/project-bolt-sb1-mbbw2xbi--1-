import { readFile, mkdir, writeFile } from "node:fs/promises";

const env = await readFile(new URL("../.env.local", import.meta.url), "utf8");
const apiKeys = [...env.matchAll(/^VITE_ELEVENLABS_API_KEY(?:_\d+)?=(.+)$/gm)]
  .map((match) => match[1].trim())
  .filter(Boolean);

if (!apiKeys.length) throw new Error("No ElevenLabs API key was found in .env.local");

let response;
for (const apiKey of apiKeys) {
  response = await fetch("https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128", {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "audio/mpeg",
    },
    body: JSON.stringify({
      text: "A warm small Italian village market ambience heard from just inside a gelato shop: gentle distant crowd murmur and occasional soft laughter, faint footsteps on stone, a light shop bell and birds far away. Friendly, populated and bustling but calm. No foreground voices, no intelligible words, no music, no traffic, no sudden sounds.",
      duration_seconds: 28,
      loop: true,
      prompt_influence: 0.5,
      model_id: "eleven_text_to_sound_v2",
    }),
  });
  if (response.ok) break;
}

if (!response?.ok) throw new Error(`ElevenLabs sound generation failed (${response?.status}): ${await response?.text()}`);

const output = new URL("../public/audio/ice-cream-shop-market-ambience.mp3", import.meta.url);
await mkdir(new URL("../public/audio/", import.meta.url), { recursive: true });
await writeFile(output, Buffer.from(await response.arrayBuffer()));
console.log(`Created ${output.pathname}`);
