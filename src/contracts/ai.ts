/**
 * AI chat contracts.
 *
 * The shared package owns only the chat UI shell. It must never import a
 * Gemini/OpenAI SDK type, a Supabase type, or any host Data Chat type — the
 * host's `AIAdapter.sendMessage` implementation is a black box to this
 * package that happens to return this normalized shape.
 */

export interface AIMessage {
  role: 'user' | 'model';
  text: string;
}

export interface AIRequest {
  text: string;
  history: AIMessage[];
  signal?: AbortSignal;
}

export interface HostActionDescriptor<TPayload = unknown> {
  actionId: string;
  payload: TPayload;
}

export interface AIResponse {
  text: string;
  meta?: { source: 'general' | 'data-chat' | 'fallback' };
  /** Present only if the host's own orchestration already validated an
   *  action inside `sendMessage` — the shared UI never parses this itself,
   *  it only forwards it to `HostActionAdapter.execute` if provided. */
  hostAction?: HostActionDescriptor;
}

export interface AIAdapter {
  sendMessage(request: AIRequest): Promise<AIResponse>;
}
