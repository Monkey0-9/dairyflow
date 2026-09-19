/**
 * Optional LLM upgrade for the AI Dairy Copilot.
 *
 * Supports Anthropic Messages API (ANTHROPIC_API_KEY) and Google Gemini
 * (GEMINI_API_KEY) with zero new dependencies (plain fetch, 12s timeout).
 * Every call is grounded on rule-engine facts and fails soft to null so the
 * deterministic rule engine always remains the fallback. Inert under VITEST.
 */

export type LlmProvider = 'anthropic' | 'gemini';

export function llmProvider(): LlmProvider | null {
  if (process.env.VITEST === 'true') return null;
  if (process.env.ANTHROPIC_API_KEY) return 'anthropic';
  if (process.env.GEMINI_API_KEY) return 'gemini';
  return null;
}

const SYSTEM_PROMPT = `You are MilkFlow's dairy copilot, answering a dairy farmer's question.
Rules:
- Answer ONLY from the FACTS provided below. Never invent customers, numbers, or dates.
- Keep the answer to 2-4 short sentences, plain text, no markdown tables.
- Preserve all litre (L) and rupee figures exactly as given.
- If the facts say a list is empty, say so plainly and suggest one next step.`;

async function callAnthropic(question: string, facts: string, lang: string): Promise<string | null> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.AI_COPILOT_MODEL || 'claude-3-5-haiku-latest',
        max_tokens: 300,
        system: `${SYSTEM_PROMPT} Reply in ${lang === 'hi' ? 'Hindi' : lang === 'mr' ? 'Marathi' : 'English'}.`,
        messages: [{ role: 'user', content: `FACTS:\n${facts}\n\nQUESTION: ${question}` }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: { type: string; text?: string }[] };
    const text = data.content?.find((c) => c.type === 'text')?.text?.trim();
    return text || null;
  } catch {
    return null;
  }
}

async function callGemini(question: string, facts: string, lang: string): Promise<string | null> {
  try {
    const model = process.env.AI_COPILOT_MODEL || 'gemini-2.0-flash-lite';
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY || ''}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT} Reply in ${lang === 'hi' ? 'Hindi' : lang === 'mr' ? 'Marathi' : 'English'}.` }] },
          contents: [{ parts: [{ text: `FACTS:\n${facts}\n\nQUESTION: ${question}` }] }],
          generationConfig: { maxOutputTokens: 300, temperature: 0.2 },
        }),
        signal: AbortSignal.timeout(12000),
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim();
    return text || null;
  } catch {
    return null;
  }
}

/**
 * Polish a rule-engine answer with an LLM, grounded strictly on `facts`.
 * Returns null when no provider is configured or the call fails — callers
 * must then use the rule-engine answer unchanged.
 */
export async function groundedAnswer(
  question: string,
  facts: Record<string, unknown>,
  lang: string = 'en'
): Promise<string | null> {
  const provider = llmProvider();
  if (!provider) return null;
  const factsText = JSON.stringify(facts).slice(0, 4000);
  if (provider === 'anthropic') return callAnthropic(question, factsText, lang);
  return callGemini(question, factsText, lang);
}
