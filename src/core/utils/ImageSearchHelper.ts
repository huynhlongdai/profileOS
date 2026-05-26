/**
 * ImageSearchHelper - Utility for finding elements using image matching
 * 
 * Inspired by GPM Automation's Image Search feature (https://docs.gpmautomate.com/image-search)
 * Allows finding elements on page by matching screenshot templates
 * 
 * Usage:
 * ```typescript
 * const result = await ImageSearchHelper.findImage(page, './templates/button.png', { threshold: 0.8 })
 * if (result.found) {
 *   await page.mouse.click(result.x!, result.y!)
 * }
 * ```
 * 
 * Note: Ensure page scale/resolution is consistent between template capture and search execution
 */

import type { Page, Locator } from 'playwright'
import { promises as fs } from 'fs'
import path from 'path'

export interface ImageSearchOptions {
  threshold?: number // 0-1, similarity threshold (default: 0.7, higher = more strict)
  timeout?: number // Timeout in milliseconds for wait operations (default: 10000)
  region?: {
    x: number
    y: number
    width: number
    height: number
  } // Optional: search within a specific region of the page
  maxMatches?: number // Maximum number of matches to return (default: 1)
}

export interface ImageSearchResult {
  found: boolean
  x?: number // Center X coordinate if found
  y?: number // Center Y coordinate if found
  confidence?: number // Match confidence (0-1)
  region?: {
    x: number
    y: number
    width: number
    height: number
  } // Bounding box of matched region
  allMatches?: Array<{
    x: number
    y: number
    confidence: number
    region: { x: number; y: number; width: number; height: number }
  }> // All matches if maxMatches > 1
}

export class ImageSearchHelper {
  /**
   * Wait for an image to appear on the page
   * Returns the position when found, or throws timeout error
   * 
   * @example
   * ```typescript
   * const result = await ImageSearchHelper.waitForImage(
   *   page, 
   *   './templates/continue-google-button.png',
   *   { threshold: 0.8, timeout: 15000 }
   * )
   * await page.mouse.click(result.x!, result.y!)
   * ```
   */
  static async waitForImage(
    page: Page,
    templateImagePath: string,
    options: ImageSearchOptions = {}
  ): Promise<ImageSearchResult> {
    const timeout = options.timeout || 10000
    const threshold = options.threshold || 0.7
    const startTime = Date.now()

    while (Date.now() - startTime < timeout) {
      const result = await this.findImage(page, templateImagePath, {
        ...options,
        threshold,
      })

      if (result.found) {
        return result
      }

      // Wait a bit before retrying
      await page.waitForTimeout(500)
    }

    throw new Error(
      `Image not found: ${templateImagePath} (timeout after ${timeout}ms)`
    )
  }

  /**
   * Check if an image exists on the page
   * Returns boolean indicating if image was found
   * 
   * @example
   * ```typescript
   * const exists = await ImageSearchHelper.imageExists(
   *   page,
   *   './templates/login-button.png'
   * )
   * if (exists) {
   *   console.log('Login button is visible')
   * }
   * ```
   */
  static async imageExists(
    page: Page,
    templateImagePath: string,
    options: ImageSearchOptions = {}
  ): Promise<boolean> {
    const result = await this.findImage(page, templateImagePath, options)
    return result.found
  }

