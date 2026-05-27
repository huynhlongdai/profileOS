'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Play, Trash2, Search, Save, Download,
  Globe, MousePointer, Keyboard, Clock, Eye,
  GitBranch, Repeat, Variable, FileText, Zap,
  ChevronDown, ChevronRight, GripVertical, X,
  Copy, Upload, Code, Image, Mail, Shield,
  ArrowUp, ArrowDown, Settings, AlertTriangle,
  CheckCircle, XCircle, Loader2, ExternalLink,
  Sparkles, Workflow,
} from 'lucide-react'
import Card, { CardHeader } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'

// ============ Types ============

type WorkflowActionType =
  // Navigation
  | 'go_to_url' | 'new_tab' | 'close_tab' | 'reload' | 'back' | 'forward' | 'wait_url_changed' | 'get_url' | 'active_tab'
  // Mouse
  | 'click' | 'double_click' | 'right_click' | 'hover' | 'scroll' | 'try_click'
  | 'click_coordinates' | 'drag_and_drop' | 'random_scroll' | 'scroll_to_element'
  // Keyboard
  | 'type' | 'key_press' | 'select_dropdown' | 'file_upload'
  // Element
  | 'wait_element' | 'get_text' | 'get_attribute' | 'count_elements' | 'element_exists'
  // Control Flow
  | 'delay' | 'if_condition' | 'for_loop' | 'while_loop' | 'break_loop' | 'continue_loop' | 'try_catch'
  // Data & Variables
  | 'set_variable' | 'increment_variable' | 'math_execute' | 'random_number' | 'random_text'
  // String Operations
  | 'split_text' | 'regex_extract' | 'parse_json'
  // Code & HTTP
  | 'execute_js' | 'http_request' | 'http_download'
  // Screenshot & Log
  | 'screenshot' | 'log'
  // Alert
  | 'accept_alert' | 'dismiss_alert'
  // Cookie
  | 'cookie_import' | 'cookie_export'
  // Clipboard
  | 'get_clipboard' | 'set_clipboard'
  // Frame/Popup
  | 'switch_to_frame' | 'switch_to_default' | 'switch_to_popup'
  // Advanced
  | 'get_2fa' | 'read_mail_otp'
  // AI
  | 'ai_generate'

interface WorkflowStep {
  id: string
  action: WorkflowActionType
  label: string
  params: Record<string, string | number | boolean>
  children?: WorkflowStep[]
  elseChildren?: WorkflowStep[]
  enabled: boolean
}

interface WorkflowVariable {
  name: string
  type: 'string' | 'number' | 'boolean' | 'secret'
  label: string
  defaultValue: string
  required: boolean
}

interface Workflow {
  id?: string
  name: string
  description: string
  category: string
  variables: WorkflowVariable[]
  steps: WorkflowStep[]
}

interface SavedWorkflow {
  id: string
  name: string
  description: string | null
  category: string
  actionsJson: string
  variablesJson: string | null
  usageCount: number
  createdAt: string
  updatedAt: string
}

interface Profile {
  id: string
  name: string
  profileUid: string
  status: string
  remoteDebuggingPort: number | null
}

interface Execution {
  id: string
  status: string
  profileId: string
  startedAt: string | null
  completedAt: string | null
  duration: number | null
  error: string | null
}

// ============ Action Categories ============

const ACTION_CATEGORIES = [
  {
    label: 'Navigation',
    icon: Globe,
    color: 'text-blue-400',
    actions: [
      { type: 'go_to_url' as const, label: 'Go to URL', icon: Globe, desc: 'Navigate to a URL' },
      { type: 'new_tab' as const, label: 'New Tab', icon: Plus, desc: 'Open new tab' },
      { type: 'close_tab' as const, label: 'Close Tab', icon: X, desc: 'Close current tab' },
      { type: 'active_tab' as const, label: 'Active Tab', icon: ExternalLink, desc: 'Switch to tab by index' },
      { type: 'reload' as const, label: 'Reload', icon: Repeat, desc: 'Reload page' },
      { type: 'back' as const, label: 'Back', icon: ArrowUp, desc: 'Go back' },
      { type: 'forward' as const, label: 'Forward', icon: ArrowDown, desc: 'Go forward' },
      { type: 'get_url' as const, label: 'Get URL', icon: Globe, desc: 'Get current page URL' },
      { type: 'wait_url_changed' as const, label: 'Wait URL Change', icon: Clock, desc: 'Wait for URL change' },
    ],
  },
  {
    label: 'Mouse',
    icon: MousePointer,
    color: 'text-green-400',
    actions: [
      { type: 'click' as const, label: 'Click', icon: MousePointer, desc: 'Click element by XPath' },
      { type: 'double_click' as const, label: 'Double Click', icon: MousePointer, desc: 'Double click element' },
      { type: 'right_click' as const, label: 'Right Click', icon: MousePointer, desc: 'Right click element' },
      { type: 'hover' as const, label: 'Hover', icon: MousePointer, desc: 'Hover over element' },
      { type: 'click_coordinates' as const, label: 'Click XY', icon: MousePointer, desc: 'Click at screen coordinates' },
      { type: 'drag_and_drop' as const, label: 'Drag & Drop', icon: GripVertical, desc: 'Drag from one element to another' },
      { type: 'scroll' as const, label: 'Scroll', icon: ArrowDown, desc: 'Scroll page' },
      { type: 'random_scroll' as const, label: 'Random Scroll', icon: ArrowDown, desc: 'Scroll random amount' },
      { type: 'scroll_to_element' as const, label: 'Scroll to Element', icon: Eye, desc: 'Scroll element into view' },
      { type: 'try_click' as const, label: 'Try Click', icon: Repeat, desc: 'Click until condition met' },
    ],
  },
  {
    label: 'Keyboard',
    icon: Keyboard,
    color: 'text-yellow-400',
    actions: [
      { type: 'type' as const, label: 'Type Text', icon: Keyboard, desc: 'Type into element' },
      { type: 'key_press' as const, label: 'Key Press', icon: Keyboard, desc: 'Press key combination' },
      { type: 'select_dropdown' as const, label: 'Select Dropdown', icon: ChevronDown, desc: 'Select from dropdown' },
      { type: 'file_upload' as const, label: 'File Upload', icon: Upload, desc: 'Upload file' },
    ],
  },
  {
    label: 'Element',
    icon: Eye,
    color: 'text-purple-400',
    actions: [
      { type: 'wait_element' as const, label: 'Wait Element', icon: Clock, desc: 'Wait for element to appear' },
      { type: 'element_exists' as const, label: 'Element Exists', icon: Eye, desc: 'Check if element exists (no error)' },
      { type: 'get_text' as const, label: 'Get Text', icon: FileText, desc: 'Get element text content' },
      { type: 'get_attribute' as const, label: 'Get Attribute', icon: Code, desc: 'Get element attribute' },
      { type: 'count_elements' as const, label: 'Count Elements', icon: Eye, desc: 'Count matching elements' },
    ],
  },
  {
    label: 'Control Flow',
    icon: GitBranch,
    color: 'text-orange-400',
    actions: [
      { type: 'if_condition' as const, label: 'If Condition', icon: GitBranch, desc: 'Conditional branch' },
      { type: 'for_loop' as const, label: 'For Loop', icon: Repeat, desc: 'Loop N times' },
      { type: 'while_loop' as const, label: 'While Loop', icon: Repeat, desc: 'Loop until condition' },
      { type: 'try_catch' as const, label: 'Try / Catch', icon: Shield, desc: 'Try block, catch errors' },
      { type: 'break_loop' as const, label: 'Break Loop', icon: X, desc: 'Exit current loop' },
      { type: 'continue_loop' as const, label: 'Continue Loop', icon: Repeat, desc: 'Skip to next iteration' },
      { type: 'delay' as const, label: 'Delay', icon: Clock, desc: 'Wait for time' },
    ],
  },
  {
    label: 'Data & Variables',
    icon: Variable,
    color: 'text-cyan-400',
    actions: [
      { type: 'set_variable' as const, label: 'Set Variable', icon: Variable, desc: 'Set a variable value' },
      { type: 'increment_variable' as const, label: 'Increment', icon: Plus, desc: 'Increase variable by amount' },
      { type: 'math_execute' as const, label: 'Math', icon: Code, desc: 'Math expression (+-*/%)' },
      { type: 'random_number' as const, label: 'Random Number', icon: Zap, desc: 'Generate random number' },
      { type: 'random_text' as const, label: 'Random Text', icon: FileText, desc: 'Generate random string' },
    ],
  },
  {
    label: 'Text Operations',
    icon: FileText,
    color: 'text-teal-400',
    actions: [
      { type: 'split_text' as const, label: 'Split Text', icon: FileText, desc: 'Split text by delimiter' },
      { type: 'regex_extract' as const, label: 'Regex Extract', icon: Code, desc: 'Extract with regex' },
      { type: 'parse_json' as const, label: 'Parse JSON', icon: Code, desc: 'Parse JSON and extract value' },
    ],
  },
  {
    label: 'Code & HTTP',
    icon: Code,
    color: 'text-indigo-400',
    actions: [
      { type: 'execute_js' as const, label: 'Execute JS', icon: Code, desc: 'Run JavaScript code' },
      { type: 'http_request' as const, label: 'HTTP Request', icon: Globe, desc: 'Send HTTP request' },
      { type: 'http_download' as const, label: 'HTTP Download', icon: Download, desc: 'Download file from URL' },
      { type: 'screenshot' as const, label: 'Screenshot', icon: Image, desc: 'Take screenshot' },
      { type: 'log' as const, label: 'Log', icon: FileText, desc: 'Log a message' },
    ],
  },
  {
    label: 'Alert & Dialog',
    icon: AlertTriangle,
    color: 'text-amber-400',
    actions: [
      { type: 'accept_alert' as const, label: 'Accept Alert', icon: CheckCircle, desc: 'Accept/OK alert dialog' },
      { type: 'dismiss_alert' as const, label: 'Dismiss Alert', icon: XCircle, desc: 'Cancel/dismiss alert dialog' },
    ],
  },
  {
    label: 'Cookie & Clipboard',
    icon: Shield,
    color: 'text-rose-400',
    actions: [
      { type: 'cookie_import' as const, label: 'Import Cookie', icon: Download, desc: 'Import cookies from JSON' },
      { type: 'cookie_export' as const, label: 'Export Cookie', icon: Upload, desc: 'Export cookies to variable' },
      { type: 'get_clipboard' as const, label: 'Get Clipboard', icon: Copy, desc: 'Read clipboard text' },
      { type: 'set_clipboard' as const, label: 'Set Clipboard', icon: Copy, desc: 'Write text to clipboard' },
    ],
  },
  {
    label: 'Frame & Popup',
    icon: ExternalLink,
    color: 'text-sky-400',
    actions: [
      { type: 'switch_to_frame' as const, label: 'Switch to Frame', icon: ExternalLink, desc: 'Switch to iframe' },
      { type: 'switch_to_default' as const, label: 'Switch to Default', icon: ExternalLink, desc: 'Switch back to main' },
      { type: 'switch_to_popup' as const, label: 'Switch to Popup', icon: ExternalLink, desc: 'Switch to popup window' },
    ],
  },
  {
    label: 'Advanced',
    icon: Shield,
    color: 'text-pink-400',
    actions: [
      { type: 'get_2fa' as const, label: '2FA Code', icon: Shield, desc: 'Generate TOTP 2FA code' },
      { type: 'read_mail_otp' as const, label: 'Read Mail OTP', icon: Mail, desc: 'Read OTP from email' },
      { type: 'ai_generate' as const, label: 'AI Chat', icon: Zap, desc: 'Call AI (ChatGPT) for text generation' },
    ],
  },
]

