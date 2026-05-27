'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  Panel,
  Handle,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
  MarkerType,
  Position,
  useReactFlow,
  ReactFlowProvider,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Plus, Play, Save, Download, Upload, Trash2, Search,
  Globe, MousePointer, Keyboard, Clock, Eye, GitBranch,
  Repeat, Variable, FileText, Zap, Code, Image, Shield,
  AlertTriangle, CheckCircle, XCircle, ExternalLink,
  Copy, ChevronDown, ChevronRight, Loader2, X,
  ArrowLeft, Sparkles, Settings, GripVertical, Mail,
  ArrowDown, ArrowUp,
  Circle, Square, Pause,
} from 'lucide-react'

// ============ Types ============

type ActionType =
  | 'go_to_url' | 'new_tab' | 'close_tab' | 'reload' | 'back' | 'forward' | 'wait_url_changed' | 'get_url' | 'active_tab'
  | 'click' | 'double_click' | 'right_click' | 'hover' | 'scroll' | 'try_click'
  | 'click_coordinates' | 'drag_and_drop' | 'random_scroll' | 'scroll_to_element'
  | 'type' | 'key_press' | 'select_dropdown' | 'file_upload'
  | 'wait_element' | 'get_text' | 'get_attribute' | 'count_elements' | 'element_exists'
  | 'delay' | 'if_condition' | 'for_loop' | 'while_loop' | 'break_loop' | 'continue_loop' | 'try_catch'
  | 'set_variable' | 'increment_variable' | 'math_execute' | 'random_number' | 'random_text'
  | 'split_text' | 'regex_extract' | 'parse_json'
  | 'execute_js' | 'http_request' | 'http_download'
  | 'screenshot' | 'log'
  | 'accept_alert' | 'dismiss_alert'
  | 'cookie_import' | 'cookie_export'
  | 'get_clipboard' | 'set_clipboard'
  | 'switch_to_frame' | 'switch_to_default' | 'switch_to_popup'
  | 'get_2fa' | 'read_mail_otp'
  | 'ai_generate'
  | 'start' | 'end'

interface ActionMeta {
  type: ActionType
  label: string
  icon: React.ElementType
  desc: string
  color: string
  category: string
}

// ============ Action Registry ============

