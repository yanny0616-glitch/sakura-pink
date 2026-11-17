/** 月相：0 满月 … 10 新月，跟着 5 小时额度的用量走（每 10% 一档） */
export type MoonPhase = number

declare module 'claude-code' {
  interface PluginState {
    'sakura-pink': { phase: MoonPhase; busy: boolean }
  }
}
