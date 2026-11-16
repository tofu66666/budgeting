import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const port = Number(process.env.PORT || 5173);
const allowedHosts = [
  'budgeting-git-main-ai-gateway3.vercel.app',
  'budgeting-one-pi.vercel.app',
];

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port,
    allowedHosts,
  },
  preview: {
    host: '0.0.0.0',
    port,
    allowedHosts,
  },
});
