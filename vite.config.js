import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { browserConnection, requireBuildConnection } from './build/browserConnection.mjs'

export default defineConfig(({ command, mode }) => {
  const connection = browserConnection(process.env, loadEnv(mode, process.cwd(), 'VITE_'));
  if (command === 'build') requireBuildConnection(connection);
  return {
  plugins: [react()],
  define: {
    'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(connection.url),
    'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(connection.key),
  },
  server: {
    allowedHosts: true
  }
  };
})
