import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' — GitHub Pages 프로젝트 경로에서도 링크 클릭만으로 실행되어야 함(제출 요건)
export default defineConfig({
  base: './',
  plugins: [react()],
})