  /**
   * Search for an image on the page
   * Returns the position and confidence if found
   * 
   * This is a simplified implementation using browser-based image comparison.
   * For production use, consider integrating with OpenCV or similar image processing libraries
   * 
   * @example
   * ```typescript
   * const result = await ImageSearchHelper.findImage(
   *   page,
   *   './templates/continue-google-button.png',
   *   { threshold: 0.8, region: { x: 0, y: 0, width: 800, height: 600 } }
   * )
   * 
   * if (result.found && result.x && result.y) {
   *   await page.mouse.click(result.x, result.y)
   * }
   * ```
   */
  static async findImage(
    page: Page,
    templateImagePath: string,
    options: ImageSearchOptions = {}
  ): Promise<ImageSearchResult> {
    const threshold = options.threshold || 0.7
    const maxMatches = options.maxMatches || 1

    console.log('[ImageSearchHelper] Starting image search...', {
      templateImagePath,
      threshold,
      region: options.region,
    })

    try {
      // Verify template image exists
      try {
        await fs.access(templateImagePath)
        console.log('[ImageSearchHelper] Template image found:', templateImagePath)
      } catch {
        console.error('[ImageSearchHelper] Template image not found:', templateImagePath)
        throw new Error(`Template image not found: ${templateImagePath}`)
      }

      // Read template image
      const templateImageBuffer = await fs.readFile(templateImagePath)
      const templateBase64 = templateImageBuffer.toString('base64')

      // Take screenshot of page (or region if specified)
      const screenshotBuffer = options.region
        ? await page.screenshot({
            clip: options.region,
          })
        : await page.screenshot({ fullPage: false })

      // Use browser's canvas API for image comparison
      // This is a simplified template matching implementation
      const result = await page.evaluate(
        async ({ templateBase64, screenshotBase64, threshold, maxMatches }) => {
          // Helper function to create image from base64
          const createImage = (base64: string): Promise<HTMLImageElement> => {
            return new Promise((resolve, reject) => {
              const img = new Image()
              img.onload = () => resolve(img)
              img.onerror = reject
              img.src = `data:image/png;base64,${base64}`
            })
          }

          // Load images
          const [templateImg, screenshotImg] = await Promise.all([
            createImage(templateBase64),
            createImage(screenshotBase64),
          ])

          // Create canvas for screenshot
          const screenshotCanvas = document.createElement('canvas')
          const screenshotCtx = screenshotCanvas.getContext('2d', { willReadFrequently: true })!
          screenshotCanvas.width = screenshotImg.width
          screenshotCanvas.height = screenshotImg.height
          screenshotCtx.drawImage(screenshotImg, 0, 0)
          const screenshotData = screenshotCtx.getImageData(
            0,
            0,
            screenshotImg.width,
            screenshotImg.height
          )

          // Create canvas for template
          const templateCanvas = document.createElement('canvas')
          const templateCtx = templateCanvas.getContext('2d', { willReadFrequently: true })!
          templateCanvas.width = templateImg.width
          templateCanvas.height = templateImg.height
          templateCtx.drawImage(templateImg, 0, 0)
          const templateData = templateCtx.getImageData(
            0,
            0,
            templateImg.width,
            templateImg.height
          )

          // Template matching: search for template in screenshot
          const matches: Array<{
            x: number
            y: number
            confidence: number
            region: { x: number; y: number; width: number; height: number }
          }> = []

          // Search with step size (faster but less precise)
          // For better accuracy, use stepSize = 1, but it's slower
          const stepSize = 3

          for (
            let y = 0;
            y <= screenshotImg.height - templateImg.height;
            y += stepSize
          ) {
            for (
              let x = 0;
              x <= screenshotImg.width - templateImg.width;
              x += stepSize
            ) {
              let total = 0
              let totalDiff = 0

              // Compare template with screenshot region
              for (let ty = 0; ty < templateImg.height; ty++) {
                for (let tx = 0; tx < templateImg.width; tx++) {
                  const templateIdx = (ty * templateImg.width + tx) * 4
                  const screenshotIdx =
                    ((y + ty) * screenshotImg.width + (x + tx)) * 4

                  if (
                    screenshotIdx + 3 >= screenshotData.data.length ||
                    templateIdx + 3 >= templateData.data.length
                  ) {
                    continue
                  }

                  // Get RGBA values
                  const templateR = templateData.data[templateIdx]
                  const templateG = templateData.data[templateIdx + 1]
                  const templateB = templateData.data[templateIdx + 2]
                  const templateA = templateData.data[templateIdx + 3]

                  const screenshotR = screenshotData.data[screenshotIdx]
                  const screenshotG = screenshotData.data[screenshotIdx + 1]
                  const screenshotB = screenshotData.data[screenshotIdx + 2]
                  const screenshotA = screenshotData.data[screenshotIdx + 3]

                  // Skip transparent pixels in template
                  if (templateA < 128) {
                    continue
                  }

                  // Calculate color difference (normalized 0-1)
                  const rDiff = Math.abs(templateR - screenshotR) / 255
                  const gDiff = Math.abs(templateG - screenshotG) / 255
                  const bDiff = Math.abs(templateB - screenshotB) / 255
                  const aDiff = Math.abs(templateA - screenshotA) / 255

                  const pixelDiff = (rDiff + gDiff + bDiff + aDiff) / 4

                  totalDiff += pixelDiff
                  total++
                }
              }

              if (total > 0) {
                const avgDiff = totalDiff / total
                const confidence = 1 - avgDiff // Higher confidence = less difference

                if (confidence >= threshold) {
                  matches.push({
                    x: x + Math.floor(templateImg.width / 2),
                    y: y + Math.floor(templateImg.height / 2),
                    confidence,
                    region: {
                      x,
                      y,
                      width: templateImg.width,
                      height: templateImg.height,
                    },
                  })
                }
              }
            }
          }

          // Sort matches by confidence (highest first)
          matches.sort((a, b) => b.confidence - a.confidence)

          // Return best match(es)
          const topMatches = matches.slice(0, maxMatches)

          if (topMatches.length > 0) {
            const bestMatch = topMatches[0]
            return {
              found: true,
              x: bestMatch.x,
              y: bestMatch.y,
              confidence: bestMatch.confidence,
              region: bestMatch.region,
              allMatches:
                topMatches.length > 1
                  ? topMatches.map((m) => ({
                      x: m.x,
                      y: m.y,
                      confidence: m.confidence,
                      region: m.region,
                    }))
                  : undefined,
            }
          }

          return { found: false }
        },
        {
          templateBase64,
          screenshotBase64: screenshotBuffer.toString('base64'),
          threshold,
          maxMatches,
        }
      )

      const finalResult = result as ImageSearchResult
      if (finalResult.found) {
        console.log('[ImageSearchHelper] ✅ Image found!', {
          confidence: finalResult.confidence?.toFixed(2),
          position: `(${finalResult.x}, ${finalResult.y})`,
        })
      } else {
        console.log('[ImageSearchHelper] ❌ Image not found (below threshold or not on page)')
      }

      return finalResult
    } catch (error) {
      console.error('[ImageSearchHelper] ❌ Error in image search:', error)
      return {
        found: false,
        confidence: 0,
      }
    }
  }

