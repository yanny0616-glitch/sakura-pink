import type { Register, SessionContextUsage, SessionRateLimit, ThemeSetArgs } from 'claude-code'

import type { Usage } from '../types'

import { makeColors } from './make-colors.js'
import { PET_BUSY, PET_IDLE } from './pet'
import { petalBar, phaseOf, sceneFor, SPINNER } from './scene'

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
// 输入框上方那一条显示的用量
const USAGE = { plugin: 'sakura-pink', key: 'usage' } as const
const usageOf = (windows: SessionRateLimit[], context: SessionContextUsage): Usage => {
  const five = windows.find(w => w.kind === 'five_hour')

  return { fiveHour: five?.percentUsed, resetsAt: five?.resetsAt, context: context.percent }
}
// 输入框上方那一条右边显示的时间：每 10 秒看一次，分钟变了才写，只有那一条重画
const CLOCK = { plugin: 'sakura-pink', key: 'clock' } as const
const WEEK = ['日', '一', '二', '三', '四', '五', '六']
const nowText = () => {
  const at = new Date()

  return {
    time: `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`,
    date: `${at.getMonth() + 1}月${at.getDate()}日 周${WEEK[at.getDay()] ?? ''}`,
  }
}
// 上下文用到这么多就提醒压缩
const CONTEXT_WARN = 85
const PINK = '#c76a84'
const DEEP = '#b5405f'

/** 重置时间按本机时间显示成 15:20 */
const clockOf = (iso: string | undefined): string | undefined => {
  if (iso === undefined) {
    return undefined
  }
  const at = new Date(iso)

  if (Number.isNaN(at.getTime())) {
    return undefined
  }

  return `${at.getHours()}:${String(at.getMinutes()).padStart(2, '0')}`
}

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
    await $.state.set(USAGE, usageOf(usage.rateLimits, usage.context))

    await $.state.set(CLOCK, nowText())
    $.clock.every(10_000, () => {
      const now = nowText()

      void $.state.get(CLOCK).then(held => {
        if (held.value?.time !== now.time) {
          void $.state.set(CLOCK, now)
        }
      })
    })

    return next(e)
  })

  // 额度每变一整格（10%）才换月相；同一月相不写，背景就不会重画
  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('rateLimits') || e.changed.includes('context')) {
      await $.state.set(USAGE, usageOf(e.rateLimits, e.context))
    }
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

  // 输入框上方那一条：左边是小宠物，右边是用量条，上下文快满时多一张提醒卡片
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface !== 'desktop') {
      return next(e)
    }
    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const usage = (await $.state.get(USAGE)).value ?? {}
    const isWorking = e.props.isWorking
    const resets = clockOf(usage.resetsAt)
    const isFull = (usage.context ?? 0) >= CONTEXT_WARN
    const clock = (await $.state.get(CLOCK)).value

    const bar = (key: string, label: string, percent: number, note: string) => (
      <Box key={key} flexDirection="row" alignItems="center" gap="sm">
        <Text size="footnote" color={PINK}>
          {label}
        </Text>
        <Svg source={petalBar(percent)} alt={`${label}用了 ${Math.round(percent)}%`} width={120} height={10} />
        <Text size="footnote" color={percent >= 90 ? DEEP : PINK} tabular>
          {`${Math.round(percent)}%${note}`}
        </Text>
      </Box>
    )

    return (
      <Box flexDirection="row" alignItems="center" gap="md">
        <Svg
          source={isWorking ? PET_BUSY : PET_IDLE}
          alt={isWorking ? '团子兔正在一蹦一蹦地干活' : '团子兔在发呆'}
          width={40}
          height={48}
          isInteractive
        />
        <Box flexDirection="column" gap="xs">
          {isFull ? (
            <Box
              key="warn"
              flexDirection="row"
              alignItems="center"
              gap="sm"
              paddingX="sm"
              borderStyle="round"
              borderColor="#f4acbc"
              backgroundColor="#ffe3ea"
            >
              <Text size="footnote" color={DEEP}>
                {`上下文已用 ${Math.round(usage.context ?? 0)}%，快满了，压缩一下能腾出空间`}
              </Text>
              <Button
                key="compact"
                label="压缩"
                variant="primary"
                onPress={async () => {
                  if (isWorking) {
                    $.ui.toast('等这一轮回答完再压缩')

                    return
                  }
                  try {
                    const done = await $.session.compact()

                    if ('skip' in done && done.skip !== undefined) {
                      $.ui.toast('这次压缩被跳过了')
                    }
                  } catch {
                    $.ui.toast('现在没法压缩，等这一轮结束再试')
                  }
                }}
              />
            </Box>
          ) : null}
          {usage.fiveHour !== undefined
            ? bar('five', '5 小时额度', usage.fiveHour, resets === undefined ? '' : ` · ${resets} 重置`)
            : null}
          {usage.context !== undefined ? bar('context', '上下文', usage.context, '') : null}
        </Box>
        <Box flexGrow={1} />
        {clock !== undefined ? (
          <Box key="clock" flexDirection="column" alignItems="flex-end" paddingRight="sm">
            <Text size="heading" weight="semibold" color={PINK} tabular>
              {clock.time}
            </Text>
            <Text size="caption" color={PINK}>
              {clock.date}
            </Text>
          </Box>
        ) : null}
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
