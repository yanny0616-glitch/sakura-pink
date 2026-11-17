// 输入框上方的小宠物：原创的像素团子兔，按 Claude 和你的状态换表情和动作。
// 同样守桌面版的 SVG 白名单（只用 translate、opacity、keyframes，无 shape-rendering）。

export type Mood =
  | 'idle' // 发呆：呼吸、眨眼
  | 'busy' // 干活：蹦跳、头顶飘花瓣
  | 'read' // 读文件：捧着书
  | 'run' // 跑命令：敲键盘
  | 'edit' // 改代码：拿画笔
  | 'search' // 搜索：拿放大镜
  | 'happy' // 一轮顺利结束：笑眼、闪光
  | 'sad' // 被打断或出错：耳朵耷拉、掉眼泪
  | 'typing' // 你在打字：看向输入框、头上冒感叹号
  | 'sleep' // 很久没动：闭眼睡觉、冒 z
  | 'yawn' // 深夜：打哈欠

/** 工具名 → 动作 */
export type ToolMood = 'read' | 'run' | 'edit' | 'search' | 'busy'

export const moodOfTool = (tool: string): ToolMood => {
  if (/^(Read|NotebookRead)$/.test(tool)) {
    return 'read'
  }
  if (/^(Bash|PowerShell|Monitor)$/.test(tool)) {
    return 'run'
  }
  if (/^(Edit|Write|MultiEdit|NotebookEdit)$/.test(tool)) {
    return 'edit'
  }
  if (/^(Grep|Glob|WebSearch|WebFetch|LSP|ToolSearch)$/.test(tool)) {
    return 'search'
  }

  return 'busy'
}

const PX = 3 // 一个像素格 3px，身体 16 × 14 格
type Cell = [number, number, string]

const INK = '#3b2a2e'
const LINE = '#c9849a'
const COLORS: Record<string, string> = { o: LINE, w: '#fffafa', p: '#f9c9d3', s: '#fde6ea', b: '#f4acbc', m: LINE }

const EARS_UP = ['...oo......oo...', '..owpo....opwo..', '..owpo....opwo..', '..owpo....opwo..']
const EARS_DOWN = ['................', '................', '...oo......oo...', '..owpo....opwo..']
const FACE = [
  '...owoooooowo...',
  '..owwwwwwwwwwo..',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.owwwwwwwwwwwwo.',
  '.obbwwwmmwwwbbo.',
  '.owwwwwwwwwwwwo.',
  '.oswwwwwwwwwwso.',
  '..osswwwwwwsso..',
  '...oooooooooo...',
]

const cellsOf = (lines: string[], colors: Record<string, string>, dx = 0, dy = 0): Cell[] => {
  const out: Cell[] = []

  lines.forEach((line, y) => {
    ;[...line].forEach((c, x) => {
      const color = colors[c]

      if (color !== undefined) {
        out.push([x + dx, y + dy, color])
      }
    })
  })

  return out
}

const rects = (cells: Cell[]) =>
  cells.map(([x, y, c]) => `<rect x="${x * PX}" y="${y * PX}" width="${PX}" height="${PX}" fill="${c}"/>`).join('')

// 眼睛的几种样子（格坐标）
const EYES = {
  open: [[4, 7], [4, 8], [11, 7], [11, 8]],
  down: [[4, 8], [4, 9], [11, 8], [11, 9]],
  closed: [[3, 8], [4, 8], [5, 8], [10, 8], [11, 8], [12, 8]],
  happy: [[3, 8], [4, 7], [5, 8], [10, 8], [11, 7], [12, 8]],
} as const
const eyes = (kind: keyof typeof EYES): Cell[] => EYES[kind].map(([x, y]) => [x, y, INK])
// 头上的小樱花
const FLOWER: Cell[] = [
  [12, 4, '#e98fa6'],
  [14, 4, '#e98fa6'],
  [13, 3, '#e98fa6'],
  [13, 5, '#e98fa6'],
  [13, 4, '#f3c96b'],
]

