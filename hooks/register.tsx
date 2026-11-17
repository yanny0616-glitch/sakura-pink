import type { Register, SessionRateLimit, ThemeSetArgs } from 'claude-code'

import { makeColors } from './make-colors.js'
import { phaseOf, sceneFor, SPINNER } from './scene'

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
// Claude 是否正在干活：干活时花瓣更密更快
const BUSY = { plugin: 'sakura-pink', key: 'busy' } as const
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

  // 只看主对话的开始和结束，子代理的不算
  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      await $.state.set(BUSY, true)
    }

    return next(e)
  })
  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      await $.state.set(BUSY, false)
    }

    return next(e)
  })

  // 思考时的小动画：旋转的像素樱花 + 按阶段换说法；在用工具时保留 App 原本说的步骤
  on('ui.render', { component: 'Spinner' }, ($, e, next) => {
    if (e.surface !== 'desktop') {
      return next(e)
    }
    const { Box, Svg, Text } = $.ui.resolve(e)
    const says =
      e.props.message ??
      (e.props.mode === 'thinking'
        ? '樱花树下思索中'
        : e.props.mode === 'requesting'
          ? '花苞待放'
          : e.props.mode === 'responding'
            ? '花开作答'
            : e.props.word)

    return (
      <Box flexDirection="row" alignItems="center" gap="sm">
        <Svg source={SPINNER} alt="旋转的像素樱花" width={18} height={18} isInteractive />
        <Text color="#c76a84">
          {says}
          {e.props.suffix}
        </Text>
      </Box>
    )
  })

  // 背景必须是单独一个 Svg：桌面版只给这种结构播放动画
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== 'sakura' || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return <Svg source={sceneFor((await $.state.get(PHASE)).value ?? 0, (await $.state.get(BUSY)).value ?? false)} alt="像素风樱花树，花瓣飘落，月亮随额度圆缺" isInteractive />
  })
}
