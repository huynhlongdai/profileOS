import { NextRequest, NextResponse } from 'next/server'
import WebSocket from 'ws'
import { sessions, type RecordedAction, type RecordingSession } from '@/lib/recorder-store'

const RECORDER_INJECT_SCRIPT = `
(function() {
  if (window.__dkRecorderActive) return;
  window.__dkRecorderActive = true;
  window.__dkRecordedEvents = [];

  function getXPath(el) {
    if (!el || el === document.body) return '/html/body';
    if (el.id) return '//*[@id="' + el.id + '"]';
    var tag = el.tagName.toLowerCase();
    var attrs = ['name', 'data-testid', 'aria-label', 'placeholder', 'type', 'role'];
    for (var i = 0; i < attrs.length; i++) {
      var val = el.getAttribute(attrs[i]);
      if (val) {
        var xpath = '//' + tag + '[@' + attrs[i] + '="' + val.replace(/"/g, '\\\\"') + '"]';
        try {
          var result = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result.snapshotLength === 1) return xpath;
        } catch(e) {}
      }
    }
    if (['button', 'a', 'span', 'label'].indexOf(tag) >= 0) {
      var text = (el.textContent || '').trim();
      if (text && text.length < 50) {
        var xpath2 = '//' + tag + '[contains(text(),"' + text.substring(0, 30).replace(/"/g, '\\\\"') + '")]';
        try {
          var result2 = document.evaluate(xpath2, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
          if (result2.snapshotLength === 1) return xpath2;
        } catch(e) {}
      }
    }
    var parent = el.parentNode;
    if (!parent) return '/' + tag;
    var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === el.tagName; });
    if (siblings.length === 1) return getXPath(parent) + '/' + tag;
    var idx = siblings.indexOf(el) + 1;
    return getXPath(parent) + '/' + tag + '[' + idx + ']';
  }

  function record(type, data) {
    window.__dkRecordedEvents.push({ type: type, timestamp: Date.now(), url: location.href, ...data });
  }

  document.addEventListener('click', function(e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    record('click', { xpath: getXPath(el), tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().substring(0, 100), x: e.clientX, y: e.clientY });
  }, true);

  var inputTimer = null, lastInputEl = null, lastInputValue = '';
  document.addEventListener('input', function(e) {
    var el = e.target;
    if (!el || !el.tagName) return;
    if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable) {
      lastInputEl = el; lastInputValue = el.value || el.textContent || '';
      clearTimeout(inputTimer);
      inputTimer = setTimeout(function() {
        if (lastInputEl) {
          record('type', { xpath: getXPath(lastInputEl), tag: lastInputEl.tagName.toLowerCase(), value: lastInputValue });
          lastInputEl = null;
        }
      }, 500);
    }
  }, true);

  document.addEventListener('change', function(e) {
    var el = e.target;
    if (!el) return;
    if (el.tagName === 'SELECT') {
      record('select', { xpath: getXPath(el), value: el.value, label: el.options && el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : '' });
    }
  }, true);

  var scrollTimer = null, scrollStartY = window.scrollY;
  window.addEventListener('scroll', function() {
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(function() {
      var deltaY = window.scrollY - scrollStartY;
      if (Math.abs(deltaY) > 50) {
        record('scroll', { deltaY: deltaY, direction: deltaY > 0 ? 'down' : 'up' });
      }
      scrollStartY = window.scrollY;
    }, 300);
  }, { passive: true });

  document.addEventListener('keydown', function(e) {
    if (['Enter', 'Tab', 'Escape'].indexOf(e.key) >= 0) {
      record('keypress', { key: e.key, xpath: e.target ? getXPath(e.target) : null });
    }
  }, true);
})();
`

const FLUSH_SCRIPT = `(function() { var e = window.__dkRecordedEvents || []; window.__dkRecordedEvents = []; return JSON.stringify(e); })()`

