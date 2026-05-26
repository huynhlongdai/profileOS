import { prisma } from '@/lib/prisma'
import { LogService } from './LogService'
import type { Prisma } from '@prisma/client'

export interface CreateExtensionPayload {
  name: string
  extensionId: string // Chrome Web Store extension ID (e.g., "nkbihfbeogaeaoehlefnkodbefgpgknn" for MetaMask)
  storeUrl: string // Full URL to Chrome Web Store
  icon?: string
  description?: string
  version?: string
}

export interface AddExtensionToProfilePayload {
  profileId: string
  extensionId: string
}

export class ExtensionService {
  private logService: LogService

  constructor() {
    this.logService = new LogService()
  }

  /**
   * Extract extension ID from Chrome Web Store URL
   * Supports formats:
   * - https://chrome.google.com/webstore/detail/extension-name/EXTENSION_ID
   * - https://chromewebstore.google.com/detail/extension-name/EXTENSION_ID (new format)
   * - chrome-extension://EXTENSION_ID
   * - Just the extension ID itself
   */
  extractExtensionId(url: string): string {
    // If it's already just an ID (alphanumeric, 32 chars typically)
    if (/^[a-z]{32}$/i.test(url.trim())) {
      return url.trim()
    }

    // Extract from new Chrome Web Store URL format: chromewebstore.google.com/detail/name/ID
    const newChromeStoreMatch = url.match(/chromewebstore\.google\.com\/detail\/[^/]+\/([a-z]{32})/i)
    if (newChromeStoreMatch) {
      return newChromeStoreMatch[1]
    }

    // Extract from old Chrome Web Store URL format: chrome.google.com/webstore/detail/name/ID
    const chromeStoreMatch = url.match(/chrome\.google\.com\/webstore\/detail\/[^/]+\/([a-z]{32})/i)
    if (chromeStoreMatch) {
      return chromeStoreMatch[1]
    }

    // Extract from chrome-extension:// URL
    const extensionUrlMatch = url.match(/chrome-extension:\/\/([a-z]{32})/i)
    if (extensionUrlMatch) {
      return extensionUrlMatch[1]
    }

    // Try to extract any 32-character alphanumeric string that looks like an extension ID
    const idMatch = url.match(/\/([a-z]{32})(?:\/|$|\?|:)/i)
    if (idMatch) {
      return idMatch[1]
    }

    // If no match, return the URL as-is (might be a custom extension)
    return url.trim()
  }

  /**
   * Get extension name from Chrome Web Store URL (requires fetching the page)
   * For now, we'll use a simple extraction or require user to provide name
   */
  async getExtensionInfo(storeUrl: string): Promise<{ name: string; icon?: string; description?: string } | null> {
    try {
      // Extract extension ID
      const extensionId = this.extractExtensionId(storeUrl)

      // Try to fetch extension info from Chrome Web Store
      // Note: This might require a proxy or special handling
      // For now, return basic info based on URL
      return {
        name: extensionId, // Default to ID, user can update later
        icon: `https://lh3.googleusercontent.com/${extensionId}=w128-h128-e365`,
        description: `Extension from ${storeUrl}`,
      }
    } catch (error) {
      console.error('Error fetching extension info:', error)
      return null
    }
  }

  /**
   * Create or get extension by store URL
   */
  async createOrGetExtension(payload: CreateExtensionPayload): Promise<any> {
    // Use provided extensionId if available, otherwise extract from storeUrl
    const extensionId = payload.extensionId || this.extractExtensionId(payload.storeUrl)

    // Check if extension already exists
    let extension = await prisma.extension.findUnique({
      where: { extensionId },
    })

    if (!extension) {
      // Create new extension
      extension = await prisma.extension.create({
        data: {
          name: payload.name,
          extensionId,
          storeUrl: payload.storeUrl,
          icon: payload.icon,
          description: payload.description,
          version: payload.version,
          enabled: true,
        },
      })

      await this.logService.logInfo('core', `Extension created: ${payload.name}`, {
        extensionId: extension.id,
        storeUrl: payload.storeUrl,
      })
    }

    return extension
  }

