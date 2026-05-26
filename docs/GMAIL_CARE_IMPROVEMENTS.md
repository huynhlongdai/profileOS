# Cải thiện Gmail Care Behavior - Human-like và Error Handling

## Vấn đề

1. Các thao tác care quá nhanh, không giống hành động con người
2. Cần xử lý logic xác định các lỗi xảy ra để bỏ qua lỗi thông minh hơn

## Giải pháp

### 1. Thêm Delays giữa các bước lớn

Sau mỗi bước chính trong `performCare()`, thêm delay 2-4 giây để mô phỏng thời gian suy nghĩ/đọc của con người:

```typescript
// Sau mỗi bước lớn
await this.randomDelay(2000, 4000) // 2-4 giây nghỉ giữa các bước
```

### 2. Tăng Delays ở các điểm quan trọng

- Sau navigate: 3-5 giây (thay vì 2-3)
- Sau click: 1-2 giây (thay vì 0.5-1)
- Sau typing: 1.5-2.5 giây (thay vì 0.5-1)
- Sau đọc email: 3-8 giây (thay vì 2-5)

### 3. Human-like Typing

Thay vì `fill()` nhanh, type từng ký tự với delay ngẫu nhiên 50-150ms giữa mỗi ký tự:

```typescript
async humanType(element, text: string): Promise<void> {
  for (const char of text) {
    await element.type(char, { delay: 50 + Math.random() * 100 })
  }
}
```

### 4. Error Classification và Smart Skipping

Phân loại lỗi để quyết định có nên bỏ qua hay không:

```typescript
enum ErrorType {
  SKIP_AND_CONTINUE = 'skip',      // Bỏ qua và tiếp tục
  RETRY_ONCE = 'retry',            // Thử lại 1 lần
  FATAL = 'fatal'                  // Dừng luôn
}

function classifyError(error: any): ErrorType {
  // Timeout, element not found -> SKIP
  // Network error -> RETRY_ONCE
  // Critical error -> FATAL
}
```

## Chi tiết cải thiện

### performCare() - Thêm delays giữa bước

```typescript
// Bước 1
await this.checkUnreadEmails()
await this.randomDelay(2000, 4000) // Nghỉ sau bước 1

// Bước 2
await this.interactWithEmails()
await this.randomDelay(2000, 4000) // Nghỉ sau bước 2

// ... và tương tự
```

### ensureGmailInbox() - Tăng delay sau navigate

```typescript
await this.page.goto('https://mail.google.com')
await this.randomDelay(3000, 5000) // Tăng từ 2-3 lên 3-5
```

### readEmails() - Tăng thời gian đọc

```typescript
await emailElem.click()
await this.randomDelay(3000, 8000) // Tăng từ 2-5 lên 3-8
```

### createDraftEmail() - Human-like typing

```typescript
// Thay vì
await toInput.fill(this.email)

// Dùng
await this.humanType(toInput, this.email)
await this.randomDelay(1500, 2500)
```

### Error Handling

```typescript
try {
  await someAction()
} catch (error) {
  const errorType = this.classifyError(error)
  if (errorType === ErrorType.SKIP_AND_CONTINUE) {
    console.warn('[GmailCare] Skipping action due to non-critical error:', error.message)
    return false
  } else if (errorType === ErrorType.RETRY_ONCE) {
    // Retry logic
  } else {
    throw error // Fatal
  }
}
```

## Implementation Plan

1. ✅ Thêm delays giữa các bước lớn
2. ✅ Tăng delays ở các điểm quan trọng
3. ✅ Thêm human-like typing function
4. ✅ Cải thiện error handling với classification