function eventToAction(evt: {
  type: string; timestamp: number; xpath?: string; text?: string;
  value?: string; deltaY?: number; direction?: string; key?: string; tag?: string; label?: string;
}): RecordedAction | null {
  switch (evt.type) {
    case 'click':
      return {
        timestamp: evt.timestamp,
        action: 'click',
        params: { xpath: evt.xpath, timeout: 5000 },
        label: `Click ${evt.tag}${evt.text ? `: "${evt.text.substring(0, 40)}"` : ''}`,
        xpath: evt.xpath,
      }
    case 'type':
      return {
        timestamp: evt.timestamp,
        action: 'type',
        params: { xpath: evt.xpath, text: evt.value ?? '', clearFirst: true },
        label: `Type "${(evt.value ?? '').substring(0, 30)}" into ${evt.tag}`,
        xpath: evt.xpath,
      }
    case 'select':
      return {
        timestamp: evt.timestamp,
        action: 'select_dropdown',
        params: { xpath: evt.xpath, value: evt.value },
        label: `Select "${evt.label || evt.value}"`,
        xpath: evt.xpath,
      }
    case 'scroll':
      return {
        timestamp: evt.timestamp,
        action: 'scroll',
        params: { deltaY: evt.deltaY ?? 0, direction: evt.direction ?? 'down' },
        label: `Scroll ${evt.direction ?? 'down'}`,
      }
    case 'keypress':
      if (evt.key === 'Enter' || evt.key === 'Tab' || evt.key === 'Escape') {
        return { timestamp: evt.timestamp, action: 'key_press', params: { key: evt.key }, label: `Press ${evt.key}` }
      }
      return null
    default:
      return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const { debugPort } = await req.json()
    if (!debugPort) {
      return NextResponse.json({ error: 'debugPort is required' }, { status: 400 })
    }

    const targetListUrl = `http://127.0.0.1:${debugPort}/json`
    let targetResp: Response
    try {
      targetResp = await fetch(targetListUrl)
    } catch {
      return NextResponse.json({ error: `Cannot connect to browser on port ${debugPort}. Make sure a browser is running with --remote-debugging-port=${debugPort}` }, { status: 400 })
    }
    if (!targetResp.ok) {
      return NextResponse.json({ error: `Browser on port ${debugPort} returned ${targetResp.status}` }, { status: 400 })
    }

    const targets = await targetResp.json() as Array<{ webSocketDebuggerUrl: string; type: string }>
    const pageTarget = targets.find(t => t.type === 'page') ?? targets[0]
    if (!pageTarget?.webSocketDebuggerUrl) {
      return NextResponse.json({ error: 'No page targets found' }, { status: 400 })
    }

    const ws = new WebSocket(pageTarget.webSocketDebuggerUrl)
    let msgId = 1

    const sendCdp = (method: string, params?: Record<string, unknown>): Promise<unknown> => {
      return new Promise((resolve, reject) => {
        const id = msgId++
        const timeout = setTimeout(() => reject(new Error('CDP timeout')), 10000)
        const handler = (raw: WebSocket.Data) => {
          const msg = JSON.parse(raw.toString())
          if (msg.id === id) {
            clearTimeout(timeout)
            ws.removeListener('message', handler)
            if (msg.error) reject(new Error(msg.error.message))
            else resolve(msg.result)
          }
        }
        ws.on('message', handler)
        ws.send(JSON.stringify({ id, method, params: params ?? {} }))
      })
    }

    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => resolve())
      ws.on('error', (e: Error) => reject(e))
    })

    await sendCdp('Page.enable')
    await sendCdp('Runtime.enable')
    await sendCdp('Runtime.evaluate', { expression: RECORDER_INJECT_SCRIPT })
    await sendCdp('Page.addScriptToEvaluateOnNewDocument', { source: RECORDER_INJECT_SCRIPT })

    const sessionId = `rec-${Date.now()}`
    const session: RecordingSession = {
      id: sessionId,
      debugPort,
      startedAt: Date.now(),
      actions: [],
      status: 'recording',
      ws,
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString())
        if (msg.method === 'Page.frameNavigated' && msg.params?.frame && !msg.params.frame.parentId) {
          const url = msg.params.frame.url
          if (url && url !== 'about:blank' && session.status === 'recording') {
            session.actions.push({
              timestamp: Date.now(),
              action: 'go_to_url',
              params: { url },
              label: `Navigate to ${url}`,
            })
          }
        }
      } catch { /* ignore */ }
    })

    session.pollInterval = setInterval(async () => {
      if (session.status !== 'recording') return
      try {
        const result = await sendCdp('Runtime.evaluate', {
          expression: FLUSH_SCRIPT,
          returnByValue: true,
        }) as { result?: { value?: string } }

        const raw = result?.result?.value
        if (!raw) return
        const events = JSON.parse(raw) as Array<{
          type: string; timestamp: number; xpath?: string; text?: string;
          value?: string; deltaY?: number; direction?: string; key?: string; tag?: string; label?: string;
        }>

        for (const evt of events) {
          const recorded = eventToAction(evt)
          if (recorded) {
            const last = session.actions[session.actions.length - 1]
            if (last && last.action === recorded.action && last.xpath === recorded.xpath && Date.now() - last.timestamp < 500) continue
            session.actions.push(recorded)
          }
        }
      } catch { /* page navigating */ }
    }, 1000)

    sessions.set(sessionId, session)
    return NextResponse.json({ sessionId, status: 'recording' })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 })
  }
}
