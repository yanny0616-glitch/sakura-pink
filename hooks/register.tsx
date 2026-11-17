import type { Register, SessionContextUsage, SessionRateLimit, ThemeSetArgs } from 'claude-code'

import type { Usage } from '../types'

import { makeColors } from './make-colors.js'
import { buddySvg, MOOD_TEXT, moodOfTool, petSvg } from './pet'
import type { Mood } from './pet'
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
// Claude 是否正在干活：干活时花瓣更密更快，团子兔也动起来
const BUSY = { plugin: 'sakura-pink', key: 'busy' } as const
// 输入框上方那一条显示的用量
const USAGE = { plugin: 'sakura-pink', key: 'usage' } as const
// 团子兔：正在用的工具对应的动作、一轮结束后短暂的开心/难过、你在打字、睡着、深夜、子代理数
const TOOL = { plugin: 'sakura-pink', key: 'tool' } as const
const FLASH = { plugin: 'sakura-pink', key: 'flash' } as const
const TYPING = { plugin: 'sakura-pink', key: 'typing' } as const
const SLEEP = { plugin: 'sakura-pink', key: 'sleep' } as const
const NIGHT = { plugin: 'sakura-pink', key: 'night' } as const
const AGENTS = { plugin: 'sakura-pink', key: 'agents' } as const

const fiveHour = (windows: SessionRateLimit[]) => windows.find(w => w.kind === 'five_hour')?.percentUsed
const usageOf = (windows: SessionRateLimit[], context: SessionContextUsage): Usage => {
  const five = windows.find(w => w.kind === 'five_hour')

  return { fiveHour: five?.percentUsed, resetsAt: five?.resetsAt, context: context.percent }
}
// 上下文用到这么多就提醒压缩
const CONTEXT_WARN = 85
// 多久没动静就睡着
const SLEEP_AFTER = 10 * 60_000
// 开心 / 难过持续多久
const FLASH_FOR = 4000
// 停止打字多久后不再看输入框
const TYPING_FOR = 2500
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
const isLateNight = () => new Date().getHours() < 6

export const register: Register = on => {
  // 这几个只在本模块里用，重载后从头算
  let lastActive = Date.now()
  let lastEdit = 0
  const agents = new Set<string>()

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
    await $.state.set(SLEEP, false)
    await $.state.set(NIGHT, isLateNight())
    await $.state.set(AGENTS, 0)

    // 每 30 秒看一次：是不是该睡了、是不是深夜；值变了才写，团子兔才重画
    $.clock.every(30_000, () => {
      void (async () => {
        const isBusy = (await $.state.get(BUSY)).value ?? false
        const isAsleep = !isBusy && Date.now() - lastActive > SLEEP_AFTER

        if (isAsleep !== ((await $.state.get(SLEEP)).value ?? false)) {
          await $.state.set(SLEEP, isAsleep)
        }
        const isNight = isLateNight()

        if (isNight !== ((await $.state.get(NIGHT)).value ?? false)) {
          await $.state.set(NIGHT, isNight)
        }
      })()
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

  on('turn.start', async ($, e, next) => {
    if (e.agentId === undefined) {
      lastActive = Date.now()
      if ((await $.state.get(SLEEP)).value === true) {
        await $.state.set(SLEEP, false)
      }
      await $.state.set(BUSY, true)
      await $.state.set(TOOL, null)
      await $.state.set(FLASH, null)
    } else {
      agents.add(e.agentId)
      await $.state.set(AGENTS, agents.size)
    }

    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId === undefined) {
      lastActive = Date.now()
      await $.state.set(BUSY, false)
      await $.state.set(TOOL, null)
      // 顺利答完就开心一下，被打断或出错就难过一下，几秒后恢复
      const flash: Mood | null = e.reason === 'answer' ? 'happy' : e.reason === 'refusal' ? null : 'sad'

      await $.state.set(FLASH, flash)
      if (flash !== null) {
        $.clock.after(FLASH_FOR, () => {
          void $.state.set(FLASH, null)
        })
      }
    } else {
      agents.delete(e.agentId)
      await $.state.set(AGENTS, agents.size)
    }

    return next(e)
  })

  // 主对话每用一个工具，团子兔就换成对应的动作，直到下一个工具或这一轮结束
  on('tool.call', async ($, e, next) => {
    if (e.agentId === undefined) {
      const mood = moodOfTool(e.tool)

      if (mood !== (await $.state.get(TOOL)).value) {
        await $.state.set(TOOL, mood)
      }
    }

    return next(e)
  })

  // 你在输入框打字时，团子兔看向输入框；停手一会儿就不看了
  on('prompt.edit', async ($, e, next) => {
    lastEdit = Date.now()
    lastActive = Date.now()
    if ((await $.state.get(SLEEP)).value === true) {
      await $.state.set(SLEEP, false)
    }
    if ((await $.state.get(TYPING)).value !== true) {
      await $.state.set(TYPING, true)
    }
    $.clock.after(TYPING_FOR + 100, () => {
      if (Date.now() - lastEdit >= TYPING_FOR) {
        void $.state.set(TYPING, false)
      }
    })

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

  // 输入框上方那一条：团子兔（和子代理小兔子）+ 用量条，上下文快满时多一张提醒卡片
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || e.surface !== 'desktop') {
      return next(e)
    }
    const { Box, Button, Svg, Text } = $.ui.resolve(e)
    const usage = (await $.state.get(USAGE)).value ?? {}
    const isWorking = e.props.isWorking || ((await $.state.get(BUSY)).value ?? false)
    const resets = clockOf(usage.resetsAt)
    const isFull = (usage.context ?? 0) >= CONTEXT_WARN
    const helpers = (await $.state.get(AGENTS)).value ?? 0
    const flash = (await $.state.get(FLASH)).value ?? null
    // 优先级：干活 > 刚结束的开心/难过 > 你在打字 > 睡着 > 深夜 > 发呆
    const mood: Mood = isWorking
      ? ((await $.state.get(TOOL)).value ?? 'busy')
      : (flash ??
        ((await $.state.get(TYPING)).value === true
          ? 'typing'
          : (await $.state.get(SLEEP)).value === true
            ? 'sleep'
            : (await $.state.get(NIGHT)).value === true
              ? 'yawn'
              : 'idle'))

    const bar = (id: string, label: string, percent: number, note: string) => (
      <Box key={id} flexDirection="row" alignItems="center" gap="sm">
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
        <Svg source={petSvg(mood)} alt={MOOD_TEXT[mood]} width={40} height={48} isInteractive />
        {helpers > 0 ? (
          <Svg
            key="buddies"
            source={buddySvg(helpers)}
            alt={`${helpers} 只小兔子在帮忙`}
            width={Math.min(4, helpers) * 21}
            height={24}
            isInteractive
          />
        ) : null}
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
      </Box>
    )
  })

  // 背景必须是单独一个 Svg：桌面版只给这种结构播放动画。时钟按画的这一刻对准，之后自己走
  on('ui.render', { component: 'Backdrop' }, async ($, e, next) => {
    if (e.props.scene !== 'sakura' || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const phase = (await $.state.get(PHASE)).value ?? 0
    const isBusy = (await $.state.get(BUSY)).value ?? false

    return (
      <Svg source={sceneFor(phase, isBusy, new Date())} alt="像素风樱花树，花瓣飘落，月亮随额度圆缺，像素时钟" isInteractive />
    )
  })
}
