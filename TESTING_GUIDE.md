# Testing Guide

## 🧪 Hướng dẫn Test Ứng dụng

### 1. Kiểm tra Server

```powershell
# Test health endpoint
Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing
```

Kết quả mong đợi: `{"status":"ok","timestamp":"..."}`

### 2. Test API Endpoints

#### Accounts API

**Tạo Account:**
```powershell
$body = @{
    label = "Test Gmail"
    accountType = "gmail"
    identifier = "test@gmail.com"
    password = "testpassword"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/accounts" -Method POST -Body $body -ContentType "application/json"
```

**List Accounts:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/accounts" -UseBasicParsing
```

**Check Account:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/accounts/{accountId}/check" -Method POST
```

#### Profiles API

**List Profiles:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/profiles" -UseBasicParsing
```

**Sync Profiles:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/profiles/sync" -Method POST
```

**Start Profile:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/profiles/{profileId}/start" -Method POST
```

#### Proxies API

**Tạo Proxy:**
```powershell
$body = @{
    label = "Test Proxy"
    rawProxy = "192.168.1.1:8080:user:pass"
} | ConvertTo-Json

Invoke-WebRequest -Uri "http://localhost:3000/api/proxies" -Method POST -Body $body -ContentType "application/json"
```

**Check Proxy:**
```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/proxies/{proxyId}/check" -Method POST
```

#### Stats API

```powershell
Invoke-WebRequest -Uri "http://localhost:3000/api/stats" -UseBasicParsing
```

### 3. Test Frontend

1. **Dashboard**: http://localhost:3000/dashboard
   - Kiểm tra hiển thị statistics
   - Test refresh button

2. **Accounts Page**: http://localhost:3000/accounts
   - Test "Add Account" button → Modal hiển thị
   - Điền form và submit
   - Test "Check" button
   - Test "Care" button
   - Test "Edit" button
   - Test "Delete" button
   - Test bulk operations

3. **Profiles Page**: http://localhost:3000/profiles
   - Test "Sync from GPMLogin" button
   - Test "Start" button
   - Test "Stop" button

4. **Proxies Page**: http://localhost:3000/proxies
   - Test "Add Proxy" button
   - Test "Check" button
   - Test "Reset IP" button
   - Test "Edit" button
   - Test "Delete" button

5. **Modules Page**: http://localhost:3000/modules
   - Kiểm tra hiển thị Gmail module

6. **Logs Page**: http://localhost:3000/logs
   - Kiểm tra hiển thị logs

### 4. Test Gmail Plugin

**Prerequisites:**
- GPMLogin đang chạy
- Có profile trong GPMLogin
- Có account với profile được assign

**Test Check:**
1. Tạo account Gmail
2. Assign profile cho account
3. Click "Check" button
4. Kiểm tra logs để xem quá trình

**Test Login:**
1. Account có password
2. Click "Check" (sẽ tự động login nếu logged out)
3. Kiểm tra status chuyển sang "active"

**Test Care:**
1. Account phải ở trạng thái "active"
2. Click "Care" button
3. Kiểm tra logs để xem các actions

### 5. Test Error Handling

1. **Invalid Account ID**: Test với account ID không tồn tại
2. **Missing Required Fields**: Submit form thiếu required fields
3. **GPMLogin Not Running**: Test khi GPMLogin không chạy
4. **Invalid Proxy Format**: Test với proxy format sai

### 6. Test Toast Notifications

- Success: Khi tạo/update thành công
- Error: Khi có lỗi
- Info: Khi có thông tin

### 7. Test Loading States

- Kiểm tra buttons hiển thị "..." khi đang process
- Kiểm tra buttons bị disable khi đang process

## ✅ Checklist Test

- [ ] Health endpoint hoạt động
- [ ] Tạo account thành công
- [ ] List accounts hiển thị đúng
- [ ] Check account hoạt động
- [ ] Care account hoạt động
- [ ] Edit account hoạt động
- [ ] Delete account hoạt động
- [ ] Sync profiles từ GPMLogin
- [ ] Start/Stop profile hoạt động
- [ ] Tạo proxy thành công
- [ ] Check proxy hoạt động
- [ ] Reset IP proxy hoạt động
- [ ] Toast notifications hiển thị
- [ ] Loading states hoạt động đúng
- [ ] Error handling hoạt động
- [ ] UI responsive trên mobile

## 🐛 Common Issues

### Issue: "Module not found: playwright"
**Solution**: 
```powershell
npm install playwright
npx playwright install chromium
```

### Issue: "Environment variable not found: DATABASE_URL"
**Solution**: Tạo file `.env` hoặc set environment variable

### Issue: "Prisma Client not generated"
**Solution**: 
```powershell
npm run db:generate
```

### Issue: "GPMLogin API connection failed"
**Solution**: 
- Kiểm tra GPMLogin đang chạy
- Kiểm tra API URL trong `.env`
- Test: `Invoke-WebRequest -Uri "http://127.0.0.1:19995"`

### Issue: "500 Internal Server Error"
**Solution**: 
- Kiểm tra console logs
- Kiểm tra database connection
- Kiểm tra Prisma client đã generate

## 📊 Performance Testing

1. **Load Test**: Tạo 100 accounts và test bulk operations
2. **Concurrent Requests**: Test nhiều requests cùng lúc
3. **Database Performance**: Test với database lớn

## 🔍 Debug Tips

1. **Browser Console**: Mở F12 để xem errors
2. **Network Tab**: Kiểm tra API requests/responses
3. **Server Logs**: Xem terminal để xem server logs
4. **Prisma Studio**: `npm run db:studio` để xem database

