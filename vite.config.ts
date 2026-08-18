import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  // Relative build URLs keep the app working when it is uploaded to a folder
  // instead of being hosted at the domain root.
  base: './',
  plugins: [react()],
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
