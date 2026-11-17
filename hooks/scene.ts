// 像素风动态背景：#fff1f1 底色、三棵像素樱花树、方块花瓣飘落、像素云慢慢飘过。
// 动画写在 SVG 自己的 <style> 里（CSS keyframes，匀速平滑移动），由 App 播放。
// 天上有一轮像素月亮跟 5 小时额度联动：剩得越多越圆，用得越多越缺（满月 → 弦月 → 新月）。
// Claude 干活时花瓣更密、落得更快；空闲时只零星飘几片。
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

/** 5 小时额度用了百分之几 → 月相（0 满月 … 10 新月，每 10% 一档；没有额度数据时按满月） */
export const phaseOf = (percentUsed: number | undefined): number =>
  Math.min(10, Math.max(0, Math.round((percentUsed ?? 0) / 10)))
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

const TRUNK_LIGHT = '#a8755f'
const TRUNK = '#8a5a4a'
const TRUNK_DARK = '#6d4438'
const BLOSSOM = ['#fde6ea', '#f9c9d3', '#f4acbc', '#e98fa6']

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

// ---- 樱花树 ----
const drawTrees = (): string => {
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

  return toPaths(tree)
}

// ---- 飘落的花瓣 ----
// 每片花瓣一个 <g>：transform 属性是它静态时停的位置（动画被关掉时也好看），
// CSS 动画接管后匀速从起点落到画布下方，途中左右轻轻摆动。
const drawPetals = (count: number, pace: number, rules: string[]): string => {
  const petals: string[] = []

  for (let i = 0; i < count; i++) {
    // 一半从某棵树的树冠附近飘出，一半从顶部落下
    const fromTree = i % 2 === 0
    const [treeX, treeY, treeScale] = TREES[(i >> 1) % TREES.length] ?? [0, 0, 1]
    const x0 =
      (fromTree ? treeX + Math.round((rand() - 0.5) * 32 * treeScale) : Math.round(rand() * GRID * 1.25)) * CELL
    const y0 = (fromTree ? treeY + Math.round((rand() - 0.5) * 20 * treeScale) : -3) * CELL
    const drift = Math.round(10 + rand() * 40) * CELL
    const sway = Math.round(8 + rand() * 18)
    const duration = ((9 + rand() * 12) * pace).toFixed(1)
    const delay = (rand() * 20).toFixed(1)
    const rest = rand()
    const restX = Math.round(x0 - drift * rest)
    const restY = Math.round(y0 + (SIZE + 40 - y0) * rest)
    const color = BLOSSOM[1 + (i % 3)] ?? '#f9c9d3'
    const big = rand() < 0.4
    const at = (t: number, side: number) =>
      `${t}%{transform:translate(${Math.round(x0 - (drift * t) / 100 + side * sway)}px,${Math.round(y0 + ((SIZE + 40 - y0) * t) / 100)}px)}`

    rules.push(
      `.p${i}{animation:p${i} ${duration}s linear -${delay}s infinite}`,
      `@keyframes p${i}{${at(0, 0)}${at(25, 1)}${at(50, 0)}${at(75, -1)}${at(100, 0)}}`,
    )
    petals.push(
      `<g class="p${i}" transform="translate(${restX} ${restY})">` +
        `<rect width="${CELL}" height="${CELL}" fill="${color}"/>` +
        (big ? `<rect x="${CELL}" y="${CELL}" width="${CELL}" height="${CELL}" fill="${color}"/>` : '') +
        `</g>`,
    )
  }

  return petals.join('')
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

const drawClouds = (rules: string[]): string => {
  // y：高度；scale：大小；rest：静态时停在哪；seconds：横穿一次多少秒；delay：从循环的第几秒开始
  const cloud = (name: string, y: number, scale: number, rest: number, seconds: number, delay: number): string => {
    rules.push(`.${name}{animation:cloud ${seconds}s linear -${delay}s infinite}`)

    return (
      `<g transform="translate(0 ${y}) scale(${scale})">` +
      `<g class="${name}" transform="translate(${rest} 0)">${CLOUD}</g></g>`
    )
  }

  rules.push(`@keyframes cloud{from{transform:translate(-260px,0px)}to{transform:translate(${SIZE * 2 + 200}px,0px)}}`)

  // 云都放在画布中间偏上那一段，宽窗口裁掉上下时也看得到
  return (
    cloud('c1', 300, 1, 120, 110, 12) +
    cloud('c2', 360, 0.6, 1300, 150, 100) +
    cloud('c3', 430, 0.8, 620, 130, 58) +
    cloud('c4', 500, 0.5, 1900, 170, 140) +
    cloud('c5', 560, 0.7, 300, 140, 30)
  )
}

// ---- 像素月亮（额度联动） ----
// 亮面浅奶黄、描一圈暖色边；被"吃掉"的部分是比底色略深的粉，月亮轮廓始终看得见。
// 阴影是同样大的圆，从右边往左盖：用得越多盖得越多。
const MOON_X = 66 // 圆心（格），在左边那棵树和右边两棵树之间的天空
const MOON_Y = 40
const MOON_R = 7

const drawMoon = (phase: number): string => {
  const cells: Cells = new Map()
  const shadowX = MOON_X + 2 * MOON_R * (1 - phase / 10)

  for (let y = MOON_Y - MOON_R; y <= MOON_Y + MOON_R; y++) {
    for (let x = MOON_X - MOON_R; x <= MOON_X + MOON_R; x++) {
      const d = (x - MOON_X) ** 2 + (y - MOON_Y) ** 2

      if (d > MOON_R * MOON_R + MOON_R) {
        continue
      }
      const isEdge = d > (MOON_R - 1) ** 2 + MOON_R - 1
      const isShadow = (x - shadowX) ** 2 + (y - MOON_Y) ** 2 <= MOON_R * MOON_R + MOON_R

      cells.set(`${x},${y}`, isShadow ? (isEdge ? '#efcfd3' : '#f8e2e2') : isEdge ? '#f3d38f' : '#fff4c4')
    }
  }
  // 亮面上两个浅坑
  for (const [x, y] of [[-2, -2], [-1, -2], [2, 2], [1, 3]] as const) {
    const key = `${MOON_X + x},${MOON_Y + y}`

    if (cells.get(key) === '#fff4c4') {
      cells.set(key, '#fbe7a6')
    }
  }

  return toPaths(cells)
}

// 空闲 / 干活两种状态下的花瓣：数量、下落时长倍数
const CALM = { petals: 24, pace: 1.15 }
const BUSY = { petals: 64, pace: 0.7 }

const scenes = new Map<string, string>()

/** 月相为 phase（0 满月 … 10 新月）、是否在干活时的整张背景 SVG，每种组合只算一次 */
export const sceneFor = (phase: number, isBusy: boolean): string => {
  const id = `${phase}-${isBusy}`
  const cached = scenes.get(id)

  if (cached !== undefined) {
    return cached
  }
  seed = 11
  const rules: string[] = []
  const trees = drawTrees()
  const clouds = drawClouds(rules)
  const look = isBusy ? BUSY : CALM
  const petals = drawPetals(look.petals, look.pace, rules)

  rules.push(`@media (prefers-reduced-motion: reduce){g{animation:none}}`)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" preserveAspectRatio="xMidYMid slice">` +
    `<style>${rules.join('')}</style>` +
    `<rect width="${SIZE}" height="${SIZE}" fill="#fff1f1"/>` +
    drawMoon(phase) +
    clouds +
    trees +
    petals +
    `</svg>`

  scenes.set(id, svg)

  return svg
}

// ---- 思考时的小动画 ----
// 一朵五瓣像素樱花慢慢转，花心一闪一闪；同样守白名单（只用 rotate、opacity）。
const flowerCells: Cells = new Map()
const FLOWER = [
  '...pp...',
  '..pPPp..',
  '.pp.PP.p',
  'pPPyyPPp',
  'pPPyyPPp',
  '.pp..pp.',
  '..pPPp..',
  '...pp...',
]

FLOWER.forEach((line, y) => {
  ;[...line].forEach((c, x) => {
    const color = c === 'p' ? '#f4acbc' : c === 'P' ? '#f9c9d3' : c === 'y' ? '#f3c96b' : undefined

    if (color !== undefined) {
      flowerCells.set(`${x},${y}`, color)
    }
  })
})

export const SPINNER =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
  `<style>.f{transform-origin:32px 32px;animation:f 4s linear infinite}` +
  `@keyframes f{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}` +
  `.c{animation:c 1.2s linear infinite}@keyframes c{0%{opacity:1}50%{opacity:0.35}100%{opacity:1}}` +
  `@media (prefers-reduced-motion: reduce){g{animation:none}}</style>` +
  `<g class="f">${toPaths(flowerCells)}<g class="c"><rect x="24" y="24" width="16" height="16" fill="#fbe7a6"/></g></g>` +
  `</svg>`

// ---- 用量条 ----
// 一排 10 朵像素小花，每朵代表 10%：用掉的部分是深粉色，剩下的是浅粉色。
const BLOOM = ['.p.p.', 'ppppp', '.pyp.', 'ppppp', '.p.p.']
const bars = new Map<number, string>()

/** 用了 percent% 时的用量条 SVG（宽 120、高 10），每种格数只算一次 */
export const petalBar = (percent: number): string => {
  const filled = Math.min(10, Math.max(0, Math.round(percent / 10)))
  const cached = bars.get(filled)

  if (cached !== undefined) {
    return cached
  }
  const cells: Map<string, string> = new Map()

  for (let i = 0; i < 10; i++) {
    const isUsed = i < filled

    BLOOM.forEach((line, y) => {
      ;[...line].forEach((c, x) => {
        if (c !== '.') {
          const color = c === 'y' ? (isUsed ? '#f3c96b' : '#f8e6c4') : isUsed ? '#e98fa6' : '#f6dbe1'

          cells.set(`${i * 6 + x},${y}`, color)
        }
      })
    })
  }
  // 这里一格是 2px，不能直接用背景那个 8px 的 toPaths
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 10">` +
    [...cells].map(([key, color]) => {
      const [x, y] = key.split(',').map(Number)

      return `<rect x="${(x ?? 0) * 2}" y="${(y ?? 0) * 2}" width="2" height="2" fill="${color}"/>`
    }).join('') +
    `</svg>`

  bars.set(filled, svg)

  return svg
}