  /**
   * Click on an image found on the page
   * Combines findImage and click in one operation
   * 
   * @example
   * ```typescript
   * await ImageSearchHelper.clickImage(
   *   page,
   *   './templates/continue-google-button.png',
   *   { threshold: 0.8, timeout: 10000 }
   * )
   * ```
   */
  static async clickImage(
    page: Page,
    templateImagePath: string,
    options: ImageSearchOptions = {}
  ): Promise<void> {
    const result = await this.waitForImage(page, templateImagePath, options)

    if (!result.found || result.x === undefined || result.y === undefined) {
      throw new Error(`Image not found: ${templateImagePath}`)
    }

    // Click at the center of the found image
    await page.mouse.click(result.x, result.y)
  }

  /**
   * Convert image file to Base64 string
   * Useful for storing template images in database or config
   * 
   * @example
   * ```typescript
   * const base64 = await ImageSearchHelper.imageToBase64('./templates/button.png')
   * // Store base64 in database or config
   * ```
   */
  static async imageToBase64(imagePath: string): Promise<string> {
    try {
      const imageBuffer = await fs.readFile(imagePath)
      return imageBuffer.toString('base64')
    } catch (error) {
      throw new Error(`Failed to read image file: ${imagePath} - ${error}`)
    }
  }

  /**
   * Save Base64 image string to file
   * Useful for retrieving template images from database or config
   * 
   * @example
   * ```typescript
   * await ImageSearchHelper.base64ToImage(base64String, './templates/button.png')
   * ```
   */
  static async base64ToImage(
    base64String: string,
    outputPath: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath)
      await fs.mkdir(dir, { recursive: true })

      const imageBuffer = Buffer.from(base64String, 'base64')
      await fs.writeFile(outputPath, imageBuffer)
    } catch (error) {
      throw new Error(`Failed to write image file: ${outputPath} - ${error}`)
    }
  }

  /**
   * Take a screenshot of a specific element using locator
   * Useful for creating template images programmatically
   * 
   * @example
   * ```typescript
   * const buttonLocator = page.locator('button[data-action="click->auth#openSignInModal"]')
   * await ImageSearchHelper.screenshotElement(buttonLocator, './templates/login-button.png')
   * ```
   */
  static async screenshotElement(
    locator: Locator,
    outputPath: string
  ): Promise<void> {
    try {
      // Ensure directory exists
      const dir = path.dirname(outputPath)
      await fs.mkdir(dir, { recursive: true })

      await locator.screenshot({ path: outputPath })
    } catch (error) {
      throw new Error(
        `Failed to screenshot element to: ${outputPath} - ${error}`
      )
    }
  }
}