// ---- 道具 ----
const BOOK = cellsOf(['cccccccc', 'cppccppc', 'cppccppc', 'cccccccc'], { c: '#b07a5a', p: '#fffaf0' }, 4, 10)
const BOOK_LINE = cellsOf(['.l....l.'], { l: '#d8c7b8' }, 4, 11)
const KEYBOARD = cellsOf(['kkkkkkkkkkkk', 'kkkkkkkkkkkk'], { k: '#e3cfd5' }, 2, 13)
const KEYS_A = cellsOf(['.d.d.d.d.d.d'], { d: '#b996a3' }, 2, 13)
const KEYS_B = cellsOf(['d.d.d.d.d.d.'], { d: '#b996a3' }, 2, 13)
const BRUSH = cellsOf(['...t', '..tt', '.h..', 'h...'], { h: '#b07a5a', t: '#e98fa6' }, 12, 8)
const PAINT = cellsOf(['pp.p'], { p: '#f4acbc' }, 11, 13)
const LENS = cellsOf(['.rrr', 'rgr.', 'rrr.', '...h'].map(l => l), { r: '#8a6f78', g: '#dff0ff', h: '#8a6f78' }, 12, 9)
const SPARKS: Cell[] = [
  [0, 3, '#f3c96b'],
  [15, 1, '#f3c96b'],
  [1, 12, '#f3c96b'],
  [15, 10, '#f3c96b'],
]
const TEAR: Cell[] = [[5, 10, '#9cc8e8']]
const BANG = cellsOf(['b', 'b', 'b', '.', 'b'], { b: '#d0506e' }, 14, -3)
const ZED = cellsOf(['zzz', '.z.', 'zzz'], { z: '#c9a7b4' }, 0, 0)
const YAWN: Cell[] = [
  [7, 9, '#8a4a5a'],
  [8, 9, '#8a4a5a'],
  [7, 10, '#8a4a5a'],
  [8, 10, '#8a4a5a'],
]

const shadow = `<rect x="${4 * PX}" y="${14.5 * PX}" width="${8 * PX}" height="${PX}" fill="#f4cfd7"/>`
const KEYS = `@keyframes breathe{0%{transform:translate(0px,0px)}50%{transform:translate(0px,1px)}100%{transform:translate(0px,0px)}}`
const HOP = `@keyframes hop{0%{transform:translate(0px,0px)}50%{transform:translate(0px,-5px)}100%{transform:translate(0px,0px)}}`
const BLINK = `@keyframes blink{0%{opacity:1}90%{opacity:1}92%{opacity:0}96%{opacity:0}98%{opacity:1}100%{opacity:1}}`
const FLASH = `@keyframes flash{0%{opacity:1}50%{opacity:0}100%{opacity:1}}`

type Parts = {
  ears?: string[]
  eyes: Cell[]
  /** 眼睛上面那一格单独成组，发呆时用来眨眼 */
  lids?: Cell[]
  extra?: Cell[]
  /** 身体组的动画 */
  body: string
  /** 身体外面的东西（不跟着身体动） */
  outside?: string
  style?: string
}

const svg = (p: Parts) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -9 48 57">` +
  `<style>${KEYS}${HOP}${BLINK}${FLASH}.body{animation:${p.body}}.lid{animation:blink 4s linear infinite}${p.style ?? ''}` +
  `@media (prefers-reduced-motion: reduce){g{animation:none}}</style>` +
  shadow +
  `<g class="body">${rects(cellsOf([...(p.ears ?? EARS_UP), ...FACE], COLORS))}${rects(p.eyes)}` +
  (p.lids === undefined ? '' : `<g class="lid">${rects(p.lids)}</g>`) +
  `${rects(FLOWER)}${rects(p.extra ?? [])}</g>` +
  (p.outside ?? '') +
  `</svg>`

// 头顶飘的花瓣、冒的 z：一组错开时间往上飘、慢慢变淡的小东西
const rising = (name: string, items: [number, number, string][], seconds: number) =>
  ({
    style: items
      .map(
        (_, i) =>
          `.${name}${i}{animation:${name}${i} ${seconds}s linear -${((seconds * i) / items.length).toFixed(2)}s infinite}` +
          `@keyframes ${name}${i}{0%{transform:translate(0px,0px);opacity:1}100%{transform:translate(${i % 2 === 0 ? 6 : -6}px,-12px);opacity:0}}`,
      )
      .join(''),
    outside: items.map(([x, y, body], i) => `<g class="${name}${i}" transform="translate(${x} ${y})">${body}</g>`).join(''),
  })

const petal = `<rect width="3" height="3" fill="#f4acbc"/>`
const busyPetals = rising('f', [[8, 0, petal], [30, 0, petal], [40, 0, petal]], 1.2)
const zs = rising('z', [[36, -3, rects(ZED).replace(/width="3" height="3"/g, 'width="2" height="2"')], [40, -6, rects(ZED)]], 3)