// ============ Default params per action ============

function getDefaultParams(action: WorkflowActionType): Record<string, string | number | boolean> {
  switch (action) {
    // Navigation
    case 'go_to_url': return { url: 'https://' }
    case 'new_tab': return { url: '' }
    case 'close_tab': return {}
    case 'active_tab': return { tabIndex: 0 }
    case 'reload': return {}
    case 'back': return {}
    case 'forward': return {}
    case 'get_url': return { saveAs: 'currentUrl' }
    case 'wait_url_changed': return { timeout: 10000 }
    // Mouse
    case 'click': return { xpath: '', timeout: 5000 }
    case 'double_click': return { xpath: '', timeout: 5000 }
    case 'right_click': return { xpath: '', timeout: 5000 }
    case 'hover': return { xpath: '' }
    case 'click_coordinates': return { x: 0, y: 0 }
    case 'drag_and_drop': return { fromXpath: '', toXpath: '' }
    case 'scroll': return { direction: 'down', amount: 300 }
    case 'random_scroll': return { minAmount: 100, maxAmount: 500, direction: 'down' }
    case 'scroll_to_element': return { xpath: '' }
    case 'try_click': return { xpath: '', maxTries: 5, delayMs: 1000 }
    // Keyboard
    case 'type': return { xpath: '', text: '', clearFirst: true }
    case 'key_press': return { key: 'Enter' }
    case 'select_dropdown': return { xpath: '', value: '' }
    case 'file_upload': return { xpath: "//input[@type='file']", filePath: '' }
    // Element
    case 'wait_element': return { xpath: '', timeout: 10000 }
    case 'element_exists': return { xpath: '', saveAs: 'exists', timeout: 3000 }
    case 'get_text': return { xpath: '', saveAs: '' }
    case 'get_attribute': return { xpath: '', attribute: 'href', saveAs: '' }
    case 'count_elements': return { xpath: '', saveAs: '' }
    // Control Flow
    case 'delay': return { ms: 1000 }
    case 'if_condition': return { left: '', operator: '=', right: '' }
    case 'for_loop': return { count: 5, variable: 'i' }
    case 'while_loop': return { condition: '', maxIterations: 100 }
    case 'try_catch': return {}
    case 'break_loop': return {}
    case 'continue_loop': return {}
    // Data & Variables
    case 'set_variable': return { name: '', value: '' }
    case 'increment_variable': return { name: '', amount: 1 }
    case 'math_execute': return { expression: '', saveAs: 'mathResult' }
    case 'random_number': return { min: 1, max: 100, saveAs: 'randomNum' }
    case 'random_text': return { length: 8, charset: 'alphanumeric', saveAs: 'randomText' }
    // Text Operations
    case 'split_text': return { text: '', delimiter: ',', index: 0, saveAs: 'splitResult' }
    case 'regex_extract': return { text: '', pattern: '', group: 0, saveAs: 'regexResult' }
    case 'parse_json': return { json: '', path: '', saveAs: 'jsonValue' }
    // Code & HTTP
    case 'execute_js': return { code: '' }
    case 'http_request': return { method: 'GET', url: '', body: '', headers: '', saveAs: '', useProfileProxy: false }
    case 'http_download': return { url: '', savePath: '' }
    case 'screenshot': return { saveAs: 'screenshot.png' }
    case 'log': return { message: '', level: 'info' }
    // Alert
    case 'accept_alert': return {}
    case 'dismiss_alert': return {}
    // Cookie & Clipboard
    case 'cookie_import': return { cookies: '' }
    case 'cookie_export': return { saveAs: 'cookies' }
    case 'get_clipboard': return { saveAs: 'clipboard' }
    case 'set_clipboard': return { text: '' }
    // Frame & Popup
    case 'switch_to_frame': return { xpath: '//iframe' }
    case 'switch_to_default': return {}
    case 'switch_to_popup': return { title: '' }
    // Advanced
    case 'get_2fa': return { secretKey: '', saveAs: 'code2fa' }
    case 'read_mail_otp': return { email: '', password: '', imapHost: 'imap.gmail.com', searchSubject: '', saveAs: 'otpCode' }
    case 'ai_generate': return { prompt: '', model: 'gpt-3.5-turbo', apiKey: '', saveAs: 'aiResponse' }
    default: return {}
  }
}

