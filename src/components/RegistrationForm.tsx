'use client'

import { useState } from 'react'
import Modal from './Modal'
import { Rocket, Loader2 } from 'lucide-react'
import { useToastContext } from './ToastProvider'

interface Platform {
  name: string
  display_name: string
}

interface RegistrationFormProps {
  isOpen: boolean
  onClose: () => void
  platforms: Platform[]
  onTaskCreated: (taskId: string) => void
}

export default function RegistrationForm({ 
  isOpen, 
  onClose, 
  platforms, 
  onTaskCreated 
}: RegistrationFormProps) {
  const { showToast } = useToastContext()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    platform: 'chatgpt',
    count: 1,
    proxy: '',
    concurrency: 1,
    register_delay_seconds: 30,
    mail_provider: 'moemail'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    
    try {
      const res = await fetch('/api/registration/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          extra: {
            mail_provider: formData.mail_provider
          }
        })
      })
      
      const data = await res.json()
      if (data.success) {
        showToast('Registration task started successfully', 'success')
        onTaskCreated(data.task_id)
      } else {
        showToast(data.error || 'Failed to start task', 'error')
      }
    } catch (error) {
      showToast('Error connecting to backend', 'error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="New Registration Task" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Platform</label>
          <select
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            value={formData.platform}
            onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
          >
            {platforms.map((p) => (
              <option key={p.name} value={p.name}>{p.display_name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Account Count</label>
            <input
              type="number"
              min="1"
              max="1000"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={formData.count}
              onChange={(e) => setFormData({ ...formData, count: parseInt(e.target.value) })}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Concurrency</label>
            <input
              type="number"
              min="1"
              max="10"
              className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
              value={formData.concurrency}
              onChange={(e) => setFormData({ ...formData, concurrency: parseInt(e.target.value) })}
            />
          </div>
        </div>

        <div>
           <label className="block text-xs font-medium text-gray-400 mb-1">Email Provider</label>
          <select
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            value={formData.mail_provider}
            onChange={(e) => setFormData({ ...formData, mail_provider: e.target.value })}
          >
            <option value="moemail">MoeMail (Temp)</option>
            <option value="tempmail_lol">TempMail.lol (Temp)</option>
            <option value="skymail">SkyMail (Custom)</option>
            <option value="luckmail">LuckMail (API)</option>
            <option value="cfworker">CF Worker (Self-hosted)</option>
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Proxy (Optional)</label>
          <input
            type="text"
            placeholder="http://user:pass@host:port"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            value={formData.proxy}
            onChange={(e) => setFormData({ ...formData, proxy: e.target.value })}
          />
          <p className="text-[10px] text-gray-500 mt-1">Leave empty to use built-in proxy pool</p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Initial Delay (seconds)</label>
          <input
            type="number"
            min="0"
            className="w-full bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500"
            value={formData.register_delay_seconds}
            onChange={(e) => setFormData({ ...formData, register_delay_seconds: parseInt(e.target.value) })}
          />
        </div>

        <div className="pt-4 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-all shadow-lg shadow-indigo-500/20"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
            Start Task
          </button>
        </div>
      </form>
    </Modal>
  )
}
