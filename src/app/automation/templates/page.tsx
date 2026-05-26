'use client'

import { useEffect, useState } from 'react'
import { Play, Trash2, Eye, Download, Upload } from 'lucide-react'
import { TemplateExecutionModal } from '@/components/automation/TemplateExecutionModal'
import type { TemplateVariable } from '@/types/automation'

interface Template {
    id: string
    name: string
    description: string | null
    category: string
    icon: string | null
    isPublic: boolean
    isOfficial: boolean
    usageCount: number
    rating: number | null
    createdAt: string
    updatedAt: string
}

interface Profile {
    id: string
    name: string
    status: string
}

export default function TemplatesPage() {
    const [templates, setTemplates] = useState<Template[]>([])
    const [profiles, setProfiles] = useState<Profile[]>([])
    const [selectedProfileId, setSelectedProfileId] = useState<string>('')
    const [loading, setLoading] = useState(true)
    const [categoryFilter, setCategoryFilter] = useState<string>('all')
    const [executing, setExecuting] = useState<string | null>(null)

    // Execution Modal state
    const [showExecutionModal, setShowExecutionModal] = useState(false)
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
    const [templateVariables, setTemplateVariables] = useState<TemplateVariable[]>([])

    const categories = [
        { value: 'all', label: 'All Categories' },
        { value: 'social-media', label: 'Social Media' },
        { value: 'e-commerce', label: 'E-commerce' },
        { value: 'data-entry', label: 'Data Entry' },
        { value: 'testing', label: 'Testing' },
        { value: 'other', label: 'Other' },
    ]

    useEffect(() => {
        fetchTemplates()
        fetchProfiles()
    }, [categoryFilter])

    const fetchTemplates = async () => {
        try {
            const params = new URLSearchParams()
            if (categoryFilter !== 'all') {
                params.append('category', categoryFilter)
            }

            const res = await fetch(`/api/automation/templates?${params.toString()}`)
            const data = await res.json()
            if (data.success) {
                setTemplates(data.templates || [])
            }
        } catch (error) {
            console.error('Error fetching templates:', error)
        } finally {
            setLoading(false)
        }
    }

    const fetchProfiles = async () => {
        try {
            const res = await fetch('/api/profiles')
            const data = await res.json()
            if (data.success) {
                const runningProfiles = data.profiles.filter((p: Profile) => p.status === 'running')
                setProfiles(runningProfiles)
                if (runningProfiles.length > 0 && !selectedProfileId) {
                    setSelectedProfileId(runningProfiles[0].id)
                }
            }
        } catch (error) {
            console.error('Error fetching profiles:', error)
        }
    }

    const executeTemplate = async (templateId: string) => {
        if (!selectedProfileId) {
            alert('Please select a profile first')
            return
        }

        // Get template details to check for variables
        const template = templates.find((t) => t.id === templateId)
        if (!template) return

        // Fetch full template with variables
        try {
            const res = await fetch(`/api/automation/templates/${templateId}`)
            const data = await res.json()
            if (data.success) {
                const vars = data.template.variablesJson
                    ? JSON.parse(data.template.variablesJson)
                    : []

                if (vars.length > 0) {
                    // Show modal to collect variable values
                    setSelectedTemplate(template)
                    setTemplateVariables(vars)
                    setShowExecutionModal(true)
                } else {
                    // Execute without variables
                    handleExecuteWithVariables({})
                }
            }
        } catch (error) {
            console.error('Error fetching template:', error)
            alert('Failed to load template')
        }
    }

    const handleExecuteWithVariables = async (variables: Record<string, any>) => {
        if (!selectedTemplate || !selectedProfileId) return

        setExecuting(selectedTemplate.id)
        try {
            const res = await fetch(`/api/automation/templates/${selectedTemplate.id}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    profileId: selectedProfileId,
                    variables,
                }),
            })

            const data = await res.json()
            if (data.success) {
                alert('✅ Template execution started! Check the execution status in the Executions tab.')
                fetchTemplates() // Refresh to update usage count
            } else {
                alert('❌ Failed to execute template: ' + data.error)
            }
        } catch (error) {
            console.error('Error executing template:', error)
            alert('❌ Failed to execute template')
        } finally {
            setExecuting(null)
        }
    }

    const deleteTemplate = async (id: string) => {
        if (!confirm('Are you sure you want to delete this template?')) return

        try {
            const res = await fetch(`/api/automation/templates/${id}`, {
                method: 'DELETE',
            })
            const data = await res.json()
            if (data.success) {
                fetchTemplates()
            }
        } catch (error) {
            console.error('Error deleting template:', error)
        }
    }

    const viewTemplate = async (id: string) => {
        try {
            const res = await fetch(`/api/automation/templates/${id}`)
            const data = await res.json()
            if (data.success) {
                const actions = JSON.parse(data.template.actionsJson)
                const variables = data.template.variablesJson
                    ? JSON.parse(data.template.variablesJson)
                    : []
                console.log('Template:', { actions, variables })
                alert(`Template has ${actions.length} actions and ${variables.length} variables. Check console for details.`)
            }
        } catch (error) {
            console.error('Error viewing template:', error)
        }
    }

    return (
        <div className="container mx-auto p-6">
            <div className="mb-8">
                <h1 className="text-3xl font-bold mb-2">Automation Templates</h1>
                <p className="text-gray-600">Reusable automation workflows</p>
            </div>

            {/* Profile Selection */}
            {profiles.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Profile for Execution
                    </label>
                    <select
                        value={selectedProfileId}
                        onChange={(e) => setSelectedProfileId(e.target.value)}
                        className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        {profiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                                {profile.name}
                            </option>
                        ))}
                    </select>
                </div>
            )}

            {/* Category Filter */}
            <div className="bg-white rounded-lg shadow-sm border p-4 mb-6">
                <div className="flex gap-2 flex-wrap">
                    {categories.map((cat) => (
                        <button
                            key={cat.value}
                            onClick={() => setCategoryFilter(cat.value)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${categoryFilter === cat.value
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                        >
                            {cat.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Templates Grid */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
                <h2 className="text-xl font-semibold mb-4">Templates</h2>

                {loading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : templates.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <p>No templates found</p>
                        <p className="text-sm mt-1">
                            Convert a recording to create your first template
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {templates.map((template) => (
                            <div
                                key={template.id}
                                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {template.icon && (
                                            <span className="text-2xl">{template.icon}</span>
                                        )}
                                        <h3 className="font-semibold text-lg">{template.name}</h3>
                                    </div>
                                    {template.isOfficial && (
                                        <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded font-medium">
                                            Official
                                        </span>
                                    )}
                                </div>

                                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                    {template.description || 'No description'}
                                </p>

                                <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
                                    <span className="flex items-center gap-1">
                                        <Play className="w-4 h-4" />
                                        {template.usageCount} uses
                                    </span>
                                    {template.rating && (
                                        <span className="flex items-center gap-1">
                                            ⭐ {template.rating.toFixed(1)}
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => executeTemplate(template.id)}
                                        disabled={executing === template.id || profiles.length === 0}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                                    >
                                        <Play className="w-4 h-4" />
                                        {executing === template.id ? 'Running...' : 'Run'}
                                    </button>
                                    <button
                                        onClick={() => viewTemplate(template.id)}
                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                                        title="View details"
                                    >
                                        <Eye className="w-4 h-4" />
                                    </button>
                                    {!template.isOfficial && (
                                        <button
                                            onClick={() => deleteTemplate(template.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Template Execution Modal */}
            <TemplateExecutionModal
                isOpen={showExecutionModal}
                onClose={() => setShowExecutionModal(false)}
                templateName={selectedTemplate?.name || ''}
                variables={templateVariables}
                onExecute={handleExecuteWithVariables}
            />
        </div>
    )
}