function getActionLabel(action: WorkflowActionType): string {
  for (const cat of ACTION_CATEGORIES) {
    const found = cat.actions.find(a => a.type === action)
    if (found) return found.label
  }
  return action
}

function getActionIcon(action: WorkflowActionType) {
  for (const cat of ACTION_CATEGORIES) {
    const found = cat.actions.find(a => a.type === action)
    if (found) return found.icon
  }
  return Zap
}

function getActionColor(action: WorkflowActionType): string {
  for (const cat of ACTION_CATEGORIES) {
    if (cat.actions.find(a => a.type === action)) return cat.color
  }
  return 'text-gray-400'
}

const hasChildren = (action: WorkflowActionType) =>
  ['if_condition', 'for_loop', 'while_loop', 'try_catch'].includes(action)

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

// ============ Step Editor Component ============

function StepEditor({
  step,
  onUpdate,
  onDelete,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  depth = 0,
}: {
  step: WorkflowStep
  onUpdate: (step: WorkflowStep) => void
  onDelete: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate: () => void
  depth?: number
}) {
  const [expanded, setExpanded] = useState(true)
  const [showParams, setShowParams] = useState(false)
  const Icon = getActionIcon(step.action)
  const color = getActionColor(step.action)

  const updateParam = (key: string, value: string | number | boolean) => {
    onUpdate({ ...step, params: { ...step.params, [key]: value } })
  }

  const addChild = (action: WorkflowActionType) => {
    const newStep: WorkflowStep = {
      id: generateId(),
      action,
      label: getActionLabel(action),
      params: getDefaultParams(action),
      enabled: true,
    }
    onUpdate({ ...step, children: [...(step.children || []), newStep] })
  }

  const addElseChild = (action: WorkflowActionType) => {
    const newStep: WorkflowStep = {
      id: generateId(),
      action,
      label: getActionLabel(action),
      params: getDefaultParams(action),
      enabled: true,
    }
    onUpdate({ ...step, elseChildren: [...(step.elseChildren || []), newStep] })
  }

  const updateChild = (index: number, updated: WorkflowStep) => {
    const children = [...(step.children || [])]
    children[index] = updated
    onUpdate({ ...step, children })
  }

  const deleteChild = (index: number) => {
    const children = [...(step.children || [])]
    children.splice(index, 1)
    onUpdate({ ...step, children })
  }

  const updateElseChild = (index: number, updated: WorkflowStep) => {
    const elseChildren = [...(step.elseChildren || [])]
    elseChildren[index] = updated
    onUpdate({ ...step, elseChildren })
  }

  const deleteElseChild = (index: number) => {
    const elseChildren = [...(step.elseChildren || [])]
    elseChildren.splice(index, 1)
    onUpdate({ ...step, elseChildren })
  }

  const paramSummary = () => {
    const p = step.params
    switch (step.action) {
      case 'go_to_url': return p.url ? String(p.url).slice(0, 40) : ''
      case 'click': case 'double_click': case 'right_click': case 'hover':
      case 'wait_element': case 'scroll_to_element': case 'element_exists':
        return p.xpath ? String(p.xpath).slice(0, 40) : ''
      case 'type': return `"${String(p.text || '').slice(0, 20)}" → ${String(p.xpath || '').slice(0, 20)}`
      case 'delay': return `${p.ms}ms`
      case 'set_variable': return `${p.name} = ${String(p.value || '').slice(0, 20)}`
      case 'increment_variable': return `${p.name} += ${p.amount}`
      case 'if_condition': return `${p.left} ${p.operator} ${p.right}`
      case 'for_loop': return `${p.count} times`
      case 'while_loop': return `max ${p.maxIterations}`
      case 'execute_js': return String(p.code || '').slice(0, 30) + '...'
      case 'key_press': return String(p.key || '')
      case 'get_text': return `${String(p.xpath || '').slice(0, 20)} → $${p.saveAs}`
      case 'get_attribute': return `${String(p.attribute || '')} → $${p.saveAs}`
      case 'get_url': return `→ $${p.saveAs}`
      case 'http_request': return `${p.method} ${String(p.url || '').slice(0, 30)}`
      case 'http_download': return String(p.url || '').slice(0, 40)
      case 'log': return String(p.message || '').slice(0, 30)
      case 'click_coordinates': return `(${p.x}, ${p.y})`
      case 'random_number': return `${p.min}-${p.max} → $${p.saveAs}`
      case 'random_text': return `${p.length} chars → $${p.saveAs}`
      case 'split_text': return `"${String(p.delimiter || '')}" [${p.index}] → $${p.saveAs}`
      case 'regex_extract': return `/${String(p.pattern || '').slice(0, 15)}/ → $${p.saveAs}`
      case 'parse_json': return `${String(p.path || '').slice(0, 20)} → $${p.saveAs}`
      case 'math_execute': return `${String(p.expression || '').slice(0, 20)} → $${p.saveAs}`
      case 'get_2fa': return `→ $${p.saveAs}`
      case 'read_mail_otp': return `${String(p.email || '').slice(0, 20)} → $${p.saveAs}`
      case 'ai_generate': return `"${String(p.prompt || '').slice(0, 25)}" → $${p.saveAs}`
      case 'active_tab': return `tab ${p.tabIndex}`
      case 'try_click': return `${String(p.xpath || '').slice(0, 20)} (${p.maxTries}x)`
      case 'set_clipboard': return String(p.text || '').slice(0, 30)
      case 'get_clipboard': return `→ $${p.saveAs}`
      case 'count_elements': return `${String(p.xpath || '').slice(0, 20)} → $${p.saveAs}`
      default: return ''
    }
  }

  return (
    <div
      className={`rounded-lg border mb-1.5 transition-all ${!step.enabled ? 'opacity-40' : ''}`}
      style={{
        marginLeft: depth > 0 ? 16 : 0,
        borderColor: 'var(--border-color)',
        backgroundColor: depth > 0 ? 'rgba(255,255,255,0.02)' : 'var(--bg-surface-2)',
      }}
    >
      {/* Step header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 cursor-pointer" onClick={() => setShowParams(!showParams)}>
        <GripVertical size={12} style={{ color: 'var(--text-muted)' }} className="flex-shrink-0 cursor-grab" />
        {hasChildren(step.action) && (
          <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded) }} className="p-0.5">
            {expanded ? <ChevronDown size={12} style={{ color: 'var(--text-muted)' }} /> : <ChevronRight size={12} style={{ color: 'var(--text-muted)' }} />}
          </button>
        )}
        <Icon size={14} className={`flex-shrink-0 ${color}`} />
        <span className="text-xs font-medium flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{step.label}</span>
        {paramSummary() && (
          <span className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{paramSummary()}</span>
        )}
        <div className="flex-1" />
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {onMoveUp && <button onClick={(e) => { e.stopPropagation(); onMoveUp() }} className="p-0.5 hover:bg-white/10 rounded"><ArrowUp size={10} style={{ color: 'var(--text-muted)' }} /></button>}
          {onMoveDown && <button onClick={(e) => { e.stopPropagation(); onMoveDown() }} className="p-0.5 hover:bg-white/10 rounded"><ArrowDown size={10} style={{ color: 'var(--text-muted)' }} /></button>}
          <button onClick={(e) => { e.stopPropagation(); onDuplicate() }} className="p-0.5 hover:bg-white/10 rounded"><Copy size={10} style={{ color: 'var(--text-muted)' }} /></button>
          <button onClick={(e) => { e.stopPropagation(); onUpdate({ ...step, enabled: !step.enabled }) }} className="p-0.5 hover:bg-white/10 rounded">
            {step.enabled ? <CheckCircle size={10} className="text-emerald-400" /> : <XCircle size={10} className="text-red-400" />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete() }} className="p-0.5 hover:bg-red-500/20 rounded"><Trash2 size={10} className="text-red-400" /></button>
        </div>
      </div>

      {/* Params editor */}
      {showParams && (
        <div className="px-3 pb-2 pt-1 border-t space-y-1.5" style={{ borderColor: 'var(--border-color)' }}>
          {Object.entries(step.params).map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-[10px] font-medium w-24 flex-shrink-0 text-right" style={{ color: 'var(--text-muted)' }}>
                {key}
              </label>
              {typeof val === 'boolean' ? (
                <button
                  onClick={() => updateParam(key, !val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium ${val ? 'bg-emerald-500/20 text-emerald-300' : 'bg-red-500/20 text-red-300'}`}
                >
                  {val ? 'true' : 'false'}
                </button>
              ) : key === 'code' ? (
                <textarea
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border font-mono"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  rows={3}
                />
              ) : key === 'operator' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">&gt;</option>
                  <option value="<">&lt;</option>
                  <option value=">=">≥</option>
                  <option value="<=">≤</option>
                  <option value="contains">contains</option>
                  <option value="!contains">!contains</option>
                  <option value="hasElement">hasElement</option>
                  <option value="!hasElement">!hasElement</option>
                </select>
              ) : key === 'method' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="GET">GET</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="DELETE">DELETE</option>
                </select>
              ) : key === 'direction' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                  <option value="top">To Top</option>
                  <option value="bottom">To Bottom</option>
                </select>
              ) : key === 'level' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="error">Error</option>
                </select>
              ) : key === 'key' && step.action === 'key_press' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="Enter">Enter</option>
                  <option value="Tab">Tab</option>
                  <option value="Escape">Escape</option>
                  <option value="Backspace">Backspace</option>
                  <option value="Delete">Delete</option>
                  <option value="ArrowUp">Arrow Up</option>
                  <option value="ArrowDown">Arrow Down</option>
                  <option value="ArrowLeft">Arrow Left</option>
                  <option value="ArrowRight">Arrow Right</option>
                  <option value="Space">Space</option>
                  <option value="Home">Home</option>
                  <option value="End">End</option>
                  <option value="PageUp">Page Up</option>
                  <option value="PageDown">Page Down</option>
                  <option value="F5">F5</option>
                  <option value="Ctrl+A">Ctrl+A (Select All)</option>
                  <option value="Ctrl+C">Ctrl+C (Copy)</option>
                  <option value="Ctrl+V">Ctrl+V (Paste)</option>
                </select>
              ) : key === 'charset' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="alphanumeric">Alphanumeric</option>
                  <option value="alpha">Letters only</option>
                  <option value="numeric">Numbers only</option>
                  <option value="hex">Hexadecimal</option>
                  <option value="email">Email-friendly</option>
                </select>
              ) : key === 'model' ? (
                <select
                  value={String(val)}
                  onChange={(e) => updateParam(key, e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                >
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="gpt-4o-mini">GPT-4o Mini</option>
                  <option value="gpt-4o">GPT-4o</option>
                </select>
              ) : (
                <input
                  type={typeof val === 'number' ? 'number' : 'text'}
                  value={String(val)}
                  onChange={(e) => updateParam(key, typeof val === 'number' ? Number(e.target.value) : e.target.value)}
                  className="flex-1 px-2 py-1 rounded text-xs border"
                  style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  placeholder={key}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Children (for control flow blocks) */}
      {hasChildren(step.action) && expanded && (
        <div className="px-2 pb-2">
          {/* Then block */}
          <div className="ml-2 border-l-2 pl-2" style={{ borderColor: 'rgba(99, 102, 241, 0.3)' }}>
            <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
              {step.action === 'if_condition' ? 'Then' : step.action === 'try_catch' ? 'Try' : 'Do'}
            </span>
            {(step.children || []).map((child, i) => (
              <StepEditor
                key={child.id}
                step={child}
                onUpdate={(u) => updateChild(i, u)}
                onDelete={() => deleteChild(i)}
                onMoveUp={i > 0 ? () => {
                  const arr = [...(step.children || [])]
                  ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
                  onUpdate({ ...step, children: arr })
                } : undefined}
                onMoveDown={i < (step.children || []).length - 1 ? () => {
                  const arr = [...(step.children || [])]
                  ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
                  onUpdate({ ...step, children: arr })
                } : undefined}
                onDuplicate={() => {
                  const dup = { ...child, id: generateId() }
                  onUpdate({ ...step, children: [...(step.children || []), dup] })
                }}
                depth={depth + 1}
              />
            ))}
            <AddStepButton onAdd={(action) => addChild(action)} compact />
          </div>

          {/* Else block (only for if_condition) */}
          {(step.action === 'if_condition' || step.action === 'try_catch') && (
            <div className="ml-2 border-l-2 pl-2 mt-1" style={{ borderColor: 'rgba(239, 68, 68, 0.3)' }}>
              <span className="text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                {step.action === 'try_catch' ? 'Catch' : 'Else'}
              </span>
              {(step.elseChildren || []).map((child, i) => (
                <StepEditor
                  key={child.id}
                  step={child}
                  onUpdate={(u) => updateElseChild(i, u)}
                  onDelete={() => deleteElseChild(i)}
                  onMoveUp={i > 0 ? () => {
                    const arr = [...(step.elseChildren || [])]
                    ;[arr[i - 1], arr[i]] = [arr[i], arr[i - 1]]
                    onUpdate({ ...step, elseChildren: arr })
                  } : undefined}
                  onMoveDown={i < (step.elseChildren || []).length - 1 ? () => {
                    const arr = [...(step.elseChildren || [])]
                    ;[arr[i], arr[i + 1]] = [arr[i + 1], arr[i]]
                    onUpdate({ ...step, elseChildren: arr })
                  } : undefined}
                  onDuplicate={() => {
                    const dup = { ...child, id: generateId() }
                    onUpdate({ ...step, elseChildren: [...(step.elseChildren || []), dup] })
                  }}
                  depth={depth + 1}
                />
              ))}
              <AddStepButton onAdd={(action) => addElseChild(action)} compact />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ============ Add Step Button ============

function AddStepButton({ onAdd, compact }: { onAdd: (action: WorkflowActionType) => void; compact?: boolean }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = ACTION_CATEGORIES.map(cat => ({
    ...cat,
    actions: cat.actions.filter(a =>
      a.label.toLowerCase().includes(search.toLowerCase()) ||
      a.desc.toLowerCase().includes(search.toLowerCase())
    ),
  })).filter(cat => cat.actions.length > 0)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1.5 text-xs'} rounded-lg border border-dashed hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors`}
        style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
      >
        <Plus size={compact ? 10 : 12} />
        Add Step
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute left-0 top-full mt-1 z-50 w-72 rounded-xl border shadow-xl overflow-hidden"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}
          >
            <div className="p-2 border-b" style={{ borderColor: 'var(--border-color)' }}>
              <input
                type="text"
                placeholder="Search actions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg text-xs border"
                style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                autoFocus
              />
            </div>
            <div className="max-h-64 overflow-y-auto p-1">
              {filtered.map((cat) => (
                <div key={cat.label}>
                  <div className="px-2 py-1 text-[10px] font-semibold uppercase" style={{ color: 'var(--text-muted)' }}>
                    {cat.label}
                  </div>
                  {cat.actions.map((a) => {
                    const ActionIcon = a.icon
                    return (
                      <button
                        key={a.type}
                        onClick={() => { onAdd(a.type); setOpen(false); setSearch('') }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 text-left"
                      >
                        <ActionIcon size={12} className={cat.color} />
                        <div>
                          <div className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{a.label}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ============ Built-in Templates ============

const BUILT_IN_TEMPLATES: Omit<Workflow, 'id'>[] = [
  {
    name: 'Login Website',
    description: 'Navigate to URL, wait for login form, enter credentials, submit',
    category: 'social-media',
    variables: [
      { name: 'url', type: 'string', label: 'Login URL', defaultValue: 'https://', required: true },
      { name: 'email', type: 'string', label: 'Email/Username', defaultValue: '', required: true },
      { name: 'password', type: 'secret', label: 'Password', defaultValue: '', required: true },
    ],
    steps: [
      { id: '1', action: 'go_to_url', label: 'Go to URL', params: { url: '${url}' }, enabled: true },
      { id: '2', action: 'wait_element', label: 'Wait Element', params: { xpath: "//input[@type='email' or @type='text' or @name='email' or @name='username']", timeout: 10000 }, enabled: true },
      { id: '3', action: 'type', label: 'Type Text', params: { xpath: "//input[@type='email' or @type='text' or @name='email' or @name='username']", text: '${email}', clearFirst: true }, enabled: true },
      { id: '4', action: 'click', label: 'Click', params: { xpath: "//button[contains(text(), 'Next') or contains(text(), 'Continue') or @type='submit']", timeout: 5000 }, enabled: true },
      { id: '5', action: 'delay', label: 'Delay', params: { ms: 2000 }, enabled: true },
      { id: '6', action: 'wait_element', label: 'Wait Element', params: { xpath: "//input[@type='password']", timeout: 10000 }, enabled: true },
      { id: '7', action: 'type', label: 'Type Text', params: { xpath: "//input[@type='password']", text: '${password}', clearFirst: true }, enabled: true },
      { id: '8', action: 'click', label: 'Click', params: { xpath: "//button[contains(text(), 'Sign in') or contains(text(), 'Log in') or @type='submit']", timeout: 5000 }, enabled: true },
      { id: '9', action: 'delay', label: 'Delay', params: { ms: 3000 }, enabled: true },
      { id: '10', action: 'screenshot', label: 'Screenshot', params: { saveAs: 'login_result.png' }, enabled: true },
    ],
  },
  {
    name: 'Check IP Address',
    description: 'Open ipinfo.io and get current IP address',
    category: 'testing',
    variables: [],
    steps: [
      { id: '1', action: 'go_to_url', label: 'Go to URL', params: { url: 'https://ipinfo.io/json' }, enabled: true },
      { id: '2', action: 'delay', label: 'Delay', params: { ms: 2000 }, enabled: true },
      { id: '3', action: 'get_text', label: 'Get Text', params: { xpath: '//pre', saveAs: 'ipInfo' }, enabled: true },
      { id: '4', action: 'log', label: 'Log', params: { message: 'IP Info: ${ipInfo}', level: 'info' }, enabled: true },
    ],
  },
  {
    name: 'Farm Engagement',
    description: 'Visit list of URLs and interact (like, comment)',
    category: 'social-media',
    variables: [
      { name: 'count', type: 'number', label: 'Number of iterations', defaultValue: '10', required: true },
      { name: 'comment', type: 'string', label: 'Comment text', defaultValue: '', required: false },
    ],
    steps: [
      { id: '1', action: 'for_loop', label: 'For Loop', params: { count: 10, variable: 'i' }, enabled: true, children: [
        { id: '1a', action: 'delay', label: 'Delay', params: { ms: 2000 }, enabled: true },
        { id: '1b', action: 'random_scroll', label: 'Random Scroll', params: { minAmount: 200, maxAmount: 800, direction: 'down' }, enabled: true },
        { id: '1c', action: 'delay', label: 'Delay', params: { ms: 1000 }, enabled: true },
      ]},
    ],
  },
  {
    name: 'Register Account',
    description: 'Navigate to registration page, fill form, submit',
    category: 'social-media',
    variables: [
      { name: 'url', type: 'string', label: 'Registration URL', defaultValue: 'https://', required: true },
      { name: 'username', type: 'string', label: 'Username', defaultValue: '', required: true },
      { name: 'email', type: 'string', label: 'Email', defaultValue: '', required: true },
      { name: 'password', type: 'secret', label: 'Password', defaultValue: '', required: true },
    ],
    steps: [
      { id: '1', action: 'go_to_url', label: 'Go to URL', params: { url: '${url}' }, enabled: true },
      { id: '2', action: 'delay', label: 'Delay', params: { ms: 2000 }, enabled: true },
      { id: '3', action: 'wait_element', label: 'Wait Element', params: { xpath: "//input[@name='username' or @name='user' or @id='username']", timeout: 10000 }, enabled: true },
      { id: '4', action: 'type', label: 'Type Username', params: { xpath: "//input[@name='username' or @name='user' or @id='username']", text: '${username}', clearFirst: true }, enabled: true },
      { id: '5', action: 'type', label: 'Type Email', params: { xpath: "//input[@type='email' or @name='email']", text: '${email}', clearFirst: true }, enabled: true },
      { id: '6', action: 'type', label: 'Type Password', params: { xpath: "//input[@type='password']", text: '${password}', clearFirst: true }, enabled: true },
      { id: '7', action: 'click', label: 'Submit', params: { xpath: "//button[@type='submit' or contains(text(), 'Sign up') or contains(text(), 'Register')]", timeout: 5000 }, enabled: true },
      { id: '8', action: 'delay', label: 'Wait', params: { ms: 3000 }, enabled: true },
      { id: '9', action: 'screenshot', label: 'Screenshot', params: { saveAs: 'register_result.png' }, enabled: true },
    ],
  },
  {
    name: 'Cookie Backup & Restore',
    description: 'Export cookies, save to variable, import later',
    category: 'testing',
    variables: [],
    steps: [
      { id: '1', action: 'cookie_export', label: 'Export Cookies', params: { saveAs: 'myCookies' }, enabled: true },
      { id: '2', action: 'log', label: 'Log', params: { message: 'Cookies exported: ${myCookies}', level: 'info' }, enabled: true },
    ],
  },
  {
    name: 'Login with 2FA',
    description: 'Login with email/password + TOTP 2FA code',
    category: 'social-media',
    variables: [
      { name: 'url', type: 'string', label: 'Login URL', defaultValue: 'https://', required: true },
      { name: 'email', type: 'string', label: 'Email', defaultValue: '', required: true },
      { name: 'password', type: 'secret', label: 'Password', defaultValue: '', required: true },
      { name: 'totpSecret', type: 'secret', label: '2FA Secret Key', defaultValue: '', required: true },
    ],
    steps: [
      { id: '1', action: 'go_to_url', label: 'Go to URL', params: { url: '${url}' }, enabled: true },
      { id: '2', action: 'wait_element', label: 'Wait Email', params: { xpath: "//input[@type='email' or @name='email']", timeout: 10000 }, enabled: true },
      { id: '3', action: 'type', label: 'Type Email', params: { xpath: "//input[@type='email' or @name='email']", text: '${email}', clearFirst: true }, enabled: true },
      { id: '4', action: 'click', label: 'Next', params: { xpath: "//button[@type='submit' or contains(text(), 'Next')]", timeout: 5000 }, enabled: true },
      { id: '5', action: 'delay', label: 'Wait', params: { ms: 2000 }, enabled: true },
      { id: '6', action: 'type', label: 'Type Password', params: { xpath: "//input[@type='password']", text: '${password}', clearFirst: true }, enabled: true },
      { id: '7', action: 'click', label: 'Sign In', params: { xpath: "//button[@type='submit' or contains(text(), 'Sign in')]", timeout: 5000 }, enabled: true },
      { id: '8', action: 'delay', label: 'Wait', params: { ms: 3000 }, enabled: true },
      { id: '9', action: 'get_2fa', label: 'Generate 2FA', params: { secretKey: '${totpSecret}', saveAs: 'code2fa' }, enabled: true },
      { id: '10', action: 'type', label: 'Type 2FA Code', params: { xpath: "//input[@name='totp' or @name='code' or @type='tel']", text: '${code2fa}', clearFirst: true }, enabled: true },
      { id: '11', action: 'click', label: 'Verify', params: { xpath: "//button[@type='submit' or contains(text(), 'Verify')]", timeout: 5000 }, enabled: true },
      { id: '12', action: 'delay', label: 'Wait', params: { ms: 3000 }, enabled: true },
      { id: '13', action: 'screenshot', label: 'Screenshot', params: { saveAs: '2fa_login_result.png' }, enabled: true },
    ],
  },
  {
    name: 'Scrape Page Data',
    description: 'Navigate to page, extract text/links, save to variables',
    category: 'data-entry',
    variables: [
      { name: 'url', type: 'string', label: 'Target URL', defaultValue: 'https://', required: true },
    ],
    steps: [
      { id: '1', action: 'go_to_url', label: 'Go to URL', params: { url: '${url}' }, enabled: true },
      { id: '2', action: 'delay', label: 'Wait load', params: { ms: 3000 }, enabled: true },
      { id: '3', action: 'get_url', label: 'Get URL', params: { saveAs: 'pageUrl' }, enabled: true },
      { id: '4', action: 'execute_js', label: 'Get title', params: { code: 'document.title' }, enabled: true },
      { id: '5', action: 'get_text', label: 'Get body text', params: { xpath: '//body', saveAs: 'bodyText' }, enabled: true },
      { id: '6', action: 'count_elements', label: 'Count links', params: { xpath: '//a', saveAs: 'linkCount' }, enabled: true },
      { id: '7', action: 'log', label: 'Log results', params: { message: 'URL: ${pageUrl}, Links: ${linkCount}', level: 'info' }, enabled: true },
      { id: '8', action: 'screenshot', label: 'Screenshot', params: { saveAs: 'scrape_result.png' }, enabled: true },
    ],
  },
]

// ============ Main Page Component ============

export default function WorkflowsPage() {
  const [view, setView] = useState<'list' | 'editor'>('list')
  const [savedWorkflows, setSavedWorkflows] = useState<SavedWorkflow[]>([])
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [executing, setExecuting] = useState(false)
  const [executions, setExecutions] = useState<Execution[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  // Editor state
  const [workflow, setWorkflow] = useState<Workflow>({
    name: '',
    description: '',
    category: 'other',
    variables: [],
    steps: [],
  })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [selectedProfileId, setSelectedProfileId] = useState('')
  const [showTemplates, setShowTemplates] = useState(false)
  const [showVariables, setShowVariables] = useState(false)
  const [executionLogs, setExecutionLogs] = useState<string[]>([])
  const [showLogs, setShowLogs] = useState(false)

  // Fetch data
  const fetchWorkflows = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/templates')
      const data = await res.json()
      if (data.success) setSavedWorkflows(data.templates || [])
    } catch { /* ignore */ } finally { setLoading(false) }
  }, [])

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/profiles')
      const data = await res.json()
      if (data.success) {
        setProfiles(data.profiles || [])
        const running = (data.profiles || []).filter((p: Profile) => p.status === 'running')
        if (running.length > 0 && !selectedProfileId) setSelectedProfileId(running[0].id)
      }
    } catch { /* ignore */ }
  }, [selectedProfileId])

  const fetchExecutions = useCallback(async () => {
    try {
      const res = await fetch('/api/automation/executions?limit=20')
      const data = await res.json()
      if (data.success) setExecutions(data.executions || [])
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { fetchWorkflows(); fetchProfiles(); fetchExecutions() }, [fetchWorkflows, fetchProfiles, fetchExecutions])

  // Add step to workflow
  const addStep = (action: WorkflowActionType) => {
    const newStep: WorkflowStep = {
      id: generateId(),
      action,
      label: getActionLabel(action),
      params: getDefaultParams(action),
      enabled: true,
      ...(hasChildren(action) ? { children: [] } : {}),
      ...((action === 'if_condition' || action === 'try_catch') ? { elseChildren: [] } : {}),
    }
    setWorkflow(prev => ({ ...prev, steps: [...prev.steps, newStep] }))
  }

  const updateStep = (index: number, updated: WorkflowStep) => {
    setWorkflow(prev => {
      const steps = [...prev.steps]
      steps[index] = updated
      return { ...prev, steps }
    })
  }

  const deleteStep = (index: number) => {
    setWorkflow(prev => {
      const steps = [...prev.steps]
      steps.splice(index, 1)
      return { ...prev, steps }
    })
  }

  const moveStep = (index: number, direction: 'up' | 'down') => {
    setWorkflow(prev => {
      const steps = [...prev.steps]
      const newIndex = direction === 'up' ? index - 1 : index + 1
      if (newIndex < 0 || newIndex >= steps.length) return prev
      ;[steps[index], steps[newIndex]] = [steps[newIndex], steps[index]]
      return { ...prev, steps }
    })
  }

  const duplicateStep = (index: number) => {
    setWorkflow(prev => {
      const steps = [...prev.steps]
      const dup = JSON.parse(JSON.stringify(steps[index]))
      dup.id = generateId()
      steps.splice(index + 1, 0, dup)
      return { ...prev, steps }
    })
  }

  // Save workflow
  const saveWorkflow = async () => {
    if (!workflow.name.trim()) {
      alert('Please enter a workflow name')
      return
    }
    setSaving(true)
    try {
      const body = {
        name: workflow.name,
        description: workflow.description,
        category: workflow.category,
        actions: workflow.steps,
        variables: workflow.variables,
      }

      let res: Response
      if (editingId) {
        res = await fetch(`/api/automation/templates/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch('/api/automation/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      }
      const data = await res.json()
      if (data.success) {
        await fetchWorkflows()
        setView('list')
        setEditingId(null)
        resetEditor()
      } else {
        alert('Save failed: ' + data.error)
      }
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : 'Unknown error'))
    } finally { setSaving(false) }
  }

  // Execute workflow
  const executeWorkflow = async (templateId: string) => {
    if (!selectedProfileId) {
      alert('Please select a profile first')
      return
    }
    setExecuting(true)
    setShowLogs(true)
    setExecutionLogs(['Starting execution...'])
    try {
      const res = await fetch(`/api/automation/templates/${templateId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: selectedProfileId, variables: {} }),
      })
      const data = await res.json()
      if (data.success) {
        setExecutionLogs(prev => [...prev, `Execution started: ${data.execution.id}`])
        // Poll for updates
        const pollInterval = setInterval(async () => {
          try {
            const exRes = await fetch(`/api/automation/executions/${data.execution.id}`)
            const exData = await exRes.json()
            if (exData.success && exData.execution) {
              const ex = exData.execution
              if (ex.logsJson) {
                const logs = JSON.parse(ex.logsJson)
                setExecutionLogs(logs.map((l: { message: string; level: string }) => `[${l.level}] ${l.message}`))
              }
              if (ex.status === 'completed' || ex.status === 'failed') {
                clearInterval(pollInterval)
                setExecuting(false)
                setExecutionLogs(prev => [...prev, `Status: ${ex.status}${ex.error ? ' - ' + ex.error : ''}`])
                fetchExecutions()
              }
            }
          } catch { /* ignore */ }
        }, 2000)
      } else {
        setExecutionLogs(prev => [...prev, `Error: ${data.error}`])
        setExecuting(false)
      }
    } catch (e) {
      setExecutionLogs(prev => [...prev, `Error: ${e instanceof Error ? e.message : 'Unknown'}`])
      setExecuting(false)
    }
  }

  // Load workflow for editing
  const loadWorkflow = (saved: SavedWorkflow) => {
    const steps = JSON.parse(saved.actionsJson) as WorkflowStep[]
    const variables = saved.variablesJson ? JSON.parse(saved.variablesJson) as WorkflowVariable[] : []
    setWorkflow({
      id: saved.id,
      name: saved.name,
      description: saved.description || '',
      category: saved.category,
      variables,
      steps,
    })
    setEditingId(saved.id)
    setView('editor')
  }

  // Load template
  const loadTemplate = (template: Omit<Workflow, 'id'>) => {
    setWorkflow({
      ...template,
      steps: JSON.parse(JSON.stringify(template.steps)),
      variables: JSON.parse(JSON.stringify(template.variables)),
    })
    setEditingId(null)
    setView('editor')
    setShowTemplates(false)
  }

  // Delete workflow
  const deleteWorkflow = async (id: string) => {
    if (!confirm('Delete this workflow?')) return
    try {
      const res = await fetch(`/api/automation/templates/${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (data.success) fetchWorkflows()
    } catch { /* ignore */ }
  }

  // Export workflow as JSON
  const exportWorkflow = () => {
    const json = JSON.stringify(workflow, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflow.name || 'workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Import workflow from JSON
  const importWorkflow = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text) as Workflow
        if (data.steps && data.name) {
          setWorkflow(data)
          setEditingId(null)
          setView('editor')
        } else {
          alert('Invalid workflow file')
        }
      } catch { alert('Invalid JSON file') }
    }
    input.click()
  }

  const resetEditor = () => {
    setWorkflow({ name: '', description: '', category: 'other', variables: [], steps: [] })
    setEditingId(null)
  }

  // Add variable
  const addVariable = () => {
    setWorkflow(prev => ({
      ...prev,
      variables: [...prev.variables, {
        name: `var${prev.variables.length + 1}`,
        type: 'string',
        label: `Variable ${prev.variables.length + 1}`,
        defaultValue: '',
        required: false,
      }],
    }))
  }

  const updateVariable = (index: number, updated: WorkflowVariable) => {
    setWorkflow(prev => {
      const variables = [...prev.variables]
      variables[index] = updated
      return { ...prev, variables }
    })
  }

  const deleteVariable = (index: number) => {
    setWorkflow(prev => {
      const variables = [...prev.variables]
      variables.splice(index, 1)
      return { ...prev, variables }
    })
  }

  const filteredWorkflows = savedWorkflows.filter(w =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (w.description || '').toLowerCase().includes(searchTerm.toLowerCase())
  )

  // Skeleton loading
  if (loading) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="h-8 w-48 rounded-lg animate-pulse" style={{ backgroundColor: 'var(--bg-surface-2)' }} />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--bg-surface)' }} />)}
        </div>
      </div>
    )
  }

  // ============ LIST VIEW ============
  if (view === 'list') {
    return (
      <div className="space-y-5 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Workflows</h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Build and execute browser automation workflows
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={importWorkflow}>
              <Upload size={14} /> Import
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowTemplates(true)}>
              <FileText size={14} /> Templates
            </Button>
            <a href="/workflows/visual">
              <Button size="sm" variant="secondary">
                <Sparkles size={14} /> Visual Builder
              </Button>
            </a>
            <Button size="sm" onClick={() => { resetEditor(); setView('editor') }}>
              <Plus size={14} /> New Workflow
            </Button>
          </div>
        </div>

        {/* Profile selector */}
        <Card>
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Execute on:</label>
            <select
              value={selectedProfileId}
              onChange={(e) => setSelectedProfileId(e.target.value)}
              className="px-3 py-1.5 rounded-lg text-xs border flex-1 min-w-[200px]"
              style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="">Select a running profile...</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.status}) {p.remoteDebuggingPort ? `- port ${p.remoteDebuggingPort}` : ''}
                </option>
              ))}
            </select>
            <Button size="sm" variant="ghost" onClick={fetchProfiles}>
              <Repeat size={12} /> Refresh
            </Button>
          </div>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
          <input
            type="text"
            placeholder="Search workflows..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-xs border"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          />
        </div>

        {/* Workflow list */}
        {filteredWorkflows.length === 0 ? (
          <Card>
            <div className="text-center py-8">
              <Zap size={32} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>No workflows yet</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Create a new workflow or use a template to get started</p>
              <div className="flex items-center justify-center gap-2 mt-3">
                <Button size="sm" onClick={() => { resetEditor(); setView('editor') }}>
                  <Plus size={12} /> New Workflow
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setShowTemplates(true)}>
                  <FileText size={12} /> Templates
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filteredWorkflows.map(w => {
              const steps = JSON.parse(w.actionsJson)
              return (
                <Card key={w.id} className="hover:border-indigo-500/30 transition-colors cursor-pointer" padding={false}>
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{w.name}</h3>
                        {w.description && (
                          <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{w.description}</p>
                        )}
                      </div>
                      <Badge variant="default">{w.category}</Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
                      <span>{Array.isArray(steps) ? steps.length : 0} steps</span>
                      <span>Used {w.usageCount}x</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-3">
                      <Button size="sm" onClick={() => executeWorkflow(w.id)} disabled={!selectedProfileId || executing}>
                        {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                        Run
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => loadWorkflow(w)}>
                        <Settings size={12} /> Edit
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => deleteWorkflow(w.id)}>
                        <Trash2 size={12} />
                      </Button>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}

        {/* Recent executions */}
        {executions.length > 0 && (
          <Card>
            <CardHeader title="Recent Executions" description="Last 20 workflow runs" />
            <div className="space-y-1">
              {executions.slice(0, 10).map(ex => (
                <div key={ex.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg text-xs" style={{ backgroundColor: 'var(--bg-surface-2)' }}>
                  {ex.status === 'completed' && <CheckCircle size={12} className="text-emerald-400" />}
                  {ex.status === 'failed' && <XCircle size={12} className="text-red-400" />}
                  {ex.status === 'running' && <Loader2 size={12} className="text-yellow-400 animate-spin" />}
                  {ex.status === 'pending' && <Clock size={12} style={{ color: 'var(--text-muted)' }} />}
                  <span style={{ color: 'var(--text-primary)' }}>{ex.id.slice(0, 8)}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{ex.status}</span>
                  {ex.duration && <span style={{ color: 'var(--text-muted)' }}>{(ex.duration / 1000).toFixed(1)}s</span>}
                  {ex.error && <span className="text-red-400 truncate flex-1">{ex.error}</span>}
                  <span className="ml-auto" style={{ color: 'var(--text-muted)' }}>
                    {ex.startedAt ? new Date(ex.startedAt).toLocaleTimeString() : ''}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Templates modal */}
        {showTemplates && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg mx-4 rounded-xl border shadow-xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Workflow Templates</h3>
                <button onClick={() => setShowTemplates(false)} className="p-1 hover:bg-white/10 rounded"><X size={14} /></button>
              </div>
              <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
                {BUILT_IN_TEMPLATES.map((t, i) => (
                  <div
                    key={i}
                    className="p-3 rounded-lg border cursor-pointer hover:border-indigo-500/30 transition-colors"
                    style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-surface-2)' }}
                    onClick={() => loadTemplate(t)}
                  >
                    <h4 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</h4>
                    <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge variant="default">{t.category}</Badge>
                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.steps.length} steps</span>
                      {t.variables.length > 0 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{t.variables.length} variables</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Execution logs modal */}
        {showLogs && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
            <div className="w-full max-w-lg mx-0 sm:mx-4 rounded-t-xl sm:rounded-xl border shadow-xl" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-color)' }}>
              <div className="flex items-center justify-between p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
                <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Execution Logs {executing && <Loader2 size={12} className="inline animate-spin ml-1" />}
                </h3>
                <button onClick={() => setShowLogs(false)} className="p-1 hover:bg-white/10 rounded"><X size={14} /></button>
              </div>
              <div className="p-3 max-h-64 overflow-y-auto font-mono text-[10px] space-y-0.5" style={{ color: 'var(--text-secondary)' }}>
                {executionLogs.map((log, i) => (
                  <div key={i} className={log.includes('[error]') ? 'text-red-400' : log.includes('[warning]') ? 'text-yellow-400' : ''}>
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ============ EDITOR VIEW ============
  return (
    <div className="space-y-4 animate-fade-in">
      {/* Editor header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => { setView('list'); resetEditor() }}>
            ← Back
          </Button>
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
            {editingId ? 'Edit Workflow' : 'New Workflow'}
          </h1>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={exportWorkflow}>
            <Download size={12} /> Export JSON
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowVariables(!showVariables)}>
            <Variable size={12} /> Variables ({workflow.variables.length})
          </Button>
          <Button size="sm" onClick={saveWorkflow} loading={saving}>
            <Save size={12} /> Save
          </Button>
          {editingId && (
            <Button size="sm" onClick={() => executeWorkflow(editingId)} disabled={!selectedProfileId || executing}>
              {executing ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
              Run
            </Button>
          )}
        </div>
      </div>

      {/* Workflow metadata */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Name</label>
            <input
              type="text"
              value={workflow.name}
              onChange={(e) => setWorkflow(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs border mt-1"
              style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="Workflow name"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Description</label>
            <input
              type="text"
              value={workflow.description}
              onChange={(e) => setWorkflow(prev => ({ ...prev, description: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs border mt-1"
              style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
              placeholder="Description"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>Category</label>
            <select
              value={workflow.category}
              onChange={(e) => setWorkflow(prev => ({ ...prev, category: e.target.value }))}
              className="w-full px-3 py-1.5 rounded-lg text-xs border mt-1"
              style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
            >
              <option value="social-media">Social Media</option>
              <option value="e-commerce">E-Commerce</option>
              <option value="data-entry">Data Entry</option>
              <option value="testing">Testing</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Variables panel */}
      {showVariables && (
        <Card>
          <CardHeader
            title="Variables"
            description="Define input variables for this workflow"
            action={
              <Button size="sm" variant="secondary" onClick={addVariable}>
                <Plus size={12} /> Add
              </Button>
            }
          />
          {workflow.variables.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              No variables. Use variables like {'${varName}'} in step parameters.
            </p>
          ) : (
            <div className="space-y-2">
              {workflow.variables.map((v, i) => (
                <div key={i} className="flex items-center gap-2 flex-wrap">
                  <input
                    type="text"
                    value={v.name}
                    onChange={(e) => updateVariable(i, { ...v, name: e.target.value })}
                    className="px-2 py-1 rounded text-xs border w-28"
                    style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="name"
                  />
                  <select
                    value={v.type}
                    onChange={(e) => updateVariable(i, { ...v, type: e.target.value as WorkflowVariable['type'] })}
                    className="px-2 py-1 rounded text-xs border"
                    style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                  >
                    <option value="string">String</option>
                    <option value="number">Number</option>
                    <option value="boolean">Boolean</option>
                    <option value="secret">Secret</option>
                  </select>
                  <input
                    type="text"
                    value={v.label}
                    onChange={(e) => updateVariable(i, { ...v, label: e.target.value })}
                    className="px-2 py-1 rounded text-xs border flex-1 min-w-[120px]"
                    style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="Label"
                  />
                  <input
                    type="text"
                    value={v.defaultValue}
                    onChange={(e) => updateVariable(i, { ...v, defaultValue: e.target.value })}
                    className="px-2 py-1 rounded text-xs border w-32"
                    style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    placeholder="Default"
                  />
                  <button
                    onClick={() => updateVariable(i, { ...v, required: !v.required })}
                    className={`px-2 py-0.5 rounded text-[10px] font-medium ${v.required ? 'bg-red-500/20 text-red-300' : 'bg-white/5 text-gray-400'}`}
                  >
                    {v.required ? 'Required' : 'Optional'}
                  </button>
                  <button onClick={() => deleteVariable(i)} className="p-1 hover:bg-red-500/20 rounded">
                    <Trash2 size={12} className="text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Steps editor */}
      <Card>
        <CardHeader
          title={`Steps (${workflow.steps.length})`}
          description="Add and configure workflow actions"
        />

        {workflow.steps.length === 0 ? (
          <div className="text-center py-6">
            <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No steps yet. Add actions to build your workflow.</p>
          </div>
        ) : (
          <div className="space-y-0">
            {workflow.steps.map((step, i) => (
              <StepEditor
                key={step.id}
                step={step}
                onUpdate={(u) => updateStep(i, u)}
                onDelete={() => deleteStep(i)}
                onMoveUp={i > 0 ? () => moveStep(i, 'up') : undefined}
                onMoveDown={i < workflow.steps.length - 1 ? () => moveStep(i, 'down') : undefined}
                onDuplicate={() => duplicateStep(i)}
              />
            ))}
          </div>
        )}

        <div className="mt-3">
          <AddStepButton onAdd={addStep} />
        </div>
      </Card>

      {/* Profile selector for execution */}
      <Card>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Execute on:</label>
          <select
            value={selectedProfileId}
            onChange={(e) => setSelectedProfileId(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-xs border flex-1 min-w-[200px]"
            style={{ backgroundColor: 'var(--bg-page)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
          >
            <option value="">Select a running profile...</option>
            {profiles.map(p => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.status}) {p.remoteDebuggingPort ? `- port ${p.remoteDebuggingPort}` : ''}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {/* Execution logs */}
      {showLogs && (
        <Card>
          <CardHeader title="Execution Logs" action={
            <button onClick={() => setShowLogs(false)} className="p-1 hover:bg-white/10 rounded"><X size={14} /></button>
          } />
          <div className="font-mono text-[10px] space-y-0.5 max-h-48 overflow-y-auto" style={{ color: 'var(--text-secondary)' }}>
            {executionLogs.map((log, i) => (
              <div key={i} className={log.includes('[error]') ? 'text-red-400' : log.includes('[warning]') ? 'text-yellow-400' : ''}>
                {log}
              </div>
            ))}
            {executing && <Loader2 size={12} className="animate-spin text-indigo-400" />}
          </div>
        </Card>
      )}
    </div>
  )
}