const ACTIONS: ActionMeta[] = [
  // Start/End
  { type: 'start', label: 'Start', icon: Play, desc: 'Workflow start', color: '#22c55e', category: 'Flow' },
  { type: 'end', label: 'End', icon: XCircle, desc: 'Workflow end', color: '#ef4444', category: 'Flow' },
  // Navigation
  { type: 'go_to_url', label: 'Go to URL', icon: Globe, desc: 'Navigate to URL', color: '#3b82f6', category: 'Navigation' },
  { type: 'new_tab', label: 'New Tab', icon: Plus, desc: 'Open new tab', color: '#3b82f6', category: 'Navigation' },
  { type: 'close_tab', label: 'Close Tab', icon: X, desc: 'Close tab', color: '#3b82f6', category: 'Navigation' },
  { type: 'active_tab', label: 'Switch Tab', icon: ExternalLink, desc: 'Switch tab by index', color: '#3b82f6', category: 'Navigation' },
  { type: 'reload', label: 'Reload', icon: Repeat, desc: 'Reload page', color: '#3b82f6', category: 'Navigation' },
  { type: 'back', label: 'Back', icon: ArrowUp, desc: 'Go back', color: '#3b82f6', category: 'Navigation' },
  { type: 'forward', label: 'Forward', icon: ArrowDown, desc: 'Go forward', color: '#3b82f6', category: 'Navigation' },
  { type: 'get_url', label: 'Get URL', icon: Globe, desc: 'Get current URL', color: '#3b82f6', category: 'Navigation' },
  { type: 'wait_url_changed', label: 'Wait URL Change', icon: Clock, desc: 'Wait URL change', color: '#3b82f6', category: 'Navigation' },
  // Mouse
  { type: 'click', label: 'Click', icon: MousePointer, desc: 'Click element', color: '#22c55e', category: 'Mouse' },
  { type: 'double_click', label: 'Double Click', icon: MousePointer, desc: 'Double click', color: '#22c55e', category: 'Mouse' },
  { type: 'right_click', label: 'Right Click', icon: MousePointer, desc: 'Right click', color: '#22c55e', category: 'Mouse' },
  { type: 'hover', label: 'Hover', icon: MousePointer, desc: 'Hover element', color: '#22c55e', category: 'Mouse' },
  { type: 'click_coordinates', label: 'Click XY', icon: MousePointer, desc: 'Click at coordinates', color: '#22c55e', category: 'Mouse' },
  { type: 'drag_and_drop', label: 'Drag & Drop', icon: GripVertical, desc: 'Drag and drop', color: '#22c55e', category: 'Mouse' },
  { type: 'scroll', label: 'Scroll', icon: ArrowDown, desc: 'Scroll page', color: '#22c55e', category: 'Mouse' },
  { type: 'random_scroll', label: 'Random Scroll', icon: ArrowDown, desc: 'Random scroll', color: '#22c55e', category: 'Mouse' },
  { type: 'scroll_to_element', label: 'Scroll to Element', icon: Eye, desc: 'Scroll into view', color: '#22c55e', category: 'Mouse' },
  { type: 'try_click', label: 'Try Click', icon: Repeat, desc: 'Retry click', color: '#22c55e', category: 'Mouse' },
  // Keyboard
  { type: 'type', label: 'Type Text', icon: Keyboard, desc: 'Type into element', color: '#eab308', category: 'Keyboard' },
  { type: 'key_press', label: 'Key Press', icon: Keyboard, desc: 'Press key', color: '#eab308', category: 'Keyboard' },
  { type: 'select_dropdown', label: 'Select Dropdown', icon: ChevronDown, desc: 'Select option', color: '#eab308', category: 'Keyboard' },
  { type: 'file_upload', label: 'File Upload', icon: Upload, desc: 'Upload file', color: '#eab308', category: 'Keyboard' },
  // Element
  { type: 'wait_element', label: 'Wait Element', icon: Clock, desc: 'Wait for element', color: '#a855f7', category: 'Element' },
  { type: 'element_exists', label: 'Element Exists', icon: Eye, desc: 'Check if exists', color: '#a855f7', category: 'Element' },
  { type: 'get_text', label: 'Get Text', icon: FileText, desc: 'Get text content', color: '#a855f7', category: 'Element' },
  { type: 'get_attribute', label: 'Get Attribute', icon: Code, desc: 'Get attribute', color: '#a855f7', category: 'Element' },
  { type: 'count_elements', label: 'Count Elements', icon: Eye, desc: 'Count matches', color: '#a855f7', category: 'Element' },
  // Control Flow
  { type: 'if_condition', label: 'If / Else', icon: GitBranch, desc: 'Conditional branch', color: '#f97316', category: 'Control Flow' },
  { type: 'for_loop', label: 'For Loop', icon: Repeat, desc: 'Loop N times', color: '#f97316', category: 'Control Flow' },
  { type: 'while_loop', label: 'While Loop', icon: Repeat, desc: 'Loop while true', color: '#f97316', category: 'Control Flow' },
  { type: 'try_catch', label: 'Try / Catch', icon: Shield, desc: 'Error handling', color: '#f97316', category: 'Control Flow' },
  { type: 'break_loop', label: 'Break', icon: X, desc: 'Exit loop', color: '#f97316', category: 'Control Flow' },
  { type: 'continue_loop', label: 'Continue', icon: Repeat, desc: 'Skip iteration', color: '#f97316', category: 'Control Flow' },
  { type: 'delay', label: 'Delay', icon: Clock, desc: 'Wait time', color: '#f97316', category: 'Control Flow' },
  // Data
  { type: 'set_variable', label: 'Set Variable', icon: Variable, desc: 'Set value', color: '#06b6d4', category: 'Data' },
  { type: 'increment_variable', label: 'Increment', icon: Plus, desc: 'Increase value', color: '#06b6d4', category: 'Data' },
  { type: 'math_execute', label: 'Math', icon: Code, desc: 'Math expression', color: '#06b6d4', category: 'Data' },
  { type: 'random_number', label: 'Random Number', icon: Zap, desc: 'Generate random', color: '#06b6d4', category: 'Data' },
  { type: 'random_text', label: 'Random Text', icon: FileText, desc: 'Random string', color: '#06b6d4', category: 'Data' },
  // Text
  { type: 'split_text', label: 'Split Text', icon: FileText, desc: 'Split by delimiter', color: '#14b8a6', category: 'Text' },
  { type: 'regex_extract', label: 'Regex Extract', icon: Code, desc: 'Regex match', color: '#14b8a6', category: 'Text' },
  { type: 'parse_json', label: 'Parse JSON', icon: Code, desc: 'Extract from JSON', color: '#14b8a6', category: 'Text' },
  // Code & HTTP
  { type: 'execute_js', label: 'Execute JS', icon: Code, desc: 'Run JavaScript', color: '#6366f1', category: 'Code & HTTP' },
  { type: 'http_request', label: 'HTTP Request', icon: Globe, desc: 'Send HTTP request', color: '#6366f1', category: 'Code & HTTP' },
  { type: 'http_download', label: 'HTTP Download', icon: Download, desc: 'Download file', color: '#6366f1', category: 'Code & HTTP' },
  { type: 'screenshot', label: 'Screenshot', icon: Image, desc: 'Capture screen', color: '#6366f1', category: 'Code & HTTP' },
  { type: 'log', label: 'Log', icon: FileText, desc: 'Log message', color: '#6366f1', category: 'Code & HTTP' },
  // Alert
  { type: 'accept_alert', label: 'Accept Alert', icon: CheckCircle, desc: 'Accept dialog', color: '#f59e0b', category: 'Alert' },
  { type: 'dismiss_alert', label: 'Dismiss Alert', icon: XCircle, desc: 'Dismiss dialog', color: '#f59e0b', category: 'Alert' },
  // Cookie & Clipboard
  { type: 'cookie_import', label: 'Import Cookie', icon: Download, desc: 'Import cookies', color: '#e11d48', category: 'Cookie & Clipboard' },
  { type: 'cookie_export', label: 'Export Cookie', icon: Upload, desc: 'Export cookies', color: '#e11d48', category: 'Cookie & Clipboard' },
  { type: 'get_clipboard', label: 'Get Clipboard', icon: Copy, desc: 'Read clipboard', color: '#e11d48', category: 'Cookie & Clipboard' },
  { type: 'set_clipboard', label: 'Set Clipboard', icon: Copy, desc: 'Write clipboard', color: '#e11d48', category: 'Cookie & Clipboard' },
  // Frame & Popup
  { type: 'switch_to_frame', label: 'Switch Frame', icon: ExternalLink, desc: 'Switch to iframe', color: '#0ea5e9', category: 'Frame & Popup' },
  { type: 'switch_to_default', label: 'Default Frame', icon: ExternalLink, desc: 'Switch to main', color: '#0ea5e9', category: 'Frame & Popup' },
  { type: 'switch_to_popup', label: 'Switch Popup', icon: ExternalLink, desc: 'Switch to popup', color: '#0ea5e9', category: 'Frame & Popup' },
  // Advanced
  { type: 'get_2fa', label: '2FA Code', icon: Shield, desc: 'Generate TOTP', color: '#ec4899', category: 'Advanced' },
  { type: 'read_mail_otp', label: 'Read Mail OTP', icon: Mail, desc: 'Read email OTP', color: '#ec4899', category: 'Advanced' },
  { type: 'ai_generate', label: 'AI Chat', icon: Sparkles, desc: 'AI text generation', color: '#ec4899', category: 'Advanced' },
]

