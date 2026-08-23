// GENERATED CONTENT — transcribe verbatim. Do not re-derive.
// Rule (ADR-9): each Cursor model maps to the HIGHEST-SCORING AA record in its family,
// excluding any whose AA name contains '(Non-reasoning'. Verified against the live AA
// free-tier payload on 2026-08-21: 47 rows, 43 resolved, 4 with no AA data, 0 opt-ins.

export type CursorModelDeclaration = {
  /** Display name exactly as it appears in Cursor's models-and-pricing.md table. */
  readonly cursorName: string
  /** Dash-flattened cursorName. Join key on the Cursor side. */
  readonly cursorSlug: string
  /** AA `slug` this model maps to, or null when AA has never benchmarked it. */
  readonly aaSlug: string | null
  /** True when aaSlug differs from cursorSlug and the mapping is therefore explicit. */
  readonly isAlias: boolean
  /** Set true ONLY to accept an AA record whose name contains '(Non-reasoning'. */
  readonly allowNonReasoning: boolean
  /** Why this AA record was chosen. Human-readable provenance. */
  readonly note: string
}

export const DECLARATIONS = [
  { cursorName: 'Grok 4.6',                      cursorSlug: 'grok-4-6',                      aaSlug: 'grok-4-6',                        isAlias: false, allowNonReasoning: false, note: 'exact slug -> Grok 4.6 (high)' },
  { cursorName: 'Grok 4.6 (Fast)',               cursorSlug: 'grok-4-6-fast',                 aaSlug: 'grok-4-6',                        isAlias: true,  allowNonReasoning: false, note: 'alias -> Grok 4.6 (high)' },
  { cursorName: 'Grok 4.5',                      cursorSlug: 'grok-4-5',                      aaSlug: 'grok-4-5',                        isAlias: false, allowNonReasoning: false, note: 'exact slug -> Grok 4.5 (high)' },
  { cursorName: 'Grok 4.5 (Fast)',               cursorSlug: 'grok-4-5-fast',                 aaSlug: 'grok-4-5',                        isAlias: true,  allowNonReasoning: false, note: 'alias -> Grok 4.5 (high)' },
  { cursorName: 'Composer 2.5',                  cursorSlug: 'composer-2-5',                  aaSlug: null,                              isAlias: false, allowNonReasoning: false, note: 'AA has never benchmarked this model' },
  { cursorName: 'Composer 2.5 (Fast)',           cursorSlug: 'composer-2-5-fast',             aaSlug: null,                              isAlias: false, allowNonReasoning: false, note: 'AA has never benchmarked this model' },
  { cursorName: 'Claude 4 Sonnet',               cursorSlug: 'claude-4-sonnet',               aaSlug: 'claude-4-sonnet-thinking',        isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude 4 Sonnet (Reasoning)' },
  { cursorName: 'Claude 4 Sonnet 1M',            cursorSlug: 'claude-4-sonnet-1m',            aaSlug: 'claude-4-sonnet-thinking',        isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude 4 Sonnet (Reasoning)' },
  { cursorName: 'Claude 4.5 Haiku',              cursorSlug: 'claude-4-5-haiku',              aaSlug: 'claude-4-5-haiku-reasoning',      isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude 4.5 Haiku (Reasoning)' },
  { cursorName: 'Claude 4.5 Opus',               cursorSlug: 'claude-4-5-opus',               aaSlug: 'claude-opus-4-5-thinking',        isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude Opus 4.5 (Reasoning)' },
  { cursorName: 'Claude 4.5 Sonnet',             cursorSlug: 'claude-4-5-sonnet',             aaSlug: 'claude-4-5-sonnet-thinking',      isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude 4.5 Sonnet (Reasoning)' },
  { cursorName: 'Claude 4.6 Opus',               cursorSlug: 'claude-4-6-opus',               aaSlug: 'claude-opus-4-6-adaptive',        isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude Opus 4.6 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude 4.6 Sonnet',             cursorSlug: 'claude-4-6-sonnet',             aaSlug: 'claude-sonnet-4-6-adaptive',      isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude Sonnet 4.6 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude 4.7 Opus',               cursorSlug: 'claude-4-7-opus',               aaSlug: 'claude-opus-4-7',                 isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude Opus 4.7 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude Fable 5',                cursorSlug: 'claude-fable-5',                aaSlug: 'claude-fable-5',                  isAlias: false, allowNonReasoning: false, note: 'exact slug -> Claude Fable 5 (Adaptive Reasoning, Max Effort, Opus 4.8 Fallback)' },
  { cursorName: 'Claude Opus 4.7 (fast mode)',   cursorSlug: 'claude-opus-4-7-fast-mode',     aaSlug: 'claude-opus-4-7',                 isAlias: true,  allowNonReasoning: false, note: 'alias -> Claude Opus 4.7 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude Opus 4.8',               cursorSlug: 'claude-opus-4-8',               aaSlug: 'claude-opus-4-8',                 isAlias: false, allowNonReasoning: false, note: 'exact slug -> Claude Opus 4.8 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude Opus 5',                 cursorSlug: 'claude-opus-5',                 aaSlug: 'claude-opus-5',                   isAlias: false, allowNonReasoning: false, note: 'exact slug -> Claude Opus 5 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Claude Sonnet 5',               cursorSlug: 'claude-sonnet-5',               aaSlug: 'claude-sonnet-5',                 isAlias: false, allowNonReasoning: false, note: 'exact slug -> Claude Sonnet 5 (Adaptive Reasoning, Max Effort)' },
  { cursorName: 'Gemini 2.5 Flash',              cursorSlug: 'gemini-2-5-flash',              aaSlug: 'gemini-2-5-flash-reasoning',      isAlias: true,  allowNonReasoning: false, note: 'alias -> Gemini 2.5 Flash (Reasoning)' },
  { cursorName: 'Gemini 3 Flash',                cursorSlug: 'gemini-3-flash',                aaSlug: 'gemini-3-flash-reasoning',        isAlias: true,  allowNonReasoning: false, note: 'alias -> Gemini 3 Flash Preview (Reasoning)' },
  { cursorName: 'Gemini 3 Pro',                  cursorSlug: 'gemini-3-pro',                  aaSlug: 'gemini-3-pro',                    isAlias: false, allowNonReasoning: false, note: 'exact slug -> Gemini 3 Pro Preview (high)' },
  { cursorName: 'Gemini 3 Pro Image Preview',    cursorSlug: 'gemini-3-pro-image-preview',    aaSlug: null,                              isAlias: false, allowNonReasoning: false, note: 'AA has never benchmarked this model' },
  { cursorName: 'Gemini 3.1 Pro',                cursorSlug: 'gemini-3-1-pro',                aaSlug: 'gemini-3-1-pro-preview',          isAlias: true,  allowNonReasoning: false, note: 'alias -> Gemini 3.1 Pro Preview' },
  { cursorName: 'Gemini 3.5 Flash',              cursorSlug: 'gemini-3-5-flash',              aaSlug: 'gemini-3-5-flash',                isAlias: false, allowNonReasoning: false, note: 'exact slug -> Gemini 3.5 Flash (high)' },
  { cursorName: 'Gemini 3.6 Flash',              cursorSlug: 'gemini-3-6-flash',              aaSlug: 'gemini-3-6-flash',                isAlias: false, allowNonReasoning: false, note: 'exact slug -> Gemini 3.6 Flash (high)' },
  { cursorName: 'Gemini 3.7 Flash',              cursorSlug: 'gemini-3-7-flash',              aaSlug: 'gemini-3-7-flash',                isAlias: false, allowNonReasoning: false, note: 'exact slug -> Gemini 3.7 Flash (high)' },
  { cursorName: 'GLM 5.2',                       cursorSlug: 'glm-5-2',                       aaSlug: 'glm-5-2',                         isAlias: false, allowNonReasoning: false, note: 'exact slug -> GLM-5.2 (max)' },
  { cursorName: 'GPT-5',                         cursorSlug: 'gpt-5',                         aaSlug: 'gpt-5',                           isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5 (high)' },
  { cursorName: 'GPT-5 Fast',                    cursorSlug: 'gpt-5-fast',                    aaSlug: 'gpt-5',                           isAlias: true,  allowNonReasoning: false, note: 'alias -> GPT-5 (high)' },
  { cursorName: 'GPT-5 Mini',                    cursorSlug: 'gpt-5-mini',                    aaSlug: 'gpt-5-mini-medium',               isAlias: true,  allowNonReasoning: false, note: 'alias -> GPT-5 mini (medium)' },
  { cursorName: 'GPT-5-Codex',                   cursorSlug: 'gpt-5-codex',                   aaSlug: 'gpt-5-codex',                     isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5 Codex (high)' },
  { cursorName: 'GPT-5.1 Codex',                 cursorSlug: 'gpt-5-1-codex',                 aaSlug: 'gpt-5-1-codex',                   isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.1 Codex (high)' },
  { cursorName: 'GPT-5.1 Codex Max',             cursorSlug: 'gpt-5-1-codex-max',             aaSlug: null,                              isAlias: false, allowNonReasoning: false, note: 'AA has never benchmarked this model' },
  { cursorName: 'GPT-5.1 Codex Mini',            cursorSlug: 'gpt-5-1-codex-mini',            aaSlug: 'gpt-5-1-codex-mini',              isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.1 Codex mini (high)' },
  { cursorName: 'GPT-5.2',                       cursorSlug: 'gpt-5-2',                       aaSlug: 'gpt-5-2',                         isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.2 (xhigh)' },
  { cursorName: 'GPT-5.2 Codex',                 cursorSlug: 'gpt-5-2-codex',                 aaSlug: 'gpt-5-2-codex',                   isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.2 Codex (xhigh)' },
  { cursorName: 'GPT-5.3 Codex',                 cursorSlug: 'gpt-5-3-codex',                 aaSlug: 'gpt-5-3-codex',                   isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.3 Codex (xhigh)' },
  { cursorName: 'GPT-5.4',                       cursorSlug: 'gpt-5-4',                       aaSlug: 'gpt-5-4',                         isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.4 (xhigh)' },
  { cursorName: 'GPT-5.4 Mini',                  cursorSlug: 'gpt-5-4-mini',                  aaSlug: 'gpt-5-4-mini',                    isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.4 mini (xhigh)' },
  { cursorName: 'GPT-5.4 Nano',                  cursorSlug: 'gpt-5-4-nano',                  aaSlug: 'gpt-5-4-nano',                    isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.4 nano (xhigh)' },
  { cursorName: 'GPT-5.5',                       cursorSlug: 'gpt-5-5',                       aaSlug: 'gpt-5-5',                         isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.5 (xhigh)' },
  { cursorName: 'GPT-5.6 Luna',                  cursorSlug: 'gpt-5-6-luna',                  aaSlug: 'gpt-5-6-luna',                    isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.6 Luna (max)' },
  { cursorName: 'GPT-5.6 Sol',                   cursorSlug: 'gpt-5-6-sol',                   aaSlug: 'gpt-5-6-sol',                     isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.6 Sol (max)' },
  { cursorName: 'GPT-5.6 Terra',                 cursorSlug: 'gpt-5-6-terra',                 aaSlug: 'gpt-5-6-terra',                   isAlias: false, allowNonReasoning: false, note: 'exact slug -> GPT-5.6 Terra (max)' },
  { cursorName: 'Kimi K2.7 Code',                cursorSlug: 'kimi-k2-7-code',                aaSlug: 'kimi-k2-7-code',                  isAlias: false, allowNonReasoning: false, note: 'exact slug -> Kimi K2.7 Code' },
  { cursorName: 'Kimi K3',                       cursorSlug: 'kimi-k3',                       aaSlug: 'kimi-k3',                         isAlias: false, allowNonReasoning: false, note: 'exact slug -> Kimi K3 (max)' },
] as const satisfies readonly CursorModelDeclaration[]
