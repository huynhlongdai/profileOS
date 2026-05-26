'use client'

import { useState, useEffect } from 'react'
import { X, Plus, Trash2 } from 'lucide-react'
import type { RecordedAction, TemplateVariable } from '@/types/automation'

interface VariableDefinitionModalProps {
    isOpen: boolean
    onClose: () => void
    actions: RecordedAction[]
    onConfirm: (variables: TemplateVariable[]) => void
}

export function VariableDefinitionModal({
    isOpen,
    onClose,
    actions,
    onConfirm,
}: VariableDefinitionModalProps) {
    const [variables, setVariables] = useState<TemplateVariable[]>([])
    const [selectedActionIds, setSelectedActionIds] = useState<Set<string>>(new Set())

    // Auto-detect potential variables from input actions
    useEffect(() => {
        if (isOpen && actions.length > 0) {
            const inputActions = actions.filter((a) => a.type === 'input' && a.value)
            if (inputActions.length > 0 && variables.length === 0) {
                // Auto-create variables for first few inputs
                const autoVars = inputActions.slice(0, 3).map((action, idx) => ({
                    name: `input_${idx + 1}`,
                    type: 'string' as const,
                    label: `Input ${idx + 1}`,
                    description: `Value for ${action.selector || 'input field'}`,
                    required: true,
                    defaultValue: action.value,
                }))
                setVariables(autoVars)
            }
        }
    }, [isOpen, actions])

    const addVariable = () => {
        setVariables([
            ...variables,
            {
                name: `var_${variables.length + 1}`,
                type: 'string',
                label: `Variable ${variables.length + 1}`,
                required: false,
                defaultValue: '',
            },
        ])
    }

    const removeVariable = (index: number) => {
        setVariables(variables.filter((_, i) => i !== index))
    }

    const updateVariable = (index: number, field: keyof TemplateVariable, value: any) => {
        const updated = [...variables]
        updated[index] = { ...updated[index], [field]: value }
        setVariables(updated)
    }

    const handleConfirm = () => {
        onConfirm(variables)
        onClose()
    }

    const inputActions = actions.filter((a) => a.type === 'input')

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold">Define Template Variables</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Select which values should be variables that can be changed each time
                            you run this template
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {/* Input Actions Preview */}
                    {inputActions.length > 0 && (
                        <div className="mb-6">
                            <h3 className="font-semibold mb-3">Input Actions in Recording</h3>
                            <div className="space-y-2">
                                {inputActions.map((action, idx) => (
                                    <div
                                        key={action.id}
                                        className="bg-gray-50 border rounded-lg p-3 text-sm"
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="font-mono text-xs text-gray-600 mb-1">
                                                    {action.selector || 'No selector'}
                                                </div>
                                                <div className="font-medium">
                                                    Value: "{action.value}"
                                                </div>
                                            </div>
                                            <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                                Input #{idx + 1}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Variable Definitions */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold">Variables</h3>
                            <button
                                onClick={addVariable}
                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Add Variable
                            </button>
                        </div>

                        {variables.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                                <p className="text-yellow-800">
                                    No variables defined. Click "Add Variable" to create one, or
                                    click "Skip" to create template without variables.
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {variables.map((variable, index) => (
                                    <div
                                        key={index}
                                        className="bg-gray-50 border rounded-lg p-4 space-y-3"
                                    >
                                        <div className="flex items-start justify-between">
                                            <h4 className="font-medium text-sm">
                                                Variable #{index + 1}
                                            </h4>
                                            <button
                                                onClick={() => removeVariable(index)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Variable Name */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Variable Name *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={variable.name}
                                                    onChange={(e) =>
                                                        updateVariable(index, 'name', e.target.value)
                                                    }
                                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="e.g., email"
                                                />
                                            </div>

                                            {/* Variable Type */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Type
                                                </label>
                                                <select
                                                    value={variable.type}
                                                    onChange={(e) =>
                                                        updateVariable(index, 'type', e.target.value)
                                                    }
                                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                >
                                                    <option value="string">String</option>
                                                    <option value="number">Number</option>
                                                    <option value="boolean">Boolean</option>
                                                </select>
                                            </div>

                                            {/* Label */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Label *
                                                </label>
                                                <input
                                                    type="text"
                                                    value={variable.label}
                                                    onChange={(e) =>
                                                        updateVariable(index, 'label', e.target.value)
                                                    }
                                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="e.g., Email Address"
                                                />
                                            </div>

                                            {/* Default Value */}
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Default Value
                                                </label>
                                                <input
                                                    type="text"
                                                    value={variable.defaultValue || ''}
                                                    onChange={(e) =>
                                                        updateVariable(
                                                            index,
                                                            'defaultValue',
                                                            e.target.value
                                                        )
                                                    }
                                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                />
                                            </div>

                                            {/* Description */}
                                            <div className="col-span-2">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                    Description
                                                </label>
                                                <textarea
                                                    value={variable.description || ''}
                                                    onChange={(e) =>
                                                        updateVariable(
                                                            index,
                                                            'description',
                                                            e.target.value
                                                        )
                                                    }
                                                    rows={2}
                                                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                                    placeholder="Help text for this variable"
                                                />
                                            </div>

                                            {/* Required Checkbox */}
                                            <div className="col-span-2">
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={variable.required || false}
                                                        onChange={(e) =>
                                                            updateVariable(
                                                                index,
                                                                'required',
                                                                e.target.checked
                                                            )
                                                        }
                                                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm text-gray-700">
                                                        Required field
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between p-6 border-t bg-gray-50">
                    <button
                        onClick={() => {
                            setVariables([])
                            onConfirm([])
                            onClose()
                        }}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Skip Variables
                    </button>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            Create Template
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
