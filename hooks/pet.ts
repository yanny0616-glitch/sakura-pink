// 输入框上方的小宠物：原创的像素团子兔。
// 空闲时：慢慢呼吸、偶尔眨眼；干活时：一蹦一蹦，头顶飘出小樱花瓣。
// 同样守桌面版的 SVG 白名单（只用 translate、opacity，keyframes，无 shape-rendering）。

const PX = 3 // 一个像素格 3px，16 × 16 格
const BODY = [
  '...oo......oo...',
  '..owpo....opwo..',
  '..owpo....opwo..',
  '..owpo....opwo..',
  '...owoooooowo...',
  '..owwwwwwwwwwo..',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwewwwwwwewwo.',
  '.obbwwwmmwwwbbo.',
  '.owwwwwwwwwwwwo.',
  '.oswwwwwwwwwwso.',
  '..osswwwwwwsso..',
  '...oooooooooo...',
]
const COLORS: Record<string, string> = {
  o: '#c9849a',
  w: '#fffafa',
  p: '#f9c9d3',
  s: '#fde6ea',
  e: '#3b2a2e',
  b: '#f4acbc',
  m: '#c9849a',
}

const rects = (cells: [number, number, string][]) =>
  cells.map(([x, y, c]) => `<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}" fill="${c}"/>`).join('')

const bodyCells: [number, number, string][] = []

BODY.forEach((line, y) => {
  ;[...line].forEach((c, x) => {
    const color = COLORS[c]

    if (color !== undefined) {
      bodyCells.push([x, y, color])
    }
  })
})
// 眼睛上面一格：眨眼时把它藏起来，只剩下面一格，看起来就是闭眼的一条线
const lids: [number, number, string][] = [
  [4, 7, '#3b2a2e'],
  [11, 7, '#3b2a2e'],
]
// 头上的小樱花
const flower: [number, number, string][] = [
  [12, 4, '#e98fa6'],
  [14, 4, '#e98fa6'],
  [13, 3, '#e98fa6'],
  [13, 5, '#e98fa6'],
  [13, 4, '#f3c96b'],
]
const shadow = `<rect x="${4 * PX}" y="${14.5 * PX}" width="${8 * PX}" height="${PX}" fill="#f4cfd7"/>`

const svg = (style: string, extra: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -9 48 57">` +
  `<style>${style}@media (prefers-reduced-motion: reduce){g{animation:none}}</style>` +
  shadow +
  `<g class="body">${rects(bodyCells)}<g class="lid">${rects(lids)}</g>${rects(flower)}</g>` +
  extra +
  `</svg>`

/** 空闲：慢慢呼吸，每 4 秒眨一次眼 */
export const PET_IDLE = svg(
  `.body{animation:breathe 3s ease-in-out infinite}` +
    `@keyframes breathe{0%{transform:translate(0px,0px)}50%{transform:translate(0px,1px)}100%{transform:translate(0px,0px)}}` +
    `.lid{animation:blink 4s linear infinite}` +
    `@keyframes blink{0%{opacity:1}90%{opacity:1}92%{opacity:0}96%{opacity:0}98%{opacity:1}100%{opacity:1}}`,
  '',
)

// 干活时头顶飘出的花瓣：三片错开时间往上飘、慢慢变淡
const PETALS: [number, number, number][] = [
  [8, 0, 0],
  [30, 0.4, 1],
  [40, 0.8, -1],
]

/** 干活：一蹦一蹦，头顶飘花瓣 */
export const PET_BUSY = svg(
  `.body{animation:hop 0.6s ease-in-out infinite}` +
    `@keyframes hop{0%{transform:translate(0px,0px)}50%{transform:translate(0px,-5px)}100%{transform:translate(0px,0px)}}` +
    PETALS.map(
      ([, delay, side], i) =>
        `.f${i}{animation:f${i} 1.2s linear -${delay}s infinite}` +
        `@keyframes f${i}{0%{transform:translate(0px,0px);opacity:1}100%{transform:translate(${side * 6}px,-12px);opacity:0}}`,
    ).join(''),
  PETALS.map(([x], i) => `<g class="f${i}"><rect x="${x}" y="0" width="3" height="3" fill="#f4acbc"/></g>`).join(''),
)
