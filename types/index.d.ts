/** 月相：0 满月 … 10 新月，跟着 5 小时额度的用量走（每 10% 一档） */
export type MoonPhase = number

/** 输入框上方那一条要显示的用量 */
export type Usage = {
  /** 5 小时额度用了百分之几；读不到时没有 */
  fiveHour?: number
  /** 5 小时额度什么时候重置（ISO 时间） */
  resetsAt?: string
  /** 上下文窗口用了百分之几 */
  context?: number
}

declare module 'claude-code' {
  interface PluginState {
    'sakura-pink': { phase: MoonPhase; busy: boolean; usage: Usage; clock: { time: string; date: string } }
  }
}
