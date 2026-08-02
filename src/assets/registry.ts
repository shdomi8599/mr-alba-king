// 에셋 레지스트리 — 지금은 SVG 대역(색 도형). P2에서 manifest 연동, P4에서 승인 PNG가 같은 id로 드롭인.
// 배경은 색으로, 오브젝트는 도형+색으로 대역 처리. 실제 에셋 교체 시 이 파일만 바뀐다.

export const BG: Record<string, string> = {
  'sushi-bg': '#31556b', // 일식집 — 짙은 청록
  'gimbap-bg': '#8a5a30', // 분식집 — 따뜻한 우드
  'cvs-bg': '#2e6b4f', // 편의점 — 그린
  'cafe-bg': '#6b4a31', // 카페 — 웜 브라운
  'chicken-bg': '#6b332e', // 치킨집 — 붉은 갈색
  'fish-bg': '#3a5570', // 붕어빵 노점 — 겨울 블루
  'bakery-bg': '#8a6a3f', // 빵집 — 버터 브라운
  'box-bg': '#55524c', // 물류창고 — 회갈색
  'wash-bg': '#41707f', // 세차장 — 물색
  'song-bg': '#4a3a6b', // 노래방 — 퍼플
}

export type Placeholder = { fill: string; stroke: string; shape: 'rect' | 'ellipse' }

export const PLACEHOLDER: Record<string, Placeholder> = {
  'sushi-rice': { fill: '#f2ecdd', stroke: '#c9bfa5', shape: 'ellipse' },
  'sushi-tuna': { fill: '#e5484d', stroke: '#a53236', shape: 'rect' },
  'sushi-salmon': { fill: '#f08a5e', stroke: '#b85f38', shape: 'rect' },
  'sushi-egg': { fill: '#f5d24a', stroke: '#c9a52f', shape: 'rect' },
  'sushi-plate': { fill: '#3b3b46', stroke: '#23232b', shape: 'ellipse' },
  'gimbap-base': { fill: '#2a2a2a', stroke: '#111111', shape: 'rect' },
  'gimbap-ham': { fill: '#e88a9a', stroke: '#b25e6e', shape: 'rect' },
  'gimbap-egg': { fill: '#f5e07a', stroke: '#c9b452', shape: 'rect' },
  'gimbap-pickle': { fill: '#f0b429', stroke: '#bd8a1b', shape: 'rect' },
  'gimbap-crab': { fill: '#e0653a', stroke: '#a84525', shape: 'rect' },
  'cvs-scanner': { fill: '#4a4a55', stroke: '#2b2b33', shape: 'rect' },
  'cvs-item-ramen': { fill: '#e07b39', stroke: '#a85423', shape: 'rect' },
  'cvs-item-drink': { fill: '#5a86e6', stroke: '#3a5eb0', shape: 'rect' },
  'cvs-item-snack': { fill: '#8ac98f', stroke: '#5e9a63', shape: 'rect' },
  'cvs-item-milk': { fill: '#f2f2f0', stroke: '#a9b8c4', shape: 'rect' },
  'cafe-cup': { fill: '#f2ece0', stroke: '#c5bba6', shape: 'rect' },
  'cafe-kettle': { fill: '#8a95a5', stroke: '#5f6875', shape: 'rect' },
  'chicken-pot': { fill: '#3a3a42', stroke: '#22222a', shape: 'rect' },
  'chicken-net': { fill: '#c9a25e', stroke: '#96753d', shape: 'rect' },
  'chicken-piece': { fill: '#d98f4a', stroke: '#a5662c', shape: 'ellipse' },
  'fish-mold': { fill: '#4a4a52', stroke: '#2d2d34', shape: 'rect' },
  'fish-bread': { fill: '#e0a55e', stroke: '#ab763a', shape: 'ellipse' },
  'bakery-tray': { fill: '#8a5f36', stroke: '#5f3f20', shape: 'rect' },
  'bakery-bread-cream': { fill: '#f5e0a5', stroke: '#c4ae70', shape: 'ellipse' },
  'bakery-bread-red': { fill: '#9a6a48', stroke: '#6e4830', shape: 'ellipse' },
  'bakery-bread-salt': { fill: '#e8dcc0', stroke: '#b5a883', shape: 'rect' },
  'bakery-bread-choco': { fill: '#6b4a3a', stroke: '#472e22', shape: 'ellipse' },
  'box-parcel': { fill: '#c9975a', stroke: '#96693a', shape: 'rect' },
  'box-truck': { fill: '#7a8593', stroke: '#525a66', shape: 'rect' },
  'wash-car': { fill: '#5a86e6', stroke: '#3a5eb0', shape: 'rect' },
  'song-tambourine': { fill: '#f0b429', stroke: '#bd8a1b', shape: 'ellipse' },
  'song-mic': { fill: '#4a4a55', stroke: '#2b2b33', shape: 'rect' },
}