const ACTION_MAP = new Map(ACTIONS.map(a => [a.type, a]))

function getActionMeta(type: ActionType): ActionMeta {
  return ACTION_MAP.get(type) || { type, label: type, icon: Zap, desc: '', color: '#888', category: 'Unknown' }
}

function getDefaultParams(type: ActionType): Record<string, string | number | boolean> {
  switch (type) {
    case 'go_to_url': return { url: 'https://' }
    case 'new_tab': return { url: '' }
    case 'active_tab': return { tabIndex: 0 }
    case 'get_url': return { saveAs: 'currentUrl' }
    case 'wait_url_changed': return { timeout: 10000 }
    case 'click': case 'double_click': case 'right_click': return { xpath: '', timeout: 5000 }
    case 'hover': return { xpath: '' }
    case 'click_coordinates': return { x: 0, y: 0 }
    case 'drag_and_drop': return { fromXpath: '', toXpath: '' }
    case 'scroll': return { direction: 'down', amount: 300 }
    case 'random_scroll': return { minAmount: 100, maxAmount: 500, direction: 'down' }
    case 'scroll_to_element': return { xpath: '' }
    case 'try_click': return { xpath: '', maxTries: 5, delayMs: 1000 }
    case 'type': return { xpath: '', text: '', clearFirst: true }
    case 'key_press': return { key: 'Enter' }
    case 'select_dropdown': return { xpath: '', value: '' }
    case 'file_upload': return { xpath: "//input[@type='file']", filePath: '' }
    case 'wait_element': return { xpath: '', timeout: 10000 }
    case 'element_exists': return { xpath: '', saveAs: 'exists', timeout: 3000 }
    case 'get_text': return { xpath: '', saveAs: '' }
    case 'get_attribute': return { xpath: '', attribute: 'href', saveAs: '' }
    case 'count_elements': return { xpath: '', saveAs: '' }
    case 'delay': return { ms: 1000 }
    case 'if_condition': return { left: '', operator: '==', right: '' }
    case 'for_loop': return { count: 5, variable: 'i' }
    case 'while_loop': return { condition: '', maxIterations: 100 }
    case 'set_variable': return { name: '', value: '' }
    case 'increment_variable': return { name: '', amount: 1 }
    case 'math_execute': return { expression: '', saveAs: 'mathResult' }
    case 'random_number': return { min: 1, max: 100, saveAs: 'randomNum' }
    case 'random_text': return { length: 8, charset: 'alphanumeric', saveAs: 'randomText' }
    case 'split_text': return { text: '', delimiter: ',', index: 0, saveAs: 'splitResult' }
    case 'regex_extract': return { text: '', pattern: '', group: 0, saveAs: 'regexResult' }
    case 'parse_json': return { json: '', path: '', saveAs: 'jsonValue' }
    case 'execute_js': return { code: '' }
    case 'http_request': return { method: 'GET', url: '', body: '', saveAs: '' }
    case 'http_download': return { url: '', savePath: '' }
    case 'screenshot': return { saveAs: 'screenshot.png' }
    case 'log': return { message: '', level: 'info' }
    case 'cookie_import': return { cookies: '' }
    case 'cookie_export': return { saveAs: 'cookies' }
    case 'get_clipboard': return { saveAs: 'clipboard' }
    case 'set_clipboard': return { text: '' }
    case 'switch_to_frame': return { xpath: '//iframe' }
    case 'switch_to_popup': return { title: '' }
    case 'get_2fa': return { secretKey: '', saveAs: 'code2fa' }
    case 'read_mail_otp': return { email: '', password: '', imapHost: 'imap.gmail.com', searchSubject: '', saveAs: 'otpCode' }
    case 'ai_generate': return { prompt: '', model: 'gpt-4o-mini', apiKey: '', saveAs: 'aiResponse' }
    default: return {}
  }
}

// ============ Custom Node ============

