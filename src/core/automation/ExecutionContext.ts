/**
 * Execution Context for Automation
 * Manages variables and state during template execution
 */

export class ExecutionContext {
    private variables: Map<string, any> = new Map()

    /**
     * Set a variable value
     */
    set(name: string, value: any): void {
        this.variables.set(name, value)
    }

    /**
     * Get a variable value
     */
    get(name: string): any {
        return this.variables.get(name)
    }

    /**
     * Check if variable exists
     */
    has(name: string): boolean {
        return this.variables.has(name)
    }

    /**
     * Increment a numeric variable
     */
    increment(name: string, amount: number = 1): void {
        const current = this.get(name) || 0
        this.set(name, Number(current) + amount)
    }

    /**
     * Decrement a numeric variable
     */
    decrement(name: string, amount: number = 1): void {
        const current = this.get(name) || 0
        this.set(name, Number(current) - amount)
    }

    /**
     * Replace ${varName} placeholders in text with actual values
     */
    replaceVariables(text: string): string {
        if (!text) return text

        return text.replace(/\$\{([^}]+)\}/g, (match, varName) => {
            if (this.has(varName)) {
                return String(this.get(varName))
            }
            return match // Keep original if variable not found
        })
    }

    /**
     * Get all variables as plain object
     */
    getAll(): Record<string, any> {
        return Object.fromEntries(this.variables)
    }

    /**
     * Clear all variables
     */
    clear(): void {
        this.variables.clear()
    }

    /**
     * Get variable count
     */
    count(): number {
        return this.variables.size
    }
}
