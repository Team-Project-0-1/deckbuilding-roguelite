import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/deckbuilding-roguelite/',
  plugins: [react()]
});
