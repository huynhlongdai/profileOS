# Recording với GPM Automate Integration

## Tổng quan

Module Recording đã được mở rộng để tương thích với các tính năng của GPM Automate, bao gồm:

1. **Các biến mặc định từ GPM Automate** - Tự động thu thập trong quá trình recording
2. **Các action types mới** - Hỗ trợ các blocks từ GPM Automate
3. **UI dễ sử dụng** - Tạo recording dễ dàng hơn

## Các biến mặc định (GPM Automate Variables)

Khi thực hiện recording, hệ thống sẽ tự động thu thập các biến sau (tương tự GPM Automate):

### 1. **$profileName**
- **Mô tả**: Tên của profile đang mở
- **Thu thập**: Tự động từ Profile.name khi bắt đầu recording
- **Ví dụ**: `"Profile 123"`

### 2. **$profileId**
- **Mô tả**: ID của profile đang mở
- **Thu thập**: Tự động từ Profile.id khi bắt đầu recording
- **Ví dụ**: `"clx1234567890"`

### 3. **$profileProxy**
- **Mô tả**: Proxy mà profile đang sử dụng
- **Thu thập**: Tự động từ Profile.proxy.rawProxy khi bắt đầu recording
- **Ví dụ**: `"192.168.1.100:8080"`

### 4. **$accountId** (nếu có)
- **Mô tả**: ID của account liên quan
- **Thu thập**: Tự động từ Account.id nếu recording được tạo từ account
- **Ví dụ**: `"clx0987654321"`

### 5. **$accountLabel** (nếu có)
- **Mô tả**: Label của account
- **Thu thập**: Tự động từ Account.label
- **Ví dụ**: `"Gmail Account 1"`

### 6. **$accountIdentifier** (nếu có)
- **Mô tả**: Identifier của account (email, username, etc.)
- **Thu thập**: Tự động từ Account.identifier
- **Ví dụ**: `"user@example.com"`

## Các Action Types mới (GPM Automate Blocks)

### 1. **Clipboard Operations**
```typescript
{
  type: 'clipboard',
  operation: 'read' | 'write' | 'clear',
  value?: string,  // For write operation
  description: 'Read from clipboard'
}
```

### 2. **Cookie Operations**
```typescript
{
  type: 'cookie',
  operation: 'get' | 'set' | 'delete' | 'getAll',
  name?: string,
  value?: string,
  domain?: string,
  path?: string,
  expires?: number
}
```

### 3. **Alert Handling**
```typescript
{
  type: 'alert',
  action: 'accept' | 'dismiss' | 'getText' | 'sendText',
  text?: string  // For sendText action
}
```

### 4. **File Operations**
```typescript
// Read file
{
  type: 'fileRead',
  path: '/path/to/file.txt',
  encoding: 'utf8' | 'base64' | 'binary'
}

// Write file
{
  type: 'fileWrite',
  path: '/path/to/file.txt',
  content: 'File content',
  encoding: 'utf8',
  append: false
}
```

### 5. **HTTP Request**
```typescript
{
  type: 'httpRequest',
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
  url: 'https://api.example.com/data',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  timeout: 30000
}
```

### 6. **Image Search**
```typescript
{
  type: 'imageSearch',
  templatePath: '/path/to/template.png',
  threshold: 0.8,
  region: {
    x: 0,
    y: 0,
    width: 1920,
    height: 1080
  }
}
```

### 7. **Switch Tab**
```typescript
{
  type: 'switchTab',
  index: 0,  // Tab index (0-based)
  // OR
  url: 'https://example.com',
  // OR
  title: 'Page Title'
}
```

### 8. **Variable Operations**
```typescript
// Set variable
{
  type: 'setVariable',
  variableName: 'myVar',
  value: 'some value'
}

// Get variable
{
  type: 'getVariable',
  variableName: 'myVar'
}
```

## Sử dụng UI để tạo Recording

### Cách 1: Trang New Recording (Recommended)

1. Vào `/recordings/new`
2. Điền thông tin:
   - **Recording Name**: Tên recording
   - **Description**: Mô tả (optional)
   - **Account Type**: Loại account (optional)
   - **Select Account** hoặc **Select Profile**: Chọn một trong hai
   - **Starting URL**: URL bắt đầu