  /**
   * Get all extensions
   */
  async getAllExtensions(enabledOnly = false): Promise<any[]> {
    const where: Prisma.ExtensionWhereInput = {}
    if (enabledOnly) {
      where.enabled = true
    }

    return prisma.extension.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        _count: {
          select: { profiles: true },
        },
      },
    })
  }

  /**
   * Get extension by ID
   */
  async getExtensionById(id: string): Promise<any | null> {
    return prisma.extension.findUnique({
      where: { id },
      include: {
        _count: {
          select: { profiles: true },
        },
      },
    })
  }

  /**
   * Get extensions for a profile
   */
  async getProfileExtensions(profileId: string): Promise<any[]> {
    return prisma.profileExtension.findMany({
      where: { profileId },
      include: {
        extension: true,
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  /**
   * Add extension to profile
   */
  async addExtensionToProfile(payload: AddExtensionToProfilePayload): Promise<any> {
    // Check if already added
    const existing = await prisma.profileExtension.findUnique({
      where: {
        profileId_extensionId: {
          profileId: payload.profileId,
          extensionId: payload.extensionId,
        },
      },
    })

    if (existing) {
      throw new Error('Extension already added to this profile')
    }

    const profileExtension = await prisma.profileExtension.create({
      data: {
        profileId: payload.profileId,
        extensionId: payload.extensionId,
        installed: false, // Will be installed when profile starts
      },
      include: {
        extension: true,
        profile: true,
      },
    })

    await this.logService.logInfo('core', `Extension added to profile`, {
      profileId: payload.profileId,
      extensionId: payload.extensionId,
    })

    return profileExtension
  }

  /**
   * Remove extension from profile
   */
  async removeExtensionFromProfile(profileId: string, extensionId: string): Promise<void> {
    await prisma.profileExtension.delete({
      where: {
        profileId_extensionId: {
          profileId,
          extensionId,
        },
      },
    })

    await this.logService.logInfo('core', `Extension removed from profile`, {
      profileId,
      extensionId,
    })
  }

  /**
   * Mark extension as installed for a profile
   */
  async markExtensionInstalled(profileId: string, extensionId: string): Promise<void> {
    await prisma.profileExtension.update({
      where: {
        profileId_extensionId: {
          profileId,
          extensionId,
        },
      },
      data: {
        installed: true,
        installedAt: new Date(),
      },
    })
  }

  /**
   * Update extension
   */
  async updateExtension(id: string, data: Partial<CreateExtensionPayload>): Promise<any> {
    return prisma.extension.update({
      where: { id },
      data,
    })
  }

  /**
   * Delete extension (will cascade delete ProfileExtension relations)
   */
  async deleteExtension(id: string): Promise<void> {
    await prisma.extension.delete({
      where: { id },
    })

    await this.logService.logInfo('core', `Extension deleted`, {
      extensionId: id,
    })
  }

  /**
   * Install extension in browser via Chrome Web Store
   * Uses browser automation to navigate to Chrome Web Store and install extension
   */
  async installExtensionInBrowser(
    page: any, // Playwright Page object
    extensionId: string,
    storeUrl: string
  ): Promise<boolean> {
    try {
      // Navigate to Chrome Web Store extension page
      const chromeStoreUrl = storeUrl.includes('chrome.google.com') || storeUrl.includes('chromewebstore.google.com')
        ? storeUrl
        : `https://chromewebstore.google.com/detail/${extensionId}`

      await this.logService.logInfo('core', `Installing extension: ${extensionId}`, {
        storeUrl: chromeStoreUrl,
      })

      // Navigate to extension page
      await page.goto(chromeStoreUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })

      // Wait for page to fully load
      await page.waitForTimeout(3000)

      // Try multiple strategies to find and click the install button
      let buttonClicked = false

      // Strategy 1: Wait for and click the main install button with better selectors
      const addButtonSelectors = [
        'button[aria-label="Add to Chrome"]',
        'button[aria-label="Thêm vào Chrome"]',
        'button:has-text("Add to Chrome")',
        'button:has-text("Thêm vào Chrome")',
        'button[data-test-id="add-to-chrome-button"]',
        'button[class*="add-to-chrome"]',
        'button[class*="AddToChrome"]',
        'button[class*="e-f-ih"]', // Chrome Web Store button class
        'button:has([aria-label*="Add"])',
        'button:has([aria-label*="Thêm"])',
      ]

      for (const selector of addButtonSelectors) {
        try {
          // Wait for button to be visible
          await page.waitForSelector(selector, { timeout: 5000, state: 'visible' }).catch(() => null)
          
          const button = await page.$(selector)
          if (button) {
            const isVisible = await button.isVisible().catch(() => false)
            if (isVisible) {
              // Scroll into view first
              await button.scrollIntoViewIfNeeded()
              await page.waitForTimeout(500)
              
              // Click with force if needed
              await button.click({ force: true, timeout: 5000 })
              buttonClicked = true
              
              await this.logService.logInfo('core', `Clicked Add to Chrome button`, {
                selector,
                extensionId,
              })
              break
            }
          }
        } catch (error) {
          // Try next selector
          continue
        }
      }

      // Strategy 2: Try finding button by text content
      if (!buttonClicked) {
        try {
          const buttons = await page.$$('button')
          for (const button of buttons) {
            try {
              const text = await button.textContent()
              const ariaLabel = await button.getAttribute('aria-label').catch(() => null)
              
              if (text && (text.includes('Add') || text.includes('Thêm') || text.includes('Install'))) {
                const isVisible = await button.isVisible().catch(() => false)
                if (isVisible) {
                  await button.scrollIntoViewIfNeeded()
                  await page.waitForTimeout(500)
                  await button.click({ force: true })
                  buttonClicked = true
                  await this.logService.logInfo('core', `Clicked button by text: ${text}`, {
                    extensionId,
                  })
                  break
                }
              } else if (ariaLabel && (ariaLabel.includes('Add') || ariaLabel.includes('Thêm'))) {
                const isVisible = await button.isVisible().catch(() => false)
                if (isVisible) {
                  await button.scrollIntoViewIfNeeded()
                  await page.waitForTimeout(500)
                  await button.click({ force: true })
                  buttonClicked = true
                  await this.logService.logInfo('core', `Clicked button by aria-label: ${ariaLabel}`, {
                    extensionId,
                  })
                  break
                }
              }
            } catch (error) {
              continue
            }
          }
        } catch (error) {
          // Continue to next strategy
        }
      }

      // Strategy 3: Try using JavaScript to click
      if (!buttonClicked) {
        try {
          const clicked = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
            for (const btn of buttons) {
              const text = btn.textContent || ''
              const ariaLabel = btn.getAttribute('aria-label') || ''
              if (text.includes('Add') || text.includes('Thêm') || ariaLabel.includes('Add') || ariaLabel.includes('Thêm')) {
                (btn as HTMLElement).click()
                return true
              }
            }
            return false
          })
          
          if (clicked) {
            buttonClicked = true
            await this.logService.logInfo('core', `Clicked button via JavaScript`, {
              extensionId,
            })
          }
        } catch (error) {
          // Continue
        }
      }

      if (!buttonClicked) {
        // Take screenshot for debugging
        try {
          await page.screenshot({ path: `extension-install-error-${extensionId}.png` }).catch(() => {})
        } catch (error) {
          // Ignore screenshot errors
        }
        
        throw new Error('Could not find "Add to Chrome" button. Check extension-install-error-*.png for details.')
      }

      // Wait for installation confirmation dialog
      await page.waitForTimeout(3000)

      // Handle confirmation dialog if it appears
      const confirmSelectors = [
        'button:has-text("Add extension")',
        'button:has-text("Thêm tiện ích")',
        'button[aria-label="Add extension"]',
        'button[aria-label="Thêm tiện ích"]',
        'button:has-text("Confirm")',
        'button:has-text("Xác nhận")',
      ]

      let confirmed = false
      for (const selector of confirmSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 5000, state: 'visible' }).catch(() => null)
          const confirmButton = await page.$(selector)
          if (confirmButton) {
            const isVisible = await confirmButton.isVisible().catch(() => false)
            if (isVisible) {
              await confirmButton.click({ force: true })
              confirmed = true
              await this.logService.logInfo('core', `Confirmed extension installation`, {
                extensionId,
                selector,
              })
              break
            }
          }
        } catch (error) {
          // Continue
        }
      }

      // If no confirmation dialog, try JavaScript click
      if (!confirmed) {
        try {
          await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'))
            for (const btn of buttons) {
              const text = btn.textContent || ''
              const ariaLabel = btn.getAttribute('aria-label') || ''
              if (text.includes('Add extension') || text.includes('Thêm tiện ích') || 
                  text.includes('Confirm') || text.includes('Xác nhận') ||
                  ariaLabel.includes('Add extension') || ariaLabel.includes('Thêm tiện ích')) {
                (btn as HTMLElement).click()
                return true
              }
            }
            return false
          })
        } catch (error) {
          // Ignore
        }
      }

      // Wait for installation to complete
      await page.waitForTimeout(5000)

      // Verify installation by checking if extension appears in chrome://extensions
      // Note: This is just a check, we can't directly verify without navigating to chrome://extensions
      
      await this.logService.logInfo('core', `Extension installation process completed: ${extensionId}`, {
        extensionId,
        buttonClicked,
        confirmed,
      })

      return true
    } catch (error) {
      await this.logService.logError('core', `Failed to install extension: ${extensionId}`, {
        extensionId,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }
}

