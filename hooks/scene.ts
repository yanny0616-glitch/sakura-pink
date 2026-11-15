// 像素风动态背景：#fff1f1 底色、右侧一棵像素樱花树、方块花瓣逐格飘落、像素云慢慢飘过。
// 动画写在 SVG 自己的 <style> 里（CSS keyframes + steps），由 App 播放。
//
// 桌面版只在 SVG 通过它的白名单时才播放动画，否则整张图按静态画。写这里时必须守住：
//   - 不能出现 shape-rendering、vector-effect（属性名、属性值、样式里都不行）
//   - @media 只能用 prefers-reduced-motion / prefers-color-scheme
//   - 不能有反斜杠、data:、外部 url()，不能用 vw/vh 这类视口单位
//   - 必须是合法 XML，元素只用 svg/g/rect/path/style 这些基础图形
// 画布是 1:1 的，窗口比它宽时只裁上下，所以树始终贴着右边。

let seed = 11
const rand = () => {
  seed = (seed * 16807) % 2147483647

  return (seed - 1) / 2147483646
}

const SIZE = 1200 // 画布边长
const CELL = 8 // 一个像素格的边长
const GRID = SIZE / CELL // 每边多少格
// 三棵树：[树冠中心 x（格）, 树冠中心 y（格）, 大小]。右边一棵大的，它左边紧挨着一棵矮的（树冠在大树树冠下方，互不重叠），左边还有一棵中等的。
// 树冠都放在画布中间那一段高度里，宽窗口裁掉上下时也看得到。
const TREES: [number, number, number][] = [
  [GRID - 24, Math.round(GRID * 0.6), 1],
  [20, Math.round(GRID * 0.66), 0.72],
  [GRID - 37, Math.round(GRID * 0.76), 0.5],
]

type Cells = Map<string, string>

// 同一行相邻同色的格子合并成一段，同色的段合并成一条 path，体积小、画得快
const toPaths = (cells: Cells): string => {
  const rows = new Map<number, { x: number; color: string }[]>()

  for (const [key, color] of cells) {
    const [xs, ys] = key.split(',')
    const y = Number(ys)
    const row = rows.get(y) ?? []

    row.push({ x: Number(xs), color })
    rows.set(y, row)
  }

  const byColor = new Map<string, string[]>()

  for (const [y, row] of rows) {
    row.sort((a, b) => a.x - b.x)
    let start: { x: number; color: string } | undefined
    let length = 0

    const flush = () => {
      if (start !== undefined) {
        const runs = byColor.get(start.color) ?? []

        runs.push(`M${start.x * CELL} ${y * CELL}h${length * CELL}v${CELL}h-${length * CELL}z`)
        byColor.set(start.color, runs)
      }
    }

    for (const cell of row) {
      if (start !== undefined && cell.color === start.color && cell.x === start.x + length) {
        length++
      } else {
        flush()
        start = cell
        length = 1
      }
    }
    flush()
  }

  return [...byColor].map(([color, runs]) => `<path fill="${color}" d="${runs.join('')}"/>`).join('')
}

// ---- 樱花树 ----
const tree: Cells = new Map()
let originX = 0
let originY = 0
const put = (x: number, y: number, color: string) => {
  const gx = x + originX
  const gy = y + originY

  if (gx >= 0 && gx < GRID && gy >= 0 && gy < GRID) {
    tree.set(`${gx},${gy}`, color)
  }
}

const TRUNK_LIGHT = '#a8755f'
const TRUNK = '#8a5a4a'
const TRUNK_DARK = '#6d4438'
const BLOSSOM = ['#fde6ea', '#f9c9d3', '#f4acbc', '#e98fa6']

// 斜枝
const branch = (x0: number, y0: number, x1: number, y1: number) => {
  const steps = Math.max(1, Math.abs(x1 - x0), Math.abs(y1 - y0))

  for (let i = 0; i <= steps; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / steps)
    const y = Math.round(y0 + ((y1 - y0) * i) / steps)

    put(x, y, TRUNK)
    put(x + 1, y, TRUNK_DARK)
  }
}

// 树冠：几团圆形花簇，左上亮、右下暗，带一点随机噪点和镂空
const BLOBS: [number, number, number][] = [
  [0, 0, 11],
  [0, 6, 8],
  [-9, 3, 7],
  [9, 2, 8],
  [-4, -7, 7],
  [6, -8, 6],
  [-13, 7, 4],
  [14, 7, 4],
]

