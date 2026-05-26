'use client'

import { useState, useEffect } from 'react'
import { useToastContext } from './ToastProvider'
import Modal from './Modal'

interface Extension {
  id: string
  name: string
  extensionId: string
  storeUrl: string
  icon: string | null
  description: string | null
  enabled: boolean
  _count?: { profiles: number }
}

interface ProfileExtension {
  id: string
  extensionId: string
  installed: boolean
  installedAt: string | null
  extension: Extension
}

interface ProfileExtensionsModalProps {
  isOpen: boolean
  onClose: () => void
  profileId: string
  profileName: string
}

export default function ProfileExtensionsModal({
  isOpen,
  onClose,
  profileId,
  profileName,
}: ProfileExtensionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [profileExtensions, setProfileExtensions] = useState<ProfileExtension[]>([])
  const [allExtensions, setAllExtensions] = useState<Extension[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [extensionUrl, setExtensionUrl] = useState('')
  const { showToast } = useToastContext()

  useEffect(() => {
    if (isOpen && profileId) {
      fetchProfileExtensions()
      fetchAllExtensions()
    }
  }, [isOpen, profileId])

  const fetchProfileExtensions = async () => {
    try {
      const res = await fetch(`/api/profiles/${profileId}/extensions`)
      const data = await res.json()
      if (data.success) {
        setProfileExtensions(data.extensions || [])
      }
    } catch (error) {
      console.error('Error fetching profile extensions:', error)
    }
  }

  const fetchAllExtensions = async () => {
    try {
      const res = await fetch('/api/extensions?enabledOnly=true')
      const data = await res.json()
      if (data.success) {
        setAllExtensions(data.extensions || [])
      }
    } catch (error) {
      console.error('Error fetching all extensions:', error)
    }
  }

  const handleAddExtension = async () => {
    if (!extensionUrl.trim()) {
      showToast('Please enter extension URL', 'error')
      return
    }

    setLoading(true)
    try {
      // First, create or get extension from URL
      const createRes = await fetch('/api/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storeUrl: extensionUrl.trim() }),
      })

      const createData = await createRes.json()
      if (!createData.success) {
        showToast(createData.error || 'Failed to create extension', 'error')
        return
      }

      // Then add to profile
      const addRes = await fetch(`/api/profiles/${profileId}/extensions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ extensionId: createData.extension.id }),
      })

      const addData = await addRes.json()
      if (addData.success) {
        showToast('Extension added successfully. It will be installed when profile starts.', 'success')
        setExtensionUrl('')
        setShowAddModal(false)
        fetchProfileExtensions()
        fetchAllExtensions()
      } else {
        showToast(addData.error || 'Failed to add extension to profile', 'error')
      }
    } catch (error) {
      console.error('Error adding extension:', error)
      showToast('Error adding extension', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveExtension = async (extensionId: string) => {
    if (!confirm('Are you sure you want to remove this extension from the profile?')) {
      return
    }

    try {
      const res = await fetch(`/api/profiles/${profileId}/extensions/${extensionId}`, {
        method: 'DELETE',
      })

      const data = await res.json()
      if (data.success) {
        showToast('Extension removed successfully', 'success')
        fetchProfileExtensions()
      } else {
        showToast(data.error || 'Failed to remove extension', 'error')
      }
    } catch (error) {
      console.error('Error removing extension:', error)
      showToast('Error removing extension', 'error')
    }
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={onClose} title={`Extensions - ${profileName}`}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Manage extensions for this profile. Extensions will be automatically installed when the profile starts.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
            >
              + Add Extension
            </button>
          </div>

          {profileExtensions.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <p>No extensions added yet.</p>
              <p className="text-sm mt-2">Click "Add Extension" to add one.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {profileExtensions.map((pe) => (
                <div
                  key={pe.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-md border border-gray-200"
                >
                  <div className="flex items-center gap-3 flex-1">
                    {pe.extension.icon && (
                      <img
                        src={pe.extension.icon}
                        alt={pe.extension.name}
                        className="w-8 h-8 rounded"
                        onError={(e) => {
                          ;(e.target as HTMLImageElement).style.display = 'none'
                        }}
                      />
                    )}
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{pe.extension.name}</div>
                      <div className="text-xs text-gray-500">
                        ID: {pe.extension.extensionId}
                        {pe.installed && (
                          <span className="ml-2 text-green-600">✓ Installed</span>
                        )}
                      </div>
                      {pe.extension.description && (
                        <div className="text-xs text-gray-400 mt-1">{pe.extension.description}</div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveExtension(pe.extensionId)}
                    className="px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 rounded-md transition-colors border border-red-200"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Add Extension Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setExtensionUrl('')
        }}
        title="Add Extension"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Extension URL (Chrome Web Store)
            </label>
              <input
                type="text"
                value={extensionUrl}
                onChange={(e) => setExtensionUrl(e.target.value)}
                placeholder="https://chrome.google.com/webstore/detail/extension-name/EXTENSION_ID"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900 shadow-sm placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500"
              />
            <p className="mt-2 text-xs text-gray-500">
              Enter the Chrome Web Store URL of the extension. Example:
              <br />
              <code className="text-blue-600">
                https://chrome.google.com/webstore/detail/metamask/nkbihfbeogaeaoehlefnkodbefgpgknn
              </code>
            </p>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={() => {
                setShowAddModal(false)
                setExtensionUrl('')
              }}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleAddExtension}
              disabled={loading || !extensionUrl.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Adding...' : 'Add Extension'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  )
}

