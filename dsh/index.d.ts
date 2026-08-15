/**
 * Type declarations for the dsh-free-vision host plugin.
 * The implementation is plain ESM (dsh/index.js); these types describe the
 * public surface for editors and downstream tooling.
 */

export interface FreeVisionConfig {
  /** Per-provider API keys. Legacy flat `apiKey` is migrated here. */
  keys?: Record<string, string>
  /** Active provider: qwen | volcengine | siliconflow | zhipu | hunyuan | custom */
  modelProvider?: string
  /** Model override (defaults per provider) */
  modelName?: string
  /** Public tool name */
  toolName?: string
  /** Max output tokens */
  maxTokens?: number
  /** Sampling temperature */
  temperature?: number
  /** Multi-crop large images */
  multiCrop?: boolean
  /** Per-call timeout (ms) */
  toolCallTimeoutMs?: number
  /** Extra env vars passed to the vision engine */
  lumaEnv?: Record<string, string>
  /** Legacy single key (deprecated, migrated to keys) */
  apiKey?: string
}

export interface ConfigResponse {
  schema: unknown
  value: FreeVisionConfig
  hasKey: boolean
  keySource: 'file' | 'env' | 'none'
}

export const name: 'free-vision'
export const inject: ['tools']
export const Config: import('@deepseek-ai/schemastery').default.Schema<FreeVisionConfig>
export function apply(ctx: unknown, config?: Partial<FreeVisionConfig>): void
