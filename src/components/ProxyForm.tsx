'use client'

import { useState, useEffect, useCallback } from 'react'
import { useToastContext } from './ToastProvider'

interface ProxyFormProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  proxyId?: string
}

export default function ProxyForm({
  isOpen,
  onClose,
  onSuccess,
  proxyId,
}: ProxyFormProps) {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const { showToast } = useToastContext()
  const [formData, setFormData] = useState({
    label: '',
    rawProxy: '',
    proxyServerUrl: '',
  })

  const fetchProxy = useCallback(async () => {
    if (!proxyId) {
      console.warn('fetchProxy called without proxyId')
      return
    }
    
    try {
      setFetching(true)
      setLoading(true)
      console.log('Fetching proxy:', proxyId)
      const res = await fetch(`/api/proxies/${proxyId}`)
      const data = await res.json()
      
      console.log('Proxy data received:', data)
      
      if (data.success && data.proxy) {
        const newFormData = {
          label: data.proxy.label || '',
          rawProxy: data.proxy.rawProxy || '',
          proxyServerUrl: data.proxy.proxyServerUrl || '',
        }
        console.log('Setting form data:', newFormData)
        setFormData(newFormData)
      } else {
        console.error('Failed to fetch proxy:', data.error)
        showToast(data.error || 'Failed to load proxy data', 'error')
      }
    } catch (error) {
      console.error('Error fetching proxy:', error)
      showToast('Error loading proxy data', 'error')
    } finally {
      setLoading(false)
      setFetching(false)
    }
  }, [proxyId, showToast])

  useEffect(() => {
    if (isOpen) {
      if (proxyId) {
        // Load proxy data when editing
        fetchProxy()
      } else {
        // Reset form for new proxy
        setFormData({ label: '', rawProxy: '', proxyServerUrl: '' })
      }
    } else {
      // Reset form when modal closes
      setFormData({ label: '', rawProxy: '', proxyServerUrl: '' })
      setFetching(false)
    }
  }, [isOpen, proxyId, fetchProxy])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const url = proxyId ? `/api/proxies/${proxyId}` : '/api/proxies'
      const method = proxyId ? 'PUT' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      const data = await res.json()

      if (data.success) {
        showToast(
          proxyId ? 'Proxy updated successfully' : 'Proxy created successfully',
          'success'
        )
        onSuccess()
        onClose()
        setFormData({ label: '', rawProxy: '', proxyServerUrl: '' })
      } else {
        showToast(data.error || 'Unknown error', 'error')
      }
    } catch (error) {
      console.error('Error saving proxy:', error)
      showToast('Error saving proxy. Please try again.', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && proxyId && formData.label === '' && formData.rawProxy === '') {
    return (
      <div className="space-y-4">
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-2 text-sm text-gray-600">Loading proxy data...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">
            Label *
          </label>
          <input
            type="text"
            required
            value={formData.label}
            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="Proxy 01"
            disabled={loading && proxyId !== undefined}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Raw Proxy *
          </label>
          <input
            type="text"
            required
            value={formData.rawProxy}
            onChange={(e) =>
              setFormData({ ...formData, rawProxy: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="host:port hoặc host:port:user:pass"
            disabled={loading && proxyId !== undefined}
          />
          <p className="mt-1 text-xs text-gray-500">
            Format: host:port hoặc host:port:username:password
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">
            Proxy Server URL
          </label>
          <input
            type="text"
            value={formData.proxyServerUrl}
            onChange={(e) =>
              setFormData({ ...formData, proxyServerUrl: e.target.value })
            }
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 bg-white placeholder:text-gray-400 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
            placeholder="http://192.168.1.41 (optional)"
            disabled={loading && proxyId !== undefined}
          />
          <p className="mt-1 text-xs text-gray-500">
            Proxy API Server URL để check và reset IP. Nếu để trống sẽ dùng giá trị từ environment variable.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Saving...' : proxyId ? 'Update' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