const SPRITES: Record<Mood, string> = {
  idle: svg({ eyes: eyes('down').filter(([, y]) => y === 8), lids: eyes('open').filter(([, y]) => y === 7), body: 'breathe 3s ease-in-out infinite' }),
  busy: svg({ eyes: eyes('open'), body: 'hop 0.6s ease-in-out infinite', ...busyPetals }),
  read: svg({
    eyes: eyes('down'),
    extra: [...BOOK, ...BOOK_LINE],
    body: 'breathe 2s ease-in-out infinite',
  }),
  run: svg({
    eyes: eyes('down'),
    extra: KEYBOARD,
    body: 'breathe 0.3s linear infinite',
    style: `.ka{animation:flash 0.4s steps(1) infinite}.kb{animation:flash 0.4s steps(1) -0.2s infinite}`,
    outside: `<g class="ka">${rects(KEYS_A)}</g><g class="kb">${rects(KEYS_B)}</g>`,
  }),
  edit: svg({
    eyes: eyes('open'),
    body: 'breathe 1s ease-in-out infinite',
    style:
      `.br{animation:br 0.5s ease-in-out infinite}@keyframes br{0%{transform:translate(0px,0px)}50%{transform:translate(-3px,2px)}100%{transform:translate(0px,0px)}}` +
      `.pt{animation:flash 1s steps(1) infinite}`,
    outside: `<g class="br">${rects(BRUSH)}</g><g class="pt">${rects(PAINT)}</g>`,
  }),
  search: svg({
    eyes: eyes('open'),
    body: 'breathe 1.5s ease-in-out infinite',
    style: `.ln{animation:ln 1.6s ease-in-out infinite}@keyframes ln{0%{transform:translate(0px,0px)}50%{transform:translate(-9px,-3px)}100%{transform:translate(0px,0px)}}`,
    outside: `<g class="ln">${rects(LENS)}</g>`,
  }),
  happy: svg({
    eyes: eyes('happy'),
    body: 'hop 0.5s ease-in-out infinite',
    style: SPARKS.map((_, i) => `.s${i}{animation:flash 0.8s steps(1) -${(i * 0.2).toFixed(1)}s infinite}`).join(''),
    outside: SPARKS.map((c, i) => `<g class="s${i}">${rects([c])}</g>`).join(''),
  }),
  sad: svg({
    ears: EARS_DOWN,
    eyes: eyes('open'),
    body: 'breathe 3s ease-in-out infinite',
    style: `.te{animation:te 1.4s linear infinite}@keyframes te{0%{transform:translate(0px,0px);opacity:1}100%{transform:translate(0px,9px);opacity:0}}`,
    outside: `<g class="te">${rects(TEAR)}</g>`,
  }),
  typing: svg({
    eyes: eyes('down'),
    body: 'hop 1.2s ease-in-out infinite',
    style: `.bg{animation:flash 0.8s steps(1) infinite}`,
    outside: `<g class="bg">${rects(BANG)}</g>`,
  }),
  sleep: svg({
    eyes: eyes('closed'),
    body: 'breathe 4s ease-in-out infinite',
    ...zs,
  }),
  yawn: svg({
    eyes: eyes('closed'),
    body: 'breathe 3s ease-in-out infinite',
    style: `.yw{animation:yw 3s steps(1) infinite}@keyframes yw{0%{opacity:0}40%{opacity:1}80%{opacity:0}100%{opacity:0}}`,
    outside: `<g class="yw">${rects(YAWN)}</g>`,
  }),
}

export const petSvg = (mood: Mood): string => SPRITES[mood]

export const MOOD_TEXT: Record<Mood, string> = {
  idle: '团子兔在发呆',
  busy: '团子兔一蹦一蹦地干活',
  read: '团子兔捧着书在读',
  run: '团子兔在敲键盘',
  edit: '团子兔拿着画笔在改',
  search: '团子兔拿着放大镜在找',
  happy: '团子兔开心地转圈',
  sad: '团子兔耳朵耷拉下来了',
  typing: '团子兔看着你打字',
  sleep: '团子兔睡着了',
  yawn: '团子兔在打哈欠',
}

// ---- 子代理小兔子 ----
const BUDDY = cellsOf(
  ['.oo..oo.', '.op..po.', '.oooooo.', 'owwwwwwo', 'owewwewo', 'owbwwbwo', 'owwwwwwo', '.oooooo.'],
  { o: LINE, p: '#f9c9d3', w: '#fffafa', e: INK, b: '#f4acbc' },
)
const buddies = new Map<number, string>()

/** n 只一起干活的小兔子（最多画 4 只），每只错开一点一蹦一蹦 */
export const buddySvg = (n: number): string => {
  const count = Math.min(4, Math.max(1, n))
  const cached = buddies.get(count)

  if (cached !== undefined) {
    return cached
  }
  const out =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -6 ${count * 28} 32">` +
    `<style>${HOP}` +
    range(count).map(i => `.u${i}{animation:hop 0.5s ease-in-out -${(i * 0.15).toFixed(2)}s infinite}`).join('') +
    `@media (prefers-reduced-motion: reduce){g{animation:none}}</style>` +
    range(count).map(i => `<g transform="translate(${i * 28} 0)"><g class="u${i}">${rects(BUDDY)}</g></g>`).join('') +
    `</svg>`

  buddies.set(count, out)

  return out
}

function range(n: number): number[] {
  return [...Array(n).keys()]
}
