import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// The gallery ships as ONE self-contained HTML file so it can be published to
// Stacktree (or any static host) with a single request. Teaser images are
// inlined as data URIs; the full-resolution collection stays behind the box
// office's ticket gate. The box office URL comes from VITE_BOX_OFFICE_URL (see .env).
export default defineConfig({
  plugins: [react(), viteSingleFile()],
  base: './',
  build: {
    assetsInlineLimit: 100_000_000,
    cssCodeSplit: false,
    reportCompressedSize: false,
    target: 'es2022',
  },
})
