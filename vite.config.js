import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base: './' — 어떤 정적 호스팅의 어떤 하위경로에 올려도 동작한다 (GitHub Pages /저장소명/ 포함)
export default defineConfig({ base: './', plugins: [react()], server: { port: 5199, host: true } })
