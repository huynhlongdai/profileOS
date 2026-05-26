# Recording Quick Start - Hướng dẫn nhanh

## Cách thực hiện Record

### Bước 1: Import RecordingHelper

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'
```

### Bước 2: Tạo Recording Session

```typescript
const helper = new RecordingHelper()
const session = await helper.startRecording(page, {
  name: 'Tên Recording',
  accountType: 'gmail', // hoặc 'coingecko'
  description: 'Mô tả recording',
  url: page.url(), // Optional
})
```

### Bước 3: Thực hiện Actions và Ghi lại

**Cách 1: Ghi lại thủ công (Recommended)**

```typescript
// Thực hiện action
await page.click('button.login')

// Ghi lại action
session.recorder.addAction({
  type: 'click',
  selector: 'button.login',
  description: 'Click login button'
})
```

**Cách 2: Sử dụng wrapAction (Tự động ghi lại)**

```typescript
const click = helper.wrapAction(page, session.recorder, 'click')
const fill = helper.wrapAction(page, session.recorder, 'fill')

// Tự động ghi lại khi thực thi
await click('button.login', {}, 'Click login button')
await fill('input.email', { value: 'user@example.com' }, 'Enter email')
```

### Bước 4: Dừng và Lưu Recording

```typescript
const recordingId = await session.stopAndSave()
console.log(`Recording saved: ${recordingId}`)
```

## Ví dụ đầy đủ

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'

async function recordLogin(page: Page) {
  const helper = new RecordingHelper()
  const session = await helper.startRecording(page, {
    name: 'Gmail Login',
    accountType: 'gmail',
    description: 'Record Gmail login process'
  })
  
  try {
    // Navigate
    await page.goto('https://mail.google.com')
    session.recorder.addAction({
      type: 'navigate',
      url: 'https://mail.google.com',
      description: 'Navigate to Gmail'
    })
    
    // Click và type
    await page.click('button.login')
    session.recorder.addAction({
      type: 'click',
      selector: 'button.login',
      description: 'Click login button'
    })
    
    await page.fill('input.email', 'user@example.com')
    session.recorder.addAction({
      type: 'fill',
      selector: 'input.email',
      value: 'user@example.com',
      description: 'Enter email'
    })
    
  } finally {
    // Luôn dừng và lưu recording
    const recordingId = await session.stopAndSave()
    return recordingId
  }
}
```

## Các Action Types hỗ trợ

- `click` - Click vào element
- `type` - Gõ text (có delay giữa các ký tự)
- `fill` - Điền giá trị vào field
- `select` - Chọn option trong dropdown
- `navigate` - Điều hướng đến URL
- `wait` - Chờ một khoảng thời gian
- `waitForSelector` - Chờ element xuất hiện
- `waitForNavigation` - Chờ navigation hoàn tất
- `screenshot` - Chụp màn hình
- `scroll` - Scroll trang
- `hover` - Hover vào element
- `keyboard` - Nhấn phím
- `evaluate` - Chạy JavaScript
- `assert` - Kiểm tra điều kiện

## Tích hợp vào Service hiện có

### Ví dụ: Thêm Recording vào CoinGeckoCandyService

```typescript
async claimCandyForAccount(accountId: string, enableRecording: boolean = false) {
  // ... setup code ...
  
  const page = candyPage.getPage()
  let recordingSession = null
  
  // Bắt đầu recording nếu được bật
  if (enableRecording) {
    const helper = new RecordingHelper()
    recordingSession = await helper.startRecording(page, {
      name: `CoinGecko Candy - ${accountId}`,
      accountType: 'coingecko',
      url: page.url(),
    })
  }
  
  try {
    // Thực hiện actions
    await page.click('button#collectButton')
    
    // Ghi lại nếu có recording
    if (recordingSession) {
      recordingSession.recorder.addAction({
        type: 'click',
        selector: 'button#collectButton',
        description: 'Click Collect Candy button'
      })
    }
    
  } finally {
    // Dừng và lưu nếu có recording
    if (recordingSession) {
      const recordingId = await recordingSession.stopAndSave()
      console.log(`Recording saved: ${recordingId}`)
    }
  }
}
```

## Xem và Replay Recording

1. **Xem recordings**: Vào `/recordings` trong UI
2. **Replay**: Click nút "Replay" và chọn account/profile
3. **View details**: Click "View" để xem tất cả actions đã ghi

## Tài liệu chi tiết

Xem [RECORDING_GUIDE.md](./RECORDING_GUIDE.md) để biết thêm chi tiết và ví dụ nâng cao.

