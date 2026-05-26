# Image Templates Directory

Thư mục này chứa các template images để sử dụng với ImageSearchHelper.

## Cách sử dụng

### 1. Chụp ảnh template

Khi cần tìm một element bằng image search:

1. Mở trang web trong browser
2. Chụp ảnh màn hình của element cần tìm (chỉ phần element, không cần cả trang)
3. Lưu vào thư mục này với tên mô tả rõ ràng

**Lưu ý quan trọng:**
- Đảm bảo tỉ lệ scale/resolution của trang web khi chụp ảnh **giống hệt** với khi chạy thực tế
- Chụp ảnh ở độ phân giải và zoom level giống nhau
- Nếu có thể, chụp riêng element (không có background phức tạp)

### 2. Sử dụng trong code

```typescript
import { ImageSearchHelper } from '@/core/utils/ImageSearchHelper'

// Tìm và click button
await ImageSearchHelper.clickImage(
  page,
  './resources/images/continue-google-button.png',
  { threshold: 0.8, timeout: 10000 }
)

// Hoặc chỉ tìm vị trí
const result = await ImageSearchHelper.findImage(
  page,
  './resources/images/login-button.png',
  { threshold: 0.7 }
)

if (result.found && result.x && result.y) {
  await page.mouse.click(result.x, result.y)
}
```

### 3. Template images cho CoinGecko

- `continue-google-button.png` - Nút "Continue with Google" trong login modal
- `collect-candy-button.png` - Nút "Collect Candy"
- `login-button.png` - Nút "Log in"

## Lưu ý

- Threshold (0-1): Giá trị càng cao = yêu cầu độ chính xác càng lớn (mặc định: 0.7)
- Image search chậm hơn selectors, nên dùng như fallback strategy
- Đảm bảo image format là PNG với transparency nếu cần