const drawTree = (cx: number, cy: number, scale: number) => {
  originX = cx
  originY = cy
  const k = (n: number) => Math.round(n * scale)
  const bottom = GRID - cy

  // 树干：一直伸到画布底部，越往下越粗
  for (let y = k(4); y < bottom; y++) {
    const half = Math.max(1, k(y > bottom - 4 ? 6 : y > bottom - 9 ? 5 : y > bottom - 18 ? 4 : 3))

    for (let x = -half; x < half; x++) {
      put(x, y, x === -half ? TRUNK_LIGHT : x >= half - 1 ? TRUNK_DARK : TRUNK)
    }
  }
  branch(k(-1), k(14), k(-10), k(4))
  branch(k(1), k(16), k(10), k(5))
  branch(0, k(8), k(-3), k(-4))

  for (const [bx0, by0, r0] of BLOBS) {
    const bx = k(bx0)
    const by = k(by0)
    const r = Math.max(2, k(r0))

    for (let y = by - r; y <= by + r; y++) {
      for (let x = bx - r; x <= bx + r; x++) {
        const dx = x - bx
        const dy = y - by

        if (dx * dx + dy * dy > r * r || rand() < 0.05) {
          continue
        }
        const v = (dx + dy) / (2 * r) + (rand() - 0.5) * 0.55
        const shade = v < -0.3 ? 0 : v < 0.05 ? 1 : v < 0.4 ? 2 : 3

        put(x, y, BLOSSOM[shade] ?? '#f9c9d3')
      }
    }
  }
}

// 先画远处的小树，再画近处的大树
for (const [cx, cy, scale] of [...TREES].sort((p, q) => p[2] - q[2])) {
  drawTree(cx, cy, scale)
}

// ---- 飘落的花瓣 ----
// 每片花瓣一个 <g>：transform 属性是它静态时停的位置（动画被关掉时也好看），
// CSS 动画接管后从起点逐格落到画布下方。
const petals: string[] = []
const rules: string[] = []

for (let i = 0; i < 44; i++) {
  // 一半从某棵树的树冠附近飘出，一半从顶部落下
  const fromTree = i % 2 === 0
  const [treeX, treeY, treeScale] = TREES[(i >> 1) % TREES.length] ?? [0, 0, 1]
  const x0 =
    (fromTree ? treeX + Math.round((rand() - 0.5) * 32 * treeScale) : Math.round(rand() * GRID * 1.25)) * CELL
  const y0 = (fromTree ? treeY + Math.round((rand() - 0.5) * 20 * treeScale) : -3) * CELL
  const drift = Math.round(10 + rand() * 40) * CELL
  const duration = (9 + rand() * 12).toFixed(1)
  const delay = (rand() * 20).toFixed(1)
  const frames = 30 + Math.floor(rand() * 24)
  const rest = rand()
  const restX = Math.round((x0 - drift * rest) / CELL) * CELL
  const restY = Math.round((y0 + (SIZE + 40 - y0) * rest) / CELL) * CELL
  const color = BLOSSOM[1 + (i % 3)] ?? '#f9c9d3'
  const big = rand() < 0.4

  rules.push(
    `.p${i}{animation:p${i} ${duration}s steps(${frames}) -${delay}s infinite}`,
    `@keyframes p${i}{from{transform:translate(${x0}px,${y0}px)}to{transform:translate(${x0 - drift}px,${SIZE + 40}px)}}`,
  )
  petals.push(
    `<g class="p${i}" transform="translate(${restX} ${restY})">` +
      `<rect width="${CELL}" height="${CELL}" fill="${color}"/>` +
      (big ? `<rect x="${CELL}" y="${CELL}" width="${CELL}" height="${CELL}" fill="${color}"/>` : '') +
      `</g>`,
  )
}

// ---- 像素云 ----
// 白色云身 + 粉色的底边，在很浅的底色上才看得清
const cloudCells: Cells = new Map()
const CLOUD_ROWS: [number, number, string][] = [
  [8, 8, '#ffffff'],
  [5, 14, '#ffffff'],
  [2, 21, '#ffffff'],
  [0, 26, '#ffffff'],
  [1, 25, '#ffffff'],
  [3, 20, '#f4cfd7'],
]

CLOUD_ROWS.forEach(([start, length, color], row) => {
  for (let x = start; x < start + length; x++) {
    cloudCells.set(`${x},${row}`, color)
  }
})
const CLOUD = toPaths(cloudCells)

// y：高度；scale：大小；rest：静态时停在哪；seconds：横穿一次多少秒；delay：从循环的第几秒开始
const cloud = (name: string, y: number, scale: number, rest: number, seconds: number, delay: number): string => {
  rules.push(`.${name}{animation:cloud ${seconds}s steps(${Math.round(seconds * 2)}) -${delay}s infinite}`)

  return (
    `<g transform="translate(0 ${y}) scale(${scale})">` +
    `<g class="${name}" transform="translate(${rest} 0)">${CLOUD}</g></g>`
  )
}

// 云都放在画布中间偏上那一段，宽窗口裁掉上下时也看得到
const clouds =
  cloud('c1', 300, 1, 120, 110, 12) +
  cloud('c2', 360, 0.6, 1300, 150, 100) +
  cloud('c3', 430, 0.8, 620, 130, 58) +
  cloud('c4', 500, 0.5, 1900, 170, 140) +
  cloud('c5', 560, 0.7, 300, 140, 30)

rules.push(
  `@keyframes cloud{from{transform:translate(-260px,0px)}to{transform:translate(${SIZE * 2 + 200}px,0px)}}`,
  `@media (prefers-reduced-motion: reduce){g{animation:none}}`,
)

export const SCENE =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid slice">` +
  `<style>${rules.join('')}</style>` +
  `<rect width="${SIZE}" height="${SIZE}" fill="#fff1f1"/>` +
  clouds +
  toPaths(tree) +
  petals.join('') +
  `</svg>`
