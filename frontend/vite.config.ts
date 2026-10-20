import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Сайт по одной ссылке (scripts/share.sh, туннель): запросы /api и /media сайт передаёт на API сам.
// xfwd — передать API настоящий IP посетителя (для лимитов на вход)
const api = process.env.BANDUP_API ?? 'http://127.0.0.1:8001'
const proxy = {
  '/api': { target: api, xfwd: true },
  '/media': { target: api, xfwd: true },
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: { proxy },
  preview: { proxy, allowedHosts: ['.trycloudflare.com'] },
})
