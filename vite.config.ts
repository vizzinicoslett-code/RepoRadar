import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Relative assets work at both the domain root and /repository/ on Pages.
  base: './',
})
