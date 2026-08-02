// 게임 내 모든 카피는 pipeline/texts.json 단일 소스에서 온다 (스튜디오 ✏️ 텍스트 탭에서 검수).
import data from '../../pipeline/texts.json'

const map: Record<string, string> = {}
for (const c of data.categories) for (const e of c.entries) map[e.id] = e.ko

export const T = (id: string): string => map[id] ?? id