function ActionNode({ data, selected }: { data: { actionType: ActionType; label: string; params: Record<string, unknown> }; selected: boolean }) {
  const meta = getActionMeta(data.actionType)
  const Icon = meta.icon
  const isFlow = data.actionType === 'start' || data.actionType === 'end'
  const isBranch = data.actionType === 'if_condition'

  const summary = useMemo(() => {
    const p = data.params
    switch (data.actionType) {
      case 'go_to_url': return String(p.url || '').slice(0, 30)
      case 'click': case 'double_click': case 'hover': case 'wait_element':
        return String(p.xpath || '').slice(0, 25)
      case 'type': return `"${String(p.text || '').slice(0, 15)}" → xpath`
      case 'delay': return `${p.ms}ms`
      case 'set_variable': return `$${p.name}`
      case 'if_condition': return `${p.left} ${p.operator} ${p.right}`
      case 'for_loop': return `${p.count}x`
      case 'log': return String(p.message || '').slice(0, 25)
      case 'execute_js': return String(p.code || '').slice(0, 20) + '...'
      default: return ''
    }
  }, [data.actionType, data.params])

  return (
    <div
      className={`rounded-xl border-2 shadow-lg transition-all ${selected ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#1a1a2e]' : ''}`}
      style={{
        borderColor: meta.color,
        backgroundColor: '#1e1e32',
        minWidth: isFlow ? 100 : 180,
        maxWidth: 220,
      }}
    >
      {/* Target handle (top) — not on start node */}
      {data.actionType !== 'start' && (
        <Handle
          type="target"
          position={Position.Top}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-indigo-300 hover:!bg-indigo-400 !-top-1.5"
        />
      )}
      {/* Header */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ backgroundColor: meta.color + '20' }}
      >
        <Icon size={14} style={{ color: meta.color }} />
        <span className="text-xs font-semibold text-white truncate">{data.label}</span>
      </div>
      {/* Summary */}
      {summary && !isFlow && (
        <div className="px-3 py-1.5 text-[10px] text-gray-400 truncate border-t" style={{ borderColor: meta.color + '30' }}>
          {summary}
        </div>
      )}
      {/* Branch labels for if_condition */}
      {isBranch && (
        <div className="flex justify-between px-3 py-1 text-[9px]">
          <span className="text-emerald-400">True</span>
          <span className="text-red-400">False</span>
        </div>
      )}
      {/* Source handle (bottom) — not on end node */}
      {data.actionType !== 'end' && (
        <Handle
          type="source"
          position={Position.Bottom}
          className="!w-3 !h-3 !bg-indigo-500 !border-2 !border-indigo-300 hover:!bg-indigo-400 !-bottom-1.5"
        />
      )}
    </div>
  )
}

// ============ Node Sidebar ============

