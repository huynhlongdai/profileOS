# 📖 Guide: Using Automation Recording & Replay

## Quick Start

### 1. Prerequisites
- ✅ GPMTool server running (`npm run dev`)
- ✅ At least one profile started (via `/profiles` page)
- ✅ Browser profile must have remote debugging enabled

### 2. Recording Actions

#### Via Web UI
1. Go to http://localhost:3211/automation
2. Select a running profile from dropdown
3. Enter recording name and description
4. Click **"Start Recording"**
5. Perform actions in the browser:
   - Click elements
   - Type in inputs
   - Navigate pages
   - Select dropdowns
   - Right-click, double-click, drag-drop
6. Click **"Stop Recording"** when done

#### Via CLI Test Script
```bash
node test-automation.mjs
```
This will:
- Find a running profile
- Start recording
- Wait 30 seconds for manual actions
- Stop and save recording
- Display results

### 3. Viewing Recordings

Go to http://localhost:3211/automation to see all recordings:
- View action count
- See recording status
- Preview actions (click Eye icon)

### 4. Converting to Template

1. Click **"Convert to Template"** icon on a recording
2. Define template variables (optional):
   - Identify input fields that should be variables
   - Give them meaningful names
   - Set default values
3. Enter template details:
   - Name
   - Description
   - Category (social-media, e-commerce, testing, etc.)
4. Save

### 5. Executing Templates

1. Go to `/automation/templates`
2. Select a template
3. Click **"Execute"**
4. Fill in variable values
5. Select target profile
6. Run

---

## Supported Actions

### Core Actions
- `navigate` - Navigate to URL
- `click` - Click element
- `input` - Type into field
- `select` - Select dropdown option
- `wait` - Wait for duration
- `scroll` - Scroll page

### Tier 1: Advanced Mouse
- `hover` - Hover over element
- `rightClick` - Right-click context menu
- `doubleClick` - Double-click element
- `dragAndDrop` - Drag and drop

### Tier 1: Element Checks
- `waitElement` - Wait for element to appear
- `checkElement` - Verify element exists
- `getElementText` - Extract text content
- `getElementAttribute` - Get attribute value

### Tier 2: Variables & Data
- `setVariable` - Set variable value
- `incrementVariable` - Increment number variable
- `decrementVariable` - Decrement number variable
- `getClipboard` - Read clipboard
- `setClipboard` - Write to clipboard

---

## Best Practices

### Recording
1. **Start clean** - Begin from a known state (e.g., homepage)
2. **Be deliberate** - Perform actions slowly and clearly
3. **Avoid randomness** - Use consistent selectors
4. **Test selectors** - Verify they work across page reloads

### Templates
1. **Use variables** - Make templates reusable
2. **Add waits** - Account for loading times
3. **Document** - Add clear descriptions
4. **Test first** - Verify template works before sharing

### Execution
1. **Check profile** - Ensure correct profile is selected
2. **Verify variables** - Double-check all values
3. **Monitor logs** - Watch execution logs for errors
4. **Have fallback** - Keep manual steps as backup

---

## Troubleshooting

### Recording doesn't start
**Error**: "Profile is not running"
- ✅ Go to `/profiles` and start a profile first
- ✅ Wait for status to show "running"
- ✅ Verify remote debugging port is set

**Error**: "Failed to inject recorder"
- ✅ Profile might be frozen - restart it
- ✅ Check browser console for errors
- ✅ Ensure port is accessible

### No actions recorded
- ✅ Verify recording indicator shows in browser (red badge top-right)
- ✅ Perform visible actions (clicks, typing)
- ✅ Check browser console for recorder errors
- ✅ Try injecting recorder again

### Execution fails
**Error**: "Element not found"
- ✅ Page structure may have changed
- ✅ Try re-recording with updated selectors
- ✅ Add explicit waits before element interactions

**Error**: "Profile not running"
- ✅ Start the target profile before execution
- ✅ Ensure profile has remote debugging

### Actions execute too fast
- ✅ Add `wait` actions between steps
- ✅ Increase default timeout in config
- ✅ Use `waitElement` for dynamic content

---

## Architecture

```
┌─────────────────────────────────────────────┐
│           Frontend UI (/automation)         │
│  ┌──────────────┐  ┌──────────────────────┐ │
│  │  Recorder    │  │  Templates &         │ │
│  │  Controls    │  │  Executions          │ │
│  └──────────────┘  └──────────────────────┘ │
└───────────────┬─────────────────────────────┘
                │ REST API
┌───────────────▼─────────────────────────────┐
│        Backend Services                     │
│  ┌─────────────────┐  ┌──────────────────┐ │
│  │ AutomationService│  │ActionRecording   │ │
│  │                 │  │Service           │ │
│  └────────┬────────┘  └──────────────────┘ │
└───────────┼────────────────────────────────┘
            │
┌───────────▼────────────────────────────────┐
│   Browser (via CDP)                        │
│  ┌─────────────────────────────────────┐  │
│  │   Injected Recorder Script          │  │
│  │   (window.__gpmRecorder)            │  │
│  │                                     │  │
│  │  - Captures click/input/navigate   │  │
│  │  - Generates selectors             │  │
│  │  - Sends to backend API            │  │
│  └─────────────────────────────────────┘  │
└────────────────────────────────────────────┘
```

---

## API Reference

### Start Recording
```bash
POST /api/automation/recordings
{
  "profileId": "profile_id",
  "name": "My Recording",
  "description": "Optional description"
}
```

### Stop Recording
```bash
POST /api/automation/recordings/:id/stop
```

### Convert to Template
```bash
POST /api/automation/recordings/:id/convert
{
  "name": "My Template",
  "category": "social-media",
  "variables": [
    { "name": "email", "type": "string", "defaultValue": "" }
  ]
}
```

### Execute Template
```bash
POST /api/automation/templates/:id/execute
{
  "profileId": "profile_id",
  "variables": {
    "email": "user@example.com"
  }
}
```

---

## Examples

### Example 1: Gmail Login Flow
```
1. navigate - https://gmail.com
2. wait - 2000ms
3. input - input[type="email"] → "user@gmail.com"
4. click - button:has-text("Next")
5. wait - 2000ms
6. input - input[type="password"] → "{{password}}"
7. click - button:has-text("Next")
8. waitElement - [aria-label="Inbox"]
```

### Example 2: Form Fill
```
1. navigate - https://example.com/form
2. input - #name → "{{fullName}}"
3. input - #email → "{{email}}"
4. select - #country → "{{countryCode}}"
5. click - input[type="checkbox"]#agree
6. click - button[type="submit"]
7. waitElement - .success-message
```

---

For more help, see the main README or contact support.
