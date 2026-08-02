// 에셋 레지스트리 — 지금은 SVG 대역(색 도형). P2에서 manifest 연동, P4에서 승인 PNG가 같은 id로 드롭인.
// 배경은 색으로, 오브젝트는 도형+색으로 대역 처리. 실제 에셋 교체 시 이 파일만 바뀐다.

export const BG: Record<string, string> = {
  'sushi-bg': '#31556b', // 일식집 — 짙은 청록
  'gimbap-bg': '#8a5a30', // 분식집 — 따뜻한 우드
  'cvs-bg': '#2e6b4f', // 편의점 — 그린
}

export type Placeholder = { fill: string; stroke: string; shape: 'rect' | 'ellipse' }

export const PLACEHOLDER: Record<string, Placeholder> = {
  'sushi-rice': { fill: '#f2ecdd', stroke: '#c9bfa5', shape: 'ellipse' },
  'sushi-tuna': { fill: '#e5484d', stroke: '#a53236', shape: 'rect' },
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
}
