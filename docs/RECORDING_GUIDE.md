# Recording Guide - Hướng dẫn sử dụng Recording Module

## Tổng quan

Module Recording cho phép bạn ghi lại các hành động browser automation và phát lại chúng sau. Điều này hữu ích để:
- Ghi lại quy trình login
- Tạo automation scripts từ manual actions
- Debug và phân tích các hành động đã thực hiện

## Cách sử dụng

### 1. Basic Recording - Ghi lại cơ bản

#### Trong Plugin Service (ví dụ: CoinGeckoCandyService)

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'
import type { Page } from 'playwright'

export class CoinGeckoCandyService {
  async claimCandyForAccount(accountId: string): Promise<void> {
    // ... setup code ...
    
    const candyPage = await this.browserController.openCoinGeckoCandyPage(session)
    const page = candyPage.getPage()
    
    // Bắt đầu recording
    const recordingHelper = new RecordingHelper()
    const session = await recordingHelper.startRecording(page, {
      name: `CoinGecko Candy Claim - ${accountId}`,
      accountType: 'coingecko',
      description: 'Record candy claim process',
      url: page.url(),
    })
    
    try {
      // Thực hiện các actions và ghi lại
      
      // Cách 1: Ghi lại thủ công
      await page.click('button[data-action="click->auth#openSignInModal"]')
      session.recorder.addAction({
        type: 'click',
        selector: 'button[data-action="click->auth#openSignInModal"]',
        description: 'Click login button'
      })
      
      // Cách 2: Sử dụng wrapAction (tự động ghi lại)
      const wrappedClick = recordingHelper.wrapAction(page, session.recorder, 'click')
      await wrappedClick('button[data-action="click->auth#trackSignInMethodCta"]', {}, 'Click Continue with Google')
      
      // Ghi lại navigation
      session.recorder.addAction({
        type: 'navigate',
        url: 'https://accounts.google.com',
        description: 'Navigate to Google OAuth'
      })
      
      // Ghi lại wait
      await page.waitForTimeout(2000)
      session.recorder.addAction({
        type: 'wait',
        duration: 2000,
        description: 'Wait for page load'
      })
      
      // ... tiếp tục các actions ...
      
    } finally {
      // Dừng và lưu recording
      const recordingId = await session.stopAndSave()
      console.log(`Recording saved: ${recordingId}`)
    }
  }
}
```

### 2. Recording với Manual Actions

Khi bạn tự động thực hiện các actions, bạn cần ghi lại chúng manually:

```typescript
const recorder = session.recorder

// Record click
recorder.addAction({
  type: 'click',
  selector: 'button.submit',
  description: 'Click submit button',
  options: {
    button: 'left',
    timeout: 30000
  }
})

// Record type
recorder.addAction({
  type: 'type',
  selector: 'input[type="email"]',
  text: 'user@example.com',
  description: 'Enter email address',
  options: {
    delay: 100, // milliseconds between keystrokes
    clearFirst: true
  }
})

// Record fill
recorder.addAction({
  type: 'fill',
  selector: 'input[type="password"]',
  value: 'password123',
  description: 'Fill password field'
})

// Record navigation
recorder.addAction({
  type: 'navigate',
  url: 'https://example.com/dashboard',
  description: 'Navigate to dashboard',
  waitUntil: 'domcontentloaded'
})

// Record wait
recorder.addAction({
  type: 'wait',
  duration: 3000,
  description: 'Wait 3 seconds'
})

// Record wait for selector
recorder.addAction({
  type: 'waitForSelector',
  selector: '.loading-complete',
  description: 'Wait for loading to complete',
  options: {
    state: 'visible',
    timeout: 10000
  }
})
```

### 3. Sử dụng wrapAction để tự động ghi lại

`wrapAction` tự động ghi lại action khi bạn thực thi nó:

```typescript
const wrappedClick = recordingHelper.wrapAction(page, session.recorder, 'click')
const wrappedFill = recordingHelper.wrapAction(page, session.recorder, 'fill')
const wrappedType = recordingHelper.wrapAction(page, session.recorder, 'type')

// Sử dụng
await wrappedClick('button.login', {}, 'Click login button')
await wrappedFill('input.email', { value: 'user@example.com' }, 'Fill email')
await wrappedType('input.password', { text: 'pass123', delay: 100 }, 'Type password')
```

### 4. Recording trong Page Controller

Nếu bạn muốn record trong Page Controller (như `CoinGeckoCandyPageController`):

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'

class PlaywrightCoinGeckoCandyPageController implements CoinGeckoCandyPageController {
  private page: Page
  private recorder?: ActionRecorder // Optional recorder
  
  constructor(page: Page, recorder?: ActionRecorder) {
    this.page = page
    this.recorder = recorder
  }
  
  async performLoginWithGoogle(googleEmail: string): Promise<void> {
    // Record action nếu có recorder
    if (this.recorder) {
      this.recorder.addAction({
        type: 'click',
        selector: 'button[data-action="click->auth#openSignInModal"]',
        description: 'Click login button'
      })
    }
    
    await this.page.click('button[data-action="click->auth#openSignInModal"]')
    
    // ... tiếp tục ...
  }
}
```

### 5. Tích hợp vào Service với Optional Recording

Để làm recording trở thành optional (chỉ record khi cần):

```typescript
async claimCandyForAccount(
  accountId: string,
  options?: { enableRecording?: boolean; recordingName?: string }
): Promise<void> {
  // ... setup code ...
  
  const page = candyPage.getPage()
  let recordingSession: RecordingSession | null = null
  
  // Bắt đầu recording nếu được bật
  if (options?.enableRecording) {
    const recordingHelper = new RecordingHelper()
    recordingSession = await recordingHelper.startRecording(page, {
      name: options.recordingName || `CoinGecko Candy Claim - ${accountId}`,
      accountType: 'coingecko',
      url: page.url(),
    })
  }
  
  try {
    // Thực hiện actions
    // Ghi lại nếu có recording session
    if (recordingSession) {
      recordingSession.recorder.addAction({ /* ... */ })
    }
    
    // ... actions ...
    
  } finally {
    // Stop recording nếu có
    if (recordingSession) {
      const recordingId = await recordingSession.stopAndSave()
      console.log(`Recording saved: ${recordingId}`)
    }
  }
}
```

### 6. Replay Recording

Sau khi đã record, bạn có thể replay qua UI hoặc API:

#### Qua UI:
1. Vào `/recordings`
2. Click "Replay" trên recording muốn replay
3. Chọn account hoặc profile
4. Click "Start Replay"

#### Qua API:
```typescript
const response = await fetch(`/api/recordings/${recordingId}/replay`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    accountId: 'account-id', // hoặc
    profileId: 'profile-id',
    options: {
      speedMultiplier: 1.0,
      stopOnError: false,
      retryOnError: true,
      retryCount: 3
    }
  })
})
```

## Ví dụ hoàn chỉnh

### Ví dụ 1: Record Gmail Login

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'
import type { Page } from 'playwright'

async function recordGmailLogin(page: Page, email: string, password: string) {
  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: `Gmail Login - ${email}`,
    accountType: 'gmail',
    description: 'Record Gmail login process',
    url: 'https://mail.google.com'
  })
  
  try {
    // Navigate
    await page.goto('https://mail.google.com')
    session.recorder.addAction({
      type: 'navigate',
      url: 'https://mail.google.com',
      description: 'Navigate to Gmail'
    })
    
    // Enter email
    await page.fill('input[type="email"]', email)
    session.recorder.addAction({
      type: 'fill',
      selector: 'input[type="email"]',
      value: email,
      description: 'Enter email address'
    })
    
    // Click Next
    await page.click('button:has-text("Next")')
    session.recorder.addAction({
      type: 'click',
      selector: 'button:has-text("Next")',
      description: 'Click Next button'
    })
    
    // Wait
    await page.waitForTimeout(2000)
    session.recorder.addAction({
      type: 'wait',
      duration: 2000,
      description: 'Wait for password field'
    })
    
    // Enter password
    await page.fill('input[type="password"]', password)
    session.recorder.addAction({
      type: 'fill',
      selector: 'input[type="password"]',
      value: password, // ⚠️ Lưu ý: Trong thực tế nên mask password
      description: 'Enter password'
    })
    
    // Click Next
    await page.click('button:has-text("Next")')
    session.recorder.addAction({
      type: 'click',
      selector: 'button:has-text("Next")',
      description: 'Click Next to login'
    })
    
    // Wait for login
    await page.waitForURL('**/mail.google.com/**', { timeout: 30000 })
    
  } finally {
    const recordingId = await session.stopAndSave()
    console.log(`Gmail login recorded: ${recordingId}`)
    return recordingId
  }
}
```

### Ví dụ 2: Record với wrapAction

```typescript
async function recordWithWrapAction(page: Page) {
  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: 'Example Recording',
    accountType: 'gmail'
  })
  
  const click = helper.wrapAction(page, session.recorder, 'click')
  const fill = helper.wrapAction(page, session.recorder, 'fill')
  
  await fill('input.email', { value: 'test@example.com' }, 'Enter email')
  await click('button.submit', {}, 'Click submit')
  
  const recordingId = await session.stopAndSave()
  return recordingId
}
```

## Lưu ý quan trọng

1. **Security**: Không nên ghi lại passwords hoặc sensitive data trong plain text. Có thể mask hoặc exclude các fields nhạy cảm.

2. **Timing**: Recording tự động ghi lại timestamp, nhưng bạn cần manual record các wait actions để replay chính xác.

3. **Selectors**: Sử dụng selectors ổn định (id, data-attributes) thay vì class names có thể thay đổi.

4. **Error Handling**: Luôn wrap recording trong try-finally để đảm bảo recording được stop và save.

5. **Performance**: Recording có thể làm chậm một chút, chỉ enable khi cần.

## API Reference

### RecordingHelper

- `startRecording(page, options)` - Bắt đầu recording session
- `recordClick(recorder, selector, description)` - Ghi lại click action
- `recordType(recorder, selector, text, description)` - Ghi lại type action
- `recordNavigate(recorder, url, description)` - Ghi lại navigation
- `recordWait(recorder, duration, description)` - Ghi lại wait
- `wrapAction(page, recorder, actionType)` - Wrap action để tự động record

### ActionRecorder

- `start()` - Bắt đầu recording
- `stop()` - Dừng và trả về recording data
- `addAction(action)` - Thêm action vào recording
- `getStatus()` - Lấy trạng thái recording hiện tại

## Troubleshooting

### Recording không lưu được

- Kiểm tra database connection
- Kiểm tra ActionRecordingService đã được khởi tạo đúng
- Xem console logs để tìm lỗi

### Actions không được ghi lại

- Đảm bảo đã gọi `recorder.start()` trước khi add actions
- Kiểm tra `recorder.isRecording` status
- Sử dụng `recorder.getStatus()` để debug

### Replay không chạy đúng

- Kiểm tra selectors vẫn còn valid
- Xem logs trong ActionRecordingRun để biết lỗi
- Có thể cần điều chỉnh timing hoặc retry settings

