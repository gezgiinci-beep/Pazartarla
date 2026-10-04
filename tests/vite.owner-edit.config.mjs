// Browser verification only: application can contact ONLY this synthetic host.
// No real credentials/project configuration is loaded into this test build.
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins:[react()],
  define:{
    'import.meta.env.VITE_SUPABASE_URL':JSON.stringify('https://editor-test.supabase.co'),
    'import.meta.env.VITE_SUPABASE_ANON_KEY':JSON.stringify('synthetic-public-test-key'),
  },
  server:{host:'0.0.0.0',port:3001,strictPort:true,allowedHosts:true},
});