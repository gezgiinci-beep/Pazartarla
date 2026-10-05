import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { releaseMetadataPlugin } from './build/releaseMetadata.mjs'

export default defineConfig({
  plugins: [react(), releaseMetadataPlugin()],
  server: {
    allowedHosts: true,
    headers: { 'Cache-Control': 'no-store' }
  },
  preview: {
    headers: { 'Cache-Control': 'no-store' }
  }
})
