import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// 첫 화면 이미지의 URL은 JS 번들 안에 있다 → 번들을 받아 파싱한 뒤에야 요청이 나가고,
// 저속 회선에서 그 직렬화가 그대로 지연으로 보인다. HTML head에 preload 힌트를 심어
// 브라우저가 JS와 **병렬로** 히어로 에셋을 받게 한다. 파일명은 빌드마다 해시가 바뀌므로
// 번들에서 실제 산출 파일명을 찾아 주입한다.
const HERO = ['title-bg', 'ui-button-full', 'logo-symbol']

function preloadHero(): Plugin {
  return {
    name: 'preload-hero-assets',
    enforce: 'post',
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        if (!ctx.bundle) return html // dev 서버에선 해시가 없어 불필요
        const tags = HERO.flatMap(name => {
          const file = Object.values(ctx.bundle!).find(
            f => f.type === 'asset' && typeof f.name === 'string' && f.name.startsWith(`${name}.`),
          )
          if (!file) return []
          return [
            {
              tag: 'link',
              attrs: { rel: 'preload', as: 'image', href: `./${file.fileName}`, fetchpriority: 'high' },
              injectTo: 'head' as const,
            },
          ]
        })
        return { html, tags }
      },
    },
  }
}

// base './' — GitHub Pages 프로젝트 경로에서도 링크 클릭만으로 실행되어야 함(제출 요건)
export default defineConfig({
  base: './',
  plugins: [react(), preloadHero()],
})