function NodeSidebar({ onDragStart }: { onDragStart: (e: React.DragEvent, type: ActionType) => void }) {
  const [search, setSearch] = useState('')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})

  const categories = useMemo(() => {
    const cats: Record<string, ActionMeta[]> = {}
    for (const a of ACTIONS) {
      if (a.type === 'start' || a.type === 'end') continue
      if (search && !a.label.toLowerCase().includes(search.toLowerCase()) && !a.desc.toLowerCase().includes(search.toLowerCase())) continue
      if (!cats[a.category]) cats[a.category] = []
      cats[a.category].push(a)
    }
    return cats
  }, [search])

  return (
    <div className="w-56 border-r flex flex-col" style={{ borderColor: 'var(--border-color)', backgroundColor: '#12121f' }}>
      <div className="p-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <h3 className="text-xs font-bold text-white mb-2">Actions</h3>
        <div className="relative">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white placeholder-gray-500"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {Object.entries(categories).map(([cat, actions]) => (
          <div key={cat}>
            <button
              onClick={() => setCollapsed(p => ({ ...p, [cat]: !p[cat] }))}
              className="flex items-center gap-1 w-full px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase hover:text-white"
            >
              {collapsed[cat] ? <ChevronRight size={10} /> : <ChevronDown size={10} />}
              {cat} ({actions.length})
            </button>
            {!collapsed[cat] && (
              <div className="space-y-0.5 ml-1">
                {actions.map((a) => {
                  const AIcon = a.icon
                  return (
                    <div
                      key={a.type}
                      draggable
                      onDragStart={(e) => onDragStart(e, a.type)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-grab hover:bg-white/5 active:cursor-grabbing transition-colors"
                    >
                      <AIcon size={12} style={{ color: a.color }} />
                      <div className="min-w-0">
                        <div className="text-[11px] text-white truncate">{a.label}</div>
                        <div className="text-[9px] text-gray-500 truncate">{a.desc}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ Properties Panel ============

function PropertiesPanel({
  node,
  onUpdate,
  onDelete,
}: {
  node: Node | null
  onUpdate: (id: string, params: Record<string, unknown>) => void
  onDelete: (id: string) => void
}) {
  if (!node) {
    return (
      <div className="w-64 border-l flex items-center justify-center" style={{ borderColor: 'var(--border-color)', backgroundColor: '#12121f' }}>
        <div className="text-center text-gray-500">
          <Settings size={24} className="mx-auto mb-2" />
          <p className="text-xs">Select a node to edit</p>
        </div>
      </div>
    )
  }

  const actionType = node.data.actionType as ActionType
  const meta = getActionMeta(actionType)
  const Icon = meta.icon
  const params = (node.data.params || {}) as Record<string, string | number | boolean>

  const updateParam = (key: string, value: string | number | boolean) => {
    onUpdate(node.id, { ...params, [key]: value })
  }

  const isFlow = actionType === 'start' || actionType === 'end'

  return (
    <div className="w-64 border-l flex flex-col" style={{ borderColor: 'var(--border-color)', backgroundColor: '#12121f' }}>
      <div className="p-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--border-color)' }}>
        <Icon size={14} style={{ color: meta.color }} />
        <span className="text-xs font-bold text-white flex-1">{meta.label}</span>
        {!isFlow && (
          <button
            onClick={() => onDelete(node.id)}
            className="p-1 hover:bg-red-500/20 rounded transition-colors"
          >
            <Trash2 size={12} className="text-red-400" />
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {/* Node label */}
        <div>
          <label className="text-[10px] font-medium text-gray-400 uppercase">Label</label>
          <input
            type="text"
            value={String(node.data.label || '')}
            onChange={(e) => onUpdate(node.id, { ...params, __label: e.target.value })}
            className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
          />
        </div>
        {/* Params */}
        {!isFlow && Object.entries(params).filter(([k]) => !k.startsWith('__')).map(([key, val]) => (
          <div key={key}>
            <label className="text-[10px] font-medium text-gray-400 uppercase">{key}</label>
            {typeof val === 'boolean' ? (
              <button
                onClick={() => updateParam(key, !val)}
                className={`mt-1 w-full px-2 py-1.5 rounded-lg text-xs font-medium ${val ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' : 'bg-red-500/20 text-red-300 border-red-500/30'} border`}
              >
                {val ? 'true' : 'false'}
              </button>
            ) : key === 'code' || key === 'body' || key === 'cookies' || key === 'json' ? (
              <textarea
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white font-mono"
                rows={3}
              />
            ) : key === 'operator' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['==', '!=', '>', '<', '>=', '<=', 'contains', '!contains', 'hasElement', '!hasElement'].map(o => (
                  <option key={o} value={o}>{o}</option>
                ))}
              </select>
            ) : key === 'method' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : key === 'direction' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['down', 'up', 'top', 'bottom'].map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            ) : key === 'level' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['info', 'warning', 'error'].map(l => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            ) : key === 'model' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['gpt-3.5-turbo', 'gpt-4o-mini', 'gpt-4o'].map(m => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : key === 'charset' ? (
              <select
                value={String(val)}
                onChange={(e) => updateParam(key, e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
              >
                {['alphanumeric', 'alpha', 'numeric', 'hex', 'email'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            ) : (
              <input
                type={typeof val === 'number' ? 'number' : 'text'}
                value={String(val)}
                onChange={(e) => updateParam(key, typeof val === 'number' ? Number(e.target.value) : e.target.value)}
                className="w-full mt-1 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white"
                placeholder={key}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ============ AI Prompt Bar ============

function AIPromptBar({ onGenerate }: { onGenerate: (prompt: string) => void }) {
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    if (!prompt.trim() || loading) return
    setLoading(true)
    try {
      await onGenerate(prompt)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Sparkles size={14} className="text-indigo-400 flex-shrink-0" />
      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        placeholder="Describe your workflow... (e.g. &quot;Login to x.com, scroll and like 5 posts&quot;)"
        className="flex-1 px-3 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white placeholder-gray-500"
      />
      <button
        onClick={handleSubmit}
        disabled={loading || !prompt.trim()}
        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 flex items-center gap-1"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
        Generate
      </button>
    </div>
  )
}

// ============ Recorder Bar ============

interface RecorderBarProps {
  onStepsImported: (steps: Array<{ action: string; label: string; params: Record<string, unknown> }>) => void
}

function RecorderBar({ onStepsImported }: RecorderBarProps) {
  const [status, setStatus] = useState<'idle' | 'recording' | 'paused' | 'loading'>('idle')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [debugPort, setDebugPort] = useState('')
  const [actionCount, setActionCount] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startRecording = async () => {
    if (!debugPort.trim()) {
      alert('Enter the CDP debug port of the browser to record')
      return
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/recorder/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debugPort: parseInt(debugPort) }),
      })
      const data = await res.json()
      if (data.sessionId) {
        setSessionId(data.sessionId)
        setStatus('recording')
        setActionCount(0)
        // Poll for action count
        pollRef.current = setInterval(async () => {
          try {
            const r = await fetch(`/api/recorder/status?sessionId=${data.sessionId}`)
            const d = await r.json()
            setActionCount(d.actionCount ?? 0)
          } catch { /* ignore */ }
        }, 2000)
      } else {
        alert('Failed to start recording: ' + (data.error || 'Unknown'))
        setStatus('idle')
      }
    } catch (e) {
      alert('Failed: ' + (e instanceof Error ? e.message : 'Unknown'))
      setStatus('idle')
    }
  }

  const stopRecording = async () => {
    if (!sessionId) return
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStatus('loading')
    try {
      const res = await fetch('/api/recorder/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      })
      const data = await res.json()
      if (data.steps && data.steps.length > 0) {
        onStepsImported(data.steps)
      }
      setStatus('idle')
      setSessionId(null)
      setActionCount(0)
    } catch (e) {
      alert('Failed: ' + (e instanceof Error ? e.message : 'Unknown'))
      setStatus('idle')
    }
  }

  const pauseRecording = async () => {
    if (!sessionId) return
    await fetch('/api/recorder/pause', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setStatus('paused')
  }

  const resumeRecording = async () => {
    if (!sessionId) return
    await fetch('/api/recorder/resume', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    })
    setStatus('recording')
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  if (status === 'idle') {
    return (
      <div className="flex items-center gap-2">
        <div className="w-px h-5 bg-gray-700" />
        <input
          type="text"
          value={debugPort}
          onChange={(e) => setDebugPort(e.target.value)}
          placeholder="CDP Port"
          className="w-20 px-2 py-1.5 rounded-lg text-xs border bg-[#1a1a2e] border-gray-700 text-white placeholder-gray-500"
        />
        <button
          onClick={startRecording}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-500 text-white flex items-center gap-1"
        >
          <Circle size={10} fill="currentColor" /> Record
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <div className="w-px h-5 bg-gray-700" />
      {status === 'recording' && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-xs text-red-400 font-medium">REC</span>
          <span className="text-xs text-gray-400">{actionCount} actions</span>
        </div>
      )}
      {status === 'paused' && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 bg-yellow-500 rounded-full" />
          <span className="text-xs text-yellow-400 font-medium">PAUSED</span>
          <span className="text-xs text-gray-400">{actionCount} actions</span>
        </div>
      )}
      {status === 'loading' && (
        <Loader2 size={12} className="text-gray-400 animate-spin" />
      )}
      {status === 'recording' && (
        <button onClick={pauseRecording} className="p-1.5 rounded-lg hover:bg-white/10 text-yellow-400" title="Pause">
          <Pause size={12} />
        </button>
      )}
      {status === 'paused' && (
        <button onClick={resumeRecording} className="p-1.5 rounded-lg hover:bg-white/10 text-green-400" title="Resume">
          <Play size={12} />
        </button>
      )}
      {(status === 'recording' || status === 'paused') && (
        <button onClick={stopRecording} className="p-1.5 rounded-lg hover:bg-white/10 text-red-400" title="Stop & Import">
          <Square size={12} fill="currentColor" />
        </button>
      )}
    </div>
  )
}

// ============ Main Visual Builder ============

let nodeIdCounter = 0
function nextNodeId() { return `node_${++nodeIdCounter}_${Date.now()}` }

const nodeTypes: NodeTypes = {
  action: ActionNode,
}

function VisualBuilderInner() {
  const reactFlowInstance = useReactFlow()
  const reactFlowWrapper = useRef<HTMLDivElement>(null)

  const [nodes, setNodes] = useState<Node[]>([
    {
      id: 'start',
      type: 'action',
      position: { x: 300, y: 50 },
      data: { actionType: 'start', label: 'Start', params: {} },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    },
    {
      id: 'end',
      type: 'action',
      position: { x: 300, y: 400 },
      data: { actionType: 'end', label: 'End', params: {} },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    },
  ])
  const [edges, setEdges] = useState<Edge[]>([])
  const [selectedNode, setSelectedNode] = useState<Node | null>(null)
  const [workflowName, setWorkflowName] = useState('')
  const [workflowDesc, setWorkflowDesc] = useState('')

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)),
    [],
  )
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)),
    [],
  )
  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge({
      ...params,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
    }, eds)),
    [],
  )

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNode(node)
  }, [])

  const onPaneClick = useCallback(() => {
    setSelectedNode(null)
  }, [])

  // Drag & drop from sidebar
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      const actionType = e.dataTransfer.getData('application/reactflow') as ActionType
      if (!actionType) return

      const reactFlowBounds = reactFlowWrapper.current?.getBoundingClientRect()
      if (!reactFlowBounds) return

      const position = reactFlowInstance.screenToFlowPosition({
        x: e.clientX - reactFlowBounds.left,
        y: e.clientY - reactFlowBounds.top,
      })

      const meta = getActionMeta(actionType)
      const newNodeId = nextNodeId()
      const newNode: Node = {
        id: newNodeId,
        type: 'action',
        position,
        data: {
          actionType,
          label: meta.label,
          params: getDefaultParams(actionType),
        },
        sourcePosition: Position.Bottom,
        targetPosition: Position.Top,
      }
      setNodes((nds) => [...nds, newNode])

      // Auto-connect: find the nearest node above the drop position that has no outgoing edge
      setEdges((eds) => {
        const sourcesWithEdges = new Set(eds.map(e => e.source))
        const candidates = nodes
          .filter(n => !sourcesWithEdges.has(n.id) && n.data.actionType !== 'end')
          .filter(n => n.position.y < position.y)
          .sort((a, b) => {
            const distA = Math.hypot(a.position.x - position.x, a.position.y - position.y)
            const distB = Math.hypot(b.position.x - position.x, b.position.y - position.y)
            return distA - distB
          })
        const nearest = candidates[0]
        if (nearest) {
          const newEdge: Edge = {
            id: `e_${nearest.id}_${newNodeId}`,
            source: nearest.id,
            target: newNodeId,
            animated: true,
            style: { stroke: '#6366f1', strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
          }
          return [...eds, newEdge]
        }
        return eds
      })
    },
    [reactFlowInstance, nodes],
  )

  const onDragStart = useCallback((e: React.DragEvent, type: ActionType) => {
    e.dataTransfer.setData('application/reactflow', type)
    e.dataTransfer.effectAllowed = 'move'
  }, [])

  // Update node params from properties panel
  const onUpdateNode = useCallback((id: string, params: Record<string, unknown>) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id !== id) return n
        const label = params.__label !== undefined ? String(params.__label) : n.data.label
        const cleanParams = { ...params }
        delete cleanParams.__label
        return { ...n, data: { ...n.data, label, params: cleanParams } }
      })
    )
    setSelectedNode((prev) => {
      if (!prev || prev.id !== id) return prev
      const label = params.__label !== undefined ? String(params.__label) : prev.data.label
      const cleanParams = { ...params }
      delete cleanParams.__label
      return { ...prev, data: { ...prev.data, label, params: cleanParams } }
    })
  }, [])

  const onDeleteNode = useCallback((id: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== id))
    setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id))
    setSelectedNode(null)
  }, [])

  // Export to JSON (compatible with original workflow format)
  const exportWorkflow = useCallback(() => {
    const sortedNodes = topologicalSort(nodes, edges)
    const steps = sortedNodes
      .filter(n => n.data.actionType !== 'start' && n.data.actionType !== 'end')
      .map((n, i) => ({
        id: String(i + 1),
        action: n.data.actionType,
        label: n.data.label,
        params: n.data.params || {},
        enabled: true,
      }))

    const workflow = {
      name: workflowName || 'Untitled Workflow',
      description: workflowDesc,
      category: 'other',
      variables: [],
      steps,
      visual: { nodes: nodes.map(n => ({ id: n.id, position: n.position, data: n.data })), edges },
    }

    const blob = new Blob([JSON.stringify(workflow, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${workflowName || 'workflow'}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [nodes, edges, workflowName, workflowDesc])

  // Import from JSON
  const importWorkflow = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      const text = await file.text()
      try {
        const data = JSON.parse(text)
        if (data.visual?.nodes && data.visual?.edges) {
          setNodes(data.visual.nodes.map((n: Node) => ({ ...n, type: 'action', sourcePosition: Position.Bottom, targetPosition: Position.Top })))
          setEdges(data.visual.edges)
        } else if (data.steps) {
          const imported = stepsToNodes(data.steps)
          setNodes(imported.nodes)
          setEdges(imported.edges)
        }
        setWorkflowName(data.name || '')
        setWorkflowDesc(data.description || '')
      } catch { alert('Invalid workflow file') }
    }
    input.click()
  }, [])

  // Save to server
  const saveWorkflow = useCallback(async () => {
    if (!workflowName.trim()) {
      alert('Please enter a workflow name')
      return
    }
    const sortedNodes = topologicalSort(nodes, edges)
    const steps = sortedNodes
      .filter(n => n.data.actionType !== 'start' && n.data.actionType !== 'end')
      .map((n, i) => ({
        id: String(i + 1),
        action: n.data.actionType,
        label: n.data.label,
        params: n.data.params || {},
        enabled: true,
      }))

    try {
      const res = await fetch('/api/automation/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: workflowName,
          description: workflowDesc,
          category: 'other',
          actions: steps,
          variables: [],
        }),
      })
      const data = await res.json()
      if (data.success) alert('Workflow saved!')
      else alert('Save failed: ' + data.error)
    } catch (e) {
      alert('Save failed: ' + (e instanceof Error ? e.message : 'Unknown'))
    }
  }, [nodes, edges, workflowName, workflowDesc])

  // AI Generate workflow
  const onAIGenerate = useCallback(async (prompt: string) => {
    const actionList = ACTIONS
      .filter(a => a.type !== 'start' && a.type !== 'end')
      .map(a => `${a.type}: ${a.desc}`)
      .join('\n')

    const systemPrompt = `You are a browser automation workflow generator. Given a user's description, generate a workflow as a JSON array of steps.

Available actions:
${actionList}

Each step format: { "action": "<action_type>", "label": "<display_label>", "params": { ... } }

Common params:
- go_to_url: { url: string }
- click: { xpath: string, timeout: number }
- type: { xpath: string, text: string, clearFirst: boolean }
- wait_element: { xpath: string, timeout: number }
- delay: { ms: number }
- for_loop: { count: number, variable: string }
- if_condition: { left: string, operator: string, right: string }
- set_variable: { name: string, value: string }
- get_text: { xpath: string, saveAs: string }
- screenshot: { saveAs: string }
- log: { message: string, level: string }
- scroll: { direction: string, amount: number }
- random_scroll: { minAmount: number, maxAmount: number, direction: string }
- key_press: { key: string }
- get_2fa: { secretKey: string, saveAs: string }

Use variables with \${varName} syntax. Generate practical, realistic XPath selectors.
Return ONLY a JSON array of steps, no explanation.`

    try {
      const res = await fetch('/api/ai/generate-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, systemPrompt }),
      })
      const data = await res.json()
      if (data.steps) {
        const imported = stepsToNodes(data.steps)
        setNodes(imported.nodes)
        setEdges(imported.edges)
      } else {
        alert('AI generation failed: ' + (data.error || 'No steps returned'))
      }
    } catch (e) {
      alert('AI generation failed: ' + (e instanceof Error ? e.message : 'Unknown'))
    }
  }, [])

  return (
    <div className="flex h-[calc(100vh-80px)]">
      {/* Left sidebar - node palette */}
      <NodeSidebar onDragStart={onDragStart} />

      {/* Center - canvas */}
      <div className="flex-1 flex flex-col">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border-color)', backgroundColor: '#12121f' }}>
          <a href="/workflows" className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft size={14} className="text-gray-400" />
          </a>
          <input
            type="text"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="Workflow name..."
            className="px-2 py-1 rounded text-sm font-semibold bg-transparent border-none text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg w-48"
          />
          <input
            type="text"
            value={workflowDesc}
            onChange={(e) => setWorkflowDesc(e.target.value)}
            placeholder="Description..."
            className="px-2 py-1 rounded text-xs bg-transparent border-none text-gray-400 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-indigo-500 rounded-lg flex-1"
          />
          <div className="flex items-center gap-1">
            <button onClick={importWorkflow} className="px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 flex items-center gap-1">
              <Upload size={12} /> Import
            </button>
            <button onClick={exportWorkflow} className="px-2 py-1.5 rounded-lg text-xs text-gray-300 hover:bg-white/10 flex items-center gap-1">
              <Download size={12} /> Export
            </button>
            <button onClick={saveWorkflow} className="px-2 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 hover:bg-indigo-500 text-white flex items-center gap-1">
              <Save size={12} /> Save
            </button>
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1" ref={reactFlowWrapper}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            nodeTypes={nodeTypes}
            fitView
            snapToGrid
            snapGrid={[20, 20]}
            defaultEdgeOptions={{
              animated: true,
              style: { stroke: '#6366f1', strokeWidth: 2 },
              markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
            }}
            style={{ backgroundColor: '#0f0f1a' }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#333" gap={20} size={1} />
            <Controls
              style={{ backgroundColor: '#1e1e32', borderColor: '#333', borderRadius: 8 }}
            />
            <MiniMap
              style={{ backgroundColor: '#1a1a2e', borderRadius: 8 }}
              nodeColor={(n) => getActionMeta(n.data?.actionType as ActionType).color}
              maskColor="rgba(0,0,0,0.7)"
            />
            <Panel position="top-center">
              <div className="px-3 py-1.5 rounded-lg text-[10px] text-gray-500" style={{ backgroundColor: '#1e1e32' }}>
                Drag actions from sidebar → Drag from handle (dot) to connect nodes → Click node to edit
              </div>
            </Panel>
          </ReactFlow>
        </div>

        {/* AI Prompt Bar + Recorder Bar */}
        <div className="flex items-center gap-2 px-3 py-1.5 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: '#12121f' }}>
          <div className="flex-1">
            <AIPromptBar onGenerate={onAIGenerate} />
          </div>
          <RecorderBar
            onStepsImported={(steps) => {
              const imported = stepsToNodes(steps)
              setNodes((prev) => [...prev, ...imported.nodes.map(n => ({
                ...n,
                position: { x: n.position.x + (prev.length * 20), y: n.position.y + (prev.length * 20) },
              }))])
              setEdges((prev) => [...prev, ...imported.edges])
            }}
          />
        </div>
      </div>

      {/* Right sidebar - properties */}
      <PropertiesPanel
        node={selectedNode}
        onUpdate={onUpdateNode}
        onDelete={onDeleteNode}
      />
    </div>
  )
}