3. Click **"Start Recording"**
4. Hệ thống sẽ tự động:
   - Thu thập metadata (profileName, profileId, profileProxy, etc.)
   - Kết nối đến profile
   - Bắt đầu recording
   - Thực hiện các actions mẫu
   - Lưu recording

### Cách 2: Test Recording (Quick Test)

1. Vào `/recordings`
2. Click **"Test Record"**
3. Chọn account hoặc profile
4. Nhập URL (optional)
5. Click **"Start Test"**

## Ví dụ sử dụng trong Code

### Thu thập Metadata tự động

```typescript
import { RecordingHelper } from '@/core/record/RecordingHelper'

async function recordWithMetadata(page: Page, profileId: string, accountId?: string) {
  const helper = new RecordingHelper()
  
  // Get profile info for metadata
  const { prisma } = await import('@/lib/prisma')
  const profile = await prisma.profile.findUnique({
    where: { id: profileId },
    include: { proxy: true },
  })
  
  const session = await helper.startRecording(page, {
    name: 'My Recording',
    accountType: 'gmail',
    // Metadata sẽ được thêm vào trong metadata object
  })
  
  // Metadata sẽ bao gồm:
  // - profileName: profile.name
  // - profileId: profile.id
  // - profileProxy: profile.proxy?.rawProxy
  // - accountId, accountLabel, accountIdentifier (nếu có)
  
  // ... perform actions ...
  
  const recordingId = await session.stopAndSave()
}
```

### Sử dụng các Action Types mới

```typescript
// Clipboard
session.recorder.addAction({
  type: 'clipboard',
  operation: 'write',
  value: 'Text to copy',
  description: 'Write to clipboard'
})

// Cookie
session.recorder.addAction({
  type: 'cookie',
  operation: 'set',
  name: 'session',
  value: 'abc123',
  domain: '.example.com',
  description: 'Set cookie'
})

// HTTP Request
session.recorder.addAction({
  type: 'httpRequest',
  method: 'POST',
  url: 'https://api.example.com/data',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ key: 'value' }),
  description: 'Send API request'
})

// Image Search
session.recorder.addAction({
  type: 'imageSearch',
  templatePath: './resources/images/button.png',
  threshold: 0.8,
  description: 'Find button by image'
})
```

## Xem Metadata trong Recording

Sau khi recording được lưu, bạn có thể xem metadata trong:

1. **Database**: Các trường `profileName`, `profileId`, `profileProxy` trong `ActionRecording` metadata
2. **UI**: Trong trang `/recordings`, click "View" để xem chi tiết
3. **API**: `GET /api/recordings/[id]` sẽ trả về metadata đầy đủ

## So sánh với GPM Automate

| GPM Automate | Our Recording Module |
|--------------|---------------------|
| `$profileName` | `metadata.profileName` |
| `$profileId` | `metadata.profileId` |
| `$profileProxy` | `metadata.profileProxy` |
| `$inputExcel` | Có thể thêm sau (File operations) |
| Clipboard Block | `clipboard` action type |
| Cookie Block | `cookie` action type |
| HTTP Block | `httpRequest` action type |
| Image Search | `imageSearch` action type |

## Lưu ý

1. **Metadata tự động thu thập**: Khi bạn tạo recording qua UI hoặc API với accountId/profileId, metadata sẽ được tự động thu thập.

2. **Manual recording**: Nếu bạn record manually trong code, bạn có thể tự thêm metadata:

```typescript
recording.metadata.profileName = 'My Profile'
recording.metadata.profileId = 'profile-id'
recording.metadata.profileProxy = '192.168.1.100:8080'
```

3. **Variables trong actions**: Các variables như `$profileName` có thể được sử dụng trong actions (sẽ được resolve khi replay).

## Tài liệu tham khảo

- [GPM Automate Documentation](https://docs.gpmautomate.com/)
- [Recording Guide](./RECORDING_GUIDE.md)
- [Recording Quick Start](./RECORDING_QUICKSTART.md)

