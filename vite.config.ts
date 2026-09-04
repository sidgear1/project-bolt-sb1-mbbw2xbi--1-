import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { access, readdir, rm } from 'node:fs/promises';
import path from 'node:path';

async function removePngFilesWithWebpCopies(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removePngFilesWithWebpCopies(fullPath);
      return;
    }
    if (!entry.name.toLowerCase().endsWith('.png')) return;
    const webpPath = fullPath.replace(/\.png$/i, '.webp');
    try {
      await access(webpPath);
      await rm(fullPath);
    } catch {
      // Keep any PNG that does not have a generated web delivery copy.
    }
  }));
}

async function removeUnusedBuildMedia(directory: string): Promise<void> {
  const entries = await readdir(directory, { withFileTypes: true });
  await Promise.all(entries.map(async entry => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await removeUnusedBuildMedia(fullPath);
      return;
    }

    const relative = path.relative(path.resolve(process.cwd(), 'dist'), fullPath).replaceAll('\\', '/');
    const isWorldAiMedia = relative.startsWith('world-ai/') && /\.(?:mp3|mp4|m4a)$/i.test(relative);
    const isSupersededVideo = relative === 'videos/woodstock-roam.mp4' ||
      relative.endsWith('/masked man.mp4') ||
      (relative.endsWith('/woodstock-roam-web.mp4') && relative !== 'videos/woodstock-roam-web.mp4') ||
      (relative.endsWith('/masked-man-web.mp4') && relative !== 'scenes/masked-man/source/1 intro/masked-man-web.mp4');
    const isUnusedGardenVideo = relative === 'audio/garden-scene-ambience.mp4';
    if (isWorldAiMedia || isSupersededVideo || isUnusedGardenVideo) await rm(fullPath);
  }));
}

// https://vitejs.dev/config/
export default defineConfig({
  // Relative build URLs keep the app working when it is uploaded to a folder
  // instead of being hosted at the domain root.
  base: './',
  plugins: [
    react(),
    {
      name: 'prune-optimized-png-copies',
      apply: 'build',
      async closeBundle() {
        const outputDirectory = path.resolve(process.cwd(), 'dist');
        await removePngFilesWithWebpCopies(outputDirectory);
        await removeUnusedBuildMedia(outputDirectory);
      },
    },
  ],
  // Bind explicitly so local development and embedded preview hosts can both
  // reach the Vite server instead of it being limited to a loopback interface.
  server: {
    host: '0.0.0.0',
  },
  preview: {
    host: '0.0.0.0',
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
