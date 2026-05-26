'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { TemplateVariable } from '@/types/automation'

interface TemplateExecutionModalProps {
    isOpen: boolean
    onClose: () => void
    templateName: string
    variables: TemplateVariable[]
    onExecute: (variableValues: Record<string, any>) => void
}

export function TemplateExecutionModal({
    isOpen,
    onClose,
    templateName,
    variables,
    onExecute,
}: TemplateExecutionModalProps) {
    const [values, setValues] = useState<Record<string, any>>(() => {
        // Initialize with default values
        const initial: Record<string, any> = {}
        variables.forEach((v) => {
            initial[v.name] = v.defaultValue || ''
        })
        return initial
    })

    const [errors, setErrors] = useState<Record<string, string>>({})

    const validateForm = (): boolean => {
        const newErrors: Record<string, string> = {}

        variables.forEach((variable) => {
            const value = values[variable.name]

            // Check required fields
            if (variable.required && !value) {
                newErrors[variable.name] = 'This field is required'
                return
            }

            // Type validation
            if (value) {
                if (variable.type === 'number' && isNaN(Number(value))) {
                    newErrors[variable.name] = 'Must be a number'
                }
            }

            // Custom validation rules
            if (variable.validation) {
                if (variable.validation.pattern) {
                    const regex = new RegExp(variable.validation.pattern)
                    if (!regex.test(value)) {
                        newErrors[variable.name] = 'Invalid format'
                    }
                }

                if (
                    variable.validation.minLength &&
                    value.length < variable.validation.minLength
                ) {
                    newErrors[variable.name] = `Minimum ${variable.validation.minLength} characters`
                }

                if (
                    variable.validation.maxLength &&
                    value.length > variable.validation.maxLength
                ) {
                    newErrors[variable.name] = `Maximum ${variable.validation.maxLength} characters`
                }
            }
        })

        setErrors(newErrors)
        return Object.keys(newErrors).length === 0
    }

    const handleSubmit = () => {
        if (!validateForm()) {
            return
        }

        // Convert number values
        const processed: Record<string, any> = {}
        variables.forEach((variable) => {
            const value = values[variable.name]
            if (variable.type === 'number') {
                processed[variable.name] = Number(value)
            } else if (variable.type === 'boolean') {
                processed[variable.name] = value === 'true' || value === true
            } else {
                processed[variable.name] = value
            }
        })

        onExecute(processed)
        onClose()
    }

    const updateValue = (name: string, value: any) => {
        setValues({ ...values, [name]: value })
        // Clear error when user types
        if (errors[name]) {
            setErrors({ ...errors, [name]: '' })
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b">
                    <div>
                        <h2 className="text-2xl font-bold">Execute Template</h2>
                        <p className="text-sm text-gray-600 mt-1">{templateName}</p>
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
                    {variables.length === 0 ? (
                        <div className="bg-gray-50 border rounded-lg p-4 text-center">
                            <p className="text-gray-600">
                                This template has no variables. Click &quot;Execute&quot; to run with default
                                settings.
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600 mb-4">
                                Fill in the values for this execution. Required fields are marked
                                with *.
                            </p>

                            {variables.map((variable) => (
                                <div key={variable.name}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        {variable.label}
                                        {variable.required && (
                                            <span className="text-red-600 ml-1">*</span>
                                        )}
                                    </label>

                                    {variable.description && (
                                        <p className="text-xs text-gray-500 mb-2">
                                            {variable.description}
                                        </p>
                                    )}

                                    {variable.type === 'boolean' ? (
                                        <select
                                            value={values[variable.name]?.toString() || 'false'}
                                            onChange={(e) =>
                                                updateValue(variable.name, e.target.value === 'true')
                                            }
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors[variable.name]
                                                    ? 'border-red-500'
                                                    : 'border-gray-300'
                                                }`}
                                        >
                                            <option value="false">No</option>
                                            <option value="true">Yes</option>
                                        </select>
                                    ) : variable.options && variable.options.length > 0 ? (
                                        <select
                                            value={values[variable.name] || ''}
                                            onChange={(e) => updateValue(variable.name, e.target.value)}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors[variable.name]
                                                    ? 'border-red-500'
                                                    : 'border-gray-300'
                                                }`}
                                        >
                                            <option value="">Select...</option>
                                            {variable.options.map((opt) => (
                                                <option key={opt.value} value={opt.value}>
                                                    {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type={variable.type === 'number' ? 'number' : 'text'}
                                            value={values[variable.name] || ''}
                                            onChange={(e) => updateValue(variable.name, e.target.value)}
                                            placeholder={variable.defaultValue?.toString() || ''}
                                            className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none ${errors[variable.name]
                                                    ? 'border-red-500'
                                                    : 'border-gray-300'
                                                }`}
                                        />
                                    )}

                                    {errors[variable.name] && (
                                        <p className="text-xs text-red-600 mt-1">
                                            {errors[variable.name]}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Execute Template
                    </button>
                </div>
            </div>
        </div>
    )
}
