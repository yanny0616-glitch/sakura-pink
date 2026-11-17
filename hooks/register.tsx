import type { Register, SessionRateLimit, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { phaseOf, sceneFor } from './scene'

// 底色取自参考图的 #fff1f1，卡片/面板往奶白 #fffaf3 过渡；强调色等保持 App 默认。
const { theme, problems } = makeColors({
  label: 'Sakura Pink',
  only: 'light',
  light: {
    gray: {
      anchors: {
        'surface-0': '#fff1f1',
        'surface-1': '#fff5f3',
        'surface-2': '#fffaf3',
        'surface-3': '#fffaf3',
        'text-primary': '#3b2a2e',
        'text-secondary': '#5c4449',
        'text-muted': '#7a5f64',
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'sakura', glass: { blur: 0, tint: '#fff1f1', opacity: 0.5 } },
}

// 天上的像素月亮跟着 5 小时额度走：剩得越多越圆，用得越多越缺
const PHASE = { plugin: 'sakura-pink', key: 'phase' } as const
const fiveHour = (windows: SessionRateLimit[]) => windows.find(w => w.kind === 'five_hour')?.percentUsed

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }
    const set = await $.theme.set(LOOK)

    $.ui.status(set.isDrawn ? undefined : set.reason)
    const usage = await $.session.usage()

    await $.state.set(PHASE, phaseOf(fiveHour(usage.rateLimits)))

    return next(e)
  })

  // 额度每变一整格（10%）才换月相；同一月相不写，背景就不会重画
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits')) {
      const now = phaseOf(fiveHour(e.rateLimits))

      if (now !== ((await $.state.get(PHASE)).value ?? 0)) {
        await $.state.set(PHASE, now)
      }
    }

    return next(e)
  })

  // 背景必须是单独一个 Svg：桌面版只给这种结构播放动画
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== 'sakura' || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={sceneFor((await $.state.get(PHASE)).value ?? 0)} alt="像素风樱花树，花瓣飘落，月亮随额度圆缺" isInteractive />
  })
}