// ============ Helpers ============

function topologicalSort(nodes: Node[], edges: Edge[]): Node[] {
  const nodeMap = new Map(nodes.map(n => [n.id, n]))
  const adj = new Map<string, string[]>()
  const inDeg = new Map<string, number>()

  for (const n of nodes) {
    adj.set(n.id, [])
    inDeg.set(n.id, 0)
  }
  for (const e of edges) {
    adj.get(e.source)?.push(e.target)
    inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1)
  }

  const queue: string[] = []
  for (const [id, deg] of inDeg) {
    if (deg === 0) queue.push(id)
  }

  const sorted: Node[] = []
  while (queue.length) {
    const id = queue.shift()!
    const node = nodeMap.get(id)
    if (node) sorted.push(node)
    for (const neighbor of adj.get(id) || []) {
      const newDeg = (inDeg.get(neighbor) || 0) - 1
      inDeg.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }
  return sorted
}

function stepsToNodes(steps: Array<{ action: string; label: string; params: Record<string, unknown> }>): { nodes: Node[]; edges: Edge[] } {
  const newNodes: Node[] = [
    {
      id: 'start',
      type: 'action',
      position: { x: 300, y: 50 },
      data: { actionType: 'start', label: 'Start', params: {} },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    },
  ]
  const newEdges: Edge[] = []

  let prevId = 'start'
  steps.forEach((step, i) => {
    const id = `step_${i + 1}`
    const meta = getActionMeta(step.action as ActionType)
    newNodes.push({
      id,
      type: 'action',
      position: { x: 300, y: 130 + i * 100 },
      data: {
        actionType: step.action,
        label: step.label || meta.label,
        params: step.params || getDefaultParams(step.action as ActionType),
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    })
    newEdges.push({
      id: `e_${prevId}_${id}`,
      source: prevId,
      target: id,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
    })
    prevId = id
  })

  const endId = 'end'
  newNodes.push({
    id: endId,
    type: 'action',
    position: { x: 300, y: 130 + steps.length * 100 },
    data: { actionType: 'end', label: 'End', params: {} },
    sourcePosition: Position.Bottom,
    targetPosition: Position.Top,
  })
  newEdges.push({
    id: `e_${prevId}_${endId}`,
    source: prevId,
    target: endId,
    animated: true,
    style: { stroke: '#6366f1', strokeWidth: 2 },
    markerEnd: { type: MarkerType.ArrowClosed, color: '#6366f1' },
  })

  return { nodes: newNodes, edges: newEdges }
}

// ============ Page Export ============

export default function VisualWorkflowPage() {
  return (
    <ReactFlowProvider>
      <VisualBuilderInner />
    </ReactFlowProvider>
  )
}
