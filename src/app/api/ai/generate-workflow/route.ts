import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { prompt, systemPrompt } = await req.json()

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 })
    }

    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      return NextResponse.json({
        error: 'OpenAI API key not configured. Set OPENAI_API_KEY in .env',
        steps: generateFallbackSteps(prompt),
      })
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.AI_MODEL || 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const err = await response.json()
      return NextResponse.json({
        error: `OpenAI API error: ${err.error?.message || response.statusText}`,
        steps: generateFallbackSteps(prompt),
      })
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content || '[]'

    try {
      const parsed = JSON.parse(content)
      const steps = Array.isArray(parsed) ? parsed : parsed.steps || []
      return NextResponse.json({ steps })
    } catch {
      const match = content.match(/\[[\s\S]*\]/)
      if (match) {
        const steps = JSON.parse(match[0])
        return NextResponse.json({ steps })
      }
      return NextResponse.json({
        error: 'Failed to parse AI response',
        steps: generateFallbackSteps(prompt),
      })
    }
  } catch (error) {
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 })
  }
}

function generateFallbackSteps(prompt: string): Array<{ action: string; label: string; params: Record<string, unknown> }> {
  const lower = prompt.toLowerCase()
  const steps: Array<{ action: string; label: string; params: Record<string, unknown> }> = []

  const urlMatch = lower.match(/(?:go to|open|navigate|visit|truy cập|mở)\s+(?:(?:https?:\/\/)?[\w.-]+\.[a-z]{2,}[^\s,]*)/i)
  if (urlMatch) {
    let url = urlMatch[0].replace(/^(?:go to|open|navigate|visit|truy cập|mở)\s+/i, '')
    if (!url.startsWith('http')) url = 'https://' + url
    steps.push({ action: 'go_to_url', label: `Go to ${url}`, params: { url } })
    steps.push({ action: 'delay', label: 'Wait for load', params: { ms: 2000 } })
  }

  if (lower.includes('login') || lower.includes('đăng nhập') || lower.includes('sign in')) {
    steps.push({ action: 'wait_element', label: 'Wait for login form', params: { xpath: "//input[@type='email' or @type='text' or @name='username']", timeout: 10000 } })
    steps.push({ action: 'type', label: 'Enter username', params: { xpath: "//input[@type='email' or @type='text' or @name='username']", text: '${email}', clearFirst: true } })
    steps.push({ action: 'type', label: 'Enter password', params: { xpath: "//input[@type='password']", text: '${password}', clearFirst: true } })
    steps.push({ action: 'delay', label: 'Short delay', params: { ms: 500 } })
    steps.push({ action: 'click', label: 'Click login button', params: { xpath: "//button[@type='submit' or contains(text(),'Log') or contains(text(),'Sign')]", timeout: 5000 } })
    steps.push({ action: 'delay', label: 'Wait after login', params: { ms: 3000 } })
  }

  if (lower.includes('scroll')) {
    const scrollMatch = lower.match(/scroll\s*(?:xuống|down)?\s*(\d+)\s*(?:lần|times)/i)
    const scrollCount = scrollMatch ? parseInt(scrollMatch[1]) : 5
    steps.push({ action: 'for_loop', label: `Scroll ${scrollCount} times`, params: { count: scrollCount, variable: 'scrollIdx' } })
    steps.push({ action: 'random_scroll', label: 'Random scroll', params: { minAmount: 200, maxAmount: 600, direction: 'down' } })
    steps.push({ action: 'delay', label: 'Random delay', params: { ms: 1500 } })
  }

  if (lower.includes('like') || lower.includes('thích')) {
    steps.push({ action: 'try_click', label: 'Try like button', params: { xpath: "//button[contains(@aria-label,'Like') or contains(@data-testid,'like')]", maxTries: 3, delayMs: 1000 } })
  }

  if (lower.includes('screenshot') || lower.includes('chụp')) {
    steps.push({ action: 'screenshot', label: 'Take screenshot', params: { saveAs: 'result.png' } })
  }

  if (steps.length === 0) {
    steps.push(
      { action: 'go_to_url', label: 'Go to URL', params: { url: 'https://example.com' } },
      { action: 'delay', label: 'Wait 2 seconds', params: { ms: 2000 } },
      { action: 'screenshot', label: 'Take screenshot', params: { saveAs: 'result.png' } },
      { action: 'log', label: 'Log done', params: { message: 'Workflow completed', level: 'info' } },
    )
  }

  return steps
}
