import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(() => {
  return {
    plugins: [react()],
    // Accept both Vite-style and Next.js-style names for the Supabase keys.
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    build: {
      rollupOptions: {
        output: {
          // Libraries change rarely, so they get their own files that phones keep cached across app updates.
          manualChunks: { react: ['react', 'react-dom'], supabase: ['@supabase/supabase-js'] },
        },
      },
    },
  };
});
