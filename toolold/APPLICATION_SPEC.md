# Đặc tả Kỹ thuật Chi tiết - Ứng dụng Quản lý Gmail với GPMLogin

## 📋 Mục lục

1. [Tổng quan](#tổng-quan)
2. [Kiến trúc Hệ thống](#kiến-trúc-hệ-thống)
3. [Các Module Chính](#các-module-chính)
4. [Database Schema](#database-schema)
5. [API Endpoints](#api-endpoints)
6. [Tính năng Chi tiết](#tính-năng-chi-tiết)
7. [Cấu hình](#cấu-hình)
8. [Workflow & Luồng Xử lý](#workflow--luồng-xử-lý)
9. [Bảo mật](#bảo-mật)
10. [Deployment](#deployment)
11. [Troubleshooting](#troubleshooting)

---

## 1. Tổng quan

### 1.1. Mô tả

Ứng dụng **Quản lý Gmail với GPMLogin** là một hệ thống tự động hóa quản lý và giám sát nhiều tài khoản Gmail. Ứng dụng tích hợp với GPMLogin browser để quản lý nhiều profile trình duyệt độc lập, tự động kiểm tra trạng thái đăng nhập, chăm sóc tài khoản, và quản lý proxy.

### 1.2. Mục tiêu

- **Quản lý tập trung**: Quản lý hàng trăm/thousands tài khoản Gmail từ một giao diện
- **Tự động hóa**: Tự động kiểm tra, đăng nhập lại, và chăm sóc tài khoản
- **Bảo mật**: Sử dụng proxy riêng cho mỗi profile, quản lý cookies
- **Giám sát**: Theo dõi trạng thái tài khoản, phát hiện sớm vấn đề
- **Tối ưu**: Giảm thiểu số lượng profile cần thiết thông qua quản lý cookie thông minh

### 1.3. Công nghệ sử dụng

- **Backend**: Python 3.8+
- **Web Framework**: Flask 3.0.0
- **Database**: SQLite3
- **Browser Automation**: Selenium 4.15.2
- **Browser Profiles**: GPMLogin API
- **Frontend**: HTML5, CSS3, JavaScript (Vanilla)
- **Deployment**: Vercel (cho API server)

---

## 2. Kiến trúc Hệ thống

### 2.1. Kiến trúc Tổng quan

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (Web Dashboard)                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Dashboard  │  │  Account Mgmt │  │  Proxy Mgmt  │     │
│  │   (HTML/JS)  │  │   (HTML/JS)   │  │   (HTML/JS)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ HTTP/REST API
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              Flask Backend (dashboard_server.py)             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   API Routes │  │  Task Manager │  │  Thread Pool │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│  Database    │  │ GPMLogin API │  │ Proxy API    │
│  (SQLite)    │  │  (Local)     │  │  (External)  │
└──────────────┘  └──────────────┘  └──────────────┘
        │                   │                   │
        │                   ▼                   │
        │          ┌──────────────┐              │
        │          │   Selenium   │              │
        │          │  WebDriver   │              │
        │          └──────────────┘              │
        │                   │                   │
        └───────────────────┼───────────────────┘
                            ▼
                  ┌──────────────┐
                  │   Chrome      │
                  │   Browser     │
                  └──────────────┘
```

### 2.2. Các Component Chính

1. **Web Dashboard** (`templates/dashboard.html`, `static/js/dashboard.js`)
   - Giao diện người dùng chính
   - Quản lý tài khoản, proxy, profiles
   - Hiển thị thống kê và logs

2. **Flask Backend** (`dashboard_server.py`)
   - RESTful API server
   - Quản lý tasks và threading
   - Xử lý business logic

3. **Database Layer** (`database.py`)
   - SQLite database operations
   - Schema management và migrations
   - CRUD operations

4. **GPMLogin Manager** (`gpmlogin_manager.py`)
   - Tích hợp với GPMLogin API
   - Quản lý browser profiles
   - Cookie injection và validation

5. **Gmail Monitor** (`gmail_monitor.py`)
   - Kiểm tra trạng thái tài khoản
   - Tự động đăng nhập lại
   - Lên lịch kiểm tra định kỳ

6. **Gmail Care** (`gmail_care.py`)
   - Chăm sóc tài khoản tự động
   - Mô phỏng hành vi người dùng
   - Tương tác với Gmail

7. **Proxy Manager** (`proxy_manager.py`)
   - Quản lý thư viện proxy
   - Phân bổ proxy tự động
   - Kiểm tra và thay đổi IP proxy

8. **Account Manager** (`account_manager.py`)
   - Tạo tài khoản mới
   - Tự động tạo GPMLogin profile
   - Gán proxy tự động

9. **Proxy API Client** (`proxy_api_client.py`)
   - Tích hợp với Proxy API Server
   - Kiểm tra trạng thái proxy
   - Thay đổi IP proxy

---

## 3. Các Module Chính

### 3.1. Database Module (`database.py`)

#### 3.1.1. Chức năng

- Quản lý kết nối SQLite
- Tạo và migrate database schema
- CRUD operations cho accounts, proxies, logs
- Quản lý cookies và care history

#### 3.1.2. Các Methods Chính

```python
class Database:
    # Account operations
    def add_account(email, password, ...)
    def get_account_by_email(email)
    def get_all_accounts()
    def update_account(account_id, ...)
    def delete_account(account_id)
    def update_account_status(email, status)
    
    # Proxy operations
    def add_proxy(proxy_dict, proxy_api_url)
    def get_all_proxies()
    def get_proxy_by_id(proxy_id)
    def get_proxy_by_raw(raw_proxy)
    def update_proxy(proxy_id, ...)
    def update_proxy_status(proxy_id, status, ip, ...)
    
    # Log operations
    def add_log(account_id, event_type, message)
    def get_logs(account_id, limit)
    
    # Cookie operations
    def save_cookies(account_id, cookies)
    def get_cookies(account_id)
    
    # Care history
    def add_care_history(account_id, actions, success, ...)
```

### 3.2. GPMLogin Manager (`gpmlogin_manager.py`)

#### 3.2.1. Chức năng

- Tích hợp với GPMLogin API
- Quản lý browser profiles
- Cookie injection và validation
- Tự động thay đổi proxy IP khi mở profile

#### 3.2.2. Các Methods Chính

```python
class GPMLoginManager:
    def get_profiles(page=1, per_page=100, search=None)
    def get_profile_info(profile_id)
    def create_profile_for_email(email, proxy=None, auto_login=False)
    def start_profile(profile_id, account_data=None)
    def stop_profile(profile_id)
    def connect_to_profile(profile_id, account_data=None)
    def check_gmail_status(driver, email)
    def login_gmail(driver, email, password)
    def inject_cookies(driver, cookies)
    def validate_and_refresh_cookies(driver, account_data)
    def update_profile_proxy(profile_id, proxy)
```

#### 3.2.3. Tính năng Đặc biệt

- **Cookie Management**: Tự động inject cookies khi mở profile, validate và refresh nếu hết hạn
- **Auto Change Proxy IP**: Tự động thay đổi IP proxy khi mở profile nếu `auto_change_proxy=True`
- **Status Detection**: Phát hiện chính xác trạng thái đăng nhập bằng cách kiểm tra UI elements

### 3.3. Gmail Monitor (`gmail_monitor.py`)

#### 3.3.1. Chức năng

- Kiểm tra trạng thái tài khoản định kỳ
- Phát hiện tài khoản bị đăng xuất
- Tự động đăng nhập lại
- Lên lịch chăm sóc tài khoản

#### 3.3.2. Các Methods Chính

```python
class GmailMonitor:
    def check_account(account_data)
    def check_all_accounts()
    def care_account_if_needed(account_data)
```

#### 3.3.3. Workflow Kiểm tra

1. Kết nối đến GPMLogin profile
2. Inject cookies nếu có
3. Kiểm tra trạng thái đăng nhập
4. Nếu chưa đăng nhập → đăng nhập lại
5. Lưu cookies mới
6. Cập nhật trạng thái trong database
7. Ghi log

### 3.4. Gmail Care (`gmail_care.py`)

#### 3.4.1. Chức năng

- Chăm sóc tài khoản tự động
- Mô phỏng hành vi người dùng thực
- Giữ tài khoản hoạt động để tránh bị die

#### 3.4.2. Các Hành động Chăm sóc

1. **Đọc email mới**: Mở và đọc các email mới trong inbox
2. **Tương tác email**: Star, archive, mark as important
3. **Tìm kiếm**: Tìm kiếm email theo từ khóa
4. **Duyệt thư mục**: Xem các thư mục khác (Sent, Drafts, Spam)
5. **Tạo draft**: Tạo draft email (không gửi)
6. **Scroll**: Scroll inbox để load thêm email

#### 3.4.3. Human Behavior

- Sử dụng `human_behavior.py` để mô phỏng hành vi người dùng
- Random delays giữa các hành động
- Random mouse movements
- Natural scrolling patterns

### 3.5. Proxy Manager (`proxy_manager.py`)

#### 3.5.1. Chức năng

- Quản lý thư viện proxy từ file hoặc database
- Phân bổ proxy tự động
- Parse proxy strings (nhiều format)
- Kiểm tra proxy đã sử dụng

#### 3.5.2. Các Methods Chính

```python
class ProxyManager:
    def load_proxies()
    def parse_proxy(proxy_string)
    def get_unused_proxy()
    def mark_proxy_as_used(proxy, account_id)
    def mark_proxy_as_unused(proxy)
```

#### 3.5.3. Proxy Formats Hỗ trợ

- `ip:port`
- `ip:port:user:pass`
- `http://ip:port`
- `socks5://ip:port:user:pass`

### 3.6. Proxy API Client (`proxy_api_client.py`)

#### 3.6.1. Chức năng

- Tích hợp với Proxy API Server
- Kiểm tra trạng thái proxy (public IP)
- Thay đổi IP proxy

#### 3.6.2. Các Methods Chính

```python
class ProxyAPIClient:
    def check_proxy_status(proxy_string, api_server_url=None)
    def reset_proxy_ip(proxy_string, api_server_url=None)
    def check_proxy_status_via_public_api(proxy_string)
```

#### 3.6.3. Tính năng

- **Public IP Check**: Sử dụng `httpbin.org/ip` để kiểm tra IP proxy
- **Auto URL Normalization**: Tự động thêm `http://` nếu thiếu scheme
- **IP Extraction**: Trích xuất `public_ip`, `public_ip_v6`, `proxy_ip` từ response

### 3.7. Account Manager (`account_manager.py`)

#### 3.7.1. Chức năng

- Tạo tài khoản mới với tự động hóa
- Tự động tạo GPMLogin profile
- Tự động gán proxy

#### 3.7.2. Workflow Tạo Tài khoản

1. Kiểm tra email đã tồn tại
2. Tự động gán proxy (nếu `auto_assign_proxy=True`)
3. Tự động tạo GPMLogin profile (nếu `auto_create_profile=True`)
4. Lưu vào database
5. Trả về thông tin tài khoản và profile

---

## 4. Database Schema

### 4.1. Bảng `accounts`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | INTEGER PRIMARY KEY | ID tài khoản |
| `email` | TEXT UNIQUE NOT NULL | Email tài khoản |
| `password` | TEXT | Mật khẩu (có thể mã hóa) |
| `gpmlogin_profile_id` | TEXT | ID profile GPMLogin |
| `gpmlogin_profile_name` | TEXT | Tên profile GPMLogin |
| `proxy_id` | INTEGER | ID proxy (FK) |
| `proxy_info` | TEXT | Thông tin proxy (string) |
| `status` | TEXT DEFAULT 'active' | Trạng thái: active, logged_out, error, deleted |
| `last_check` | DATETIME | Thời gian kiểm tra cuối |
| `last_login` | DATETIME | Thời gian đăng nhập cuối |
| `last_care` | DATETIME | Thời gian chăm sóc cuối |
| `auto_change_proxy` | BOOLEAN DEFAULT 0 | Tự động thay đổi IP proxy khi mở profile |
| `notes` | TEXT | Ghi chú |
| `created_at` | DATETIME | Thời gian tạo |

### 4.2. Bảng `proxies`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | INTEGER PRIMARY KEY | ID proxy |
| `proxy_type` | TEXT | Loại proxy: http, socks5 |
| `host` | TEXT | IP/hostname proxy |
| `port` | TEXT | Port proxy |
| `username` | TEXT | Username (nếu có) |
| `password` | TEXT | Password (nếu có) |
| `raw_proxy` | TEXT UNIQUE | Proxy string gốc |
| `is_used` | BOOLEAN DEFAULT 0 | Đã sử dụng chưa |
| `used_by_account_id` | INTEGER | ID tài khoản đang dùng (FK) |
| `proxy_api_url` | TEXT | URL Proxy API Server |
| `proxy_status` | TEXT | Trạng thái proxy: active, inactive, error |
| `public_ip` | TEXT | IP công cộng hiện tại |
| `public_ip_v6` | TEXT | IPv6 công cộng hiện tại |
| `last_check_status` | DATETIME | Thời gian kiểm tra cuối |
| `created_at` | DATETIME | Thời gian tạo |

### 4.3. Bảng `account_logs`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | INTEGER PRIMARY KEY | ID log |
| `account_id` | INTEGER | ID tài khoản (FK) |
| `event_type` | TEXT | Loại sự kiện: check, login, care, error |
| `message` | TEXT | Nội dung log |
| `timestamp` | DATETIME | Thời gian |

### 4.4. Bảng `care_history`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | INTEGER PRIMARY KEY | ID lịch sử |
| `account_id` | INTEGER | ID tài khoản (FK) |
| `actions` | TEXT | Danh sách hành động (JSON) |
| `success` | BOOLEAN | Thành công hay không |
| `error_message` | TEXT | Thông báo lỗi (nếu có) |
| `timestamp` | DATETIME | Thời gian |

### 4.5. Bảng `deleted_profiles`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `id` | INTEGER PRIMARY KEY | ID bản ghi |
| `profile_id` | TEXT UNIQUE NOT NULL | ID profile GPMLogin |
| `profile_name` | TEXT | Tên profile |
| `email` | TEXT | Email liên kết |
| `deleted_at` | DATETIME | Thời gian xóa |
| `permanently_deleted` | BOOLEAN DEFAULT 0 | Đã xóa vĩnh viễn chưa |

---

## 5. API Endpoints

### 5.1. Account Management

#### `GET /api/accounts`
Lấy danh sách tất cả tài khoản.

**Response:**
```json
{
  "success": true,
  "accounts": [
    {
      "id": 1,
      "email": "user@example.com",
      "status": "active",
      "last_check": "2025-12-04T10:00:00",
      "proxy_info": "proxy.example.com:8080",
      ...
    }
  ]
}
```

#### `POST /api/accounts`
Thêm tài khoản mới.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "proxy": "proxy.example.com:8080",
  "auto_create_profile": true,
  "auto_assign_proxy": true,
  "notes": "Ghi chú"
}
```

#### `GET /api/accounts/<account_id>`
Lấy thông tin chi tiết một tài khoản.

#### `PUT /api/accounts/<account_id>`
Cập nhật thông tin tài khoản.

#### `DELETE /api/accounts/<account_id>`
Xóa tài khoản.

#### `POST /api/accounts/<account_id>/check`
Kiểm tra trạng thái một tài khoản.

#### `POST /api/accounts/check-all`
Kiểm tra tất cả tài khoản.

**Request Body:**
```json
{
  "max_threads": 3
}
```

#### `POST /api/accounts/<account_id>/care`
Chăm sóc một tài khoản.

#### `POST /api/accounts/care-selected`
Chăm sóc các tài khoản đã chọn.

**Request Body:**
```json
{
  "account_ids": [1, 2, 3],
  "max_threads": 3
}
```

#### `PUT /api/accounts/<account_id>/proxy`
Cập nhật proxy cho tài khoản.

**Request Body:**
```json
{
  "proxy": "proxy.example.com:8080"
}
```

#### `PUT /api/accounts/<account_id>/auto-change-proxy`
Cập nhật cài đặt tự động thay đổi IP proxy.

**Request Body:**
```json
{
  "auto_change_proxy": true
}
```

#### `GET /api/accounts/<account_id>/cookies`
Lấy cookies của tài khoản.

#### `GET /api/accounts/export`
Xuất danh sách tài khoản (CSV).

### 5.2. Proxy Management

#### `GET /api/proxies`
Lấy danh sách proxy.

**Query Parameters:**
- `simple=true`: Chỉ lấy thông tin cơ bản (nhanh hơn)

#### `POST /api/proxies`
Thêm proxy mới.

**Request Body:**
```json
{
  "proxy": "proxy.example.com:8080:user:pass",
  "proxy_api_url": "http://192.168.1.41"
}
```

#### `GET /api/proxies/<proxy_id>`
Lấy thông tin chi tiết một proxy.

#### `PUT /api/proxies/<proxy_id>`
Cập nhật thông tin proxy.

#### `DELETE /api/proxies/<proxy_id>`
Xóa proxy.

#### `POST /api/proxy/check`
Kiểm tra trạng thái proxy.

**Request Body:**
```json
{
  "proxy": "proxy.example.com:8080",
  "proxy_api_url": "http://192.168.1.41"
}
```

**Response:**
```json
{
  "success": true,
  "status": "active",
  "public_ip": "171.254.79.238",
  "public_ip_v6": "2402:800:63ad:fc3:...",
  "proxy_ip": "192.168.1.1"
}
```

#### `POST /api/proxy/reset`
Thay đổi IP proxy.

**Request Body:**
```json
{
  "proxy": "proxy.example.com:8080",
  "proxy_api_url": "http://192.168.1.41/reset?proxy=..."
}
```

#### `PUT /api/proxies/<proxy_id>/status`
Cập nhật trạng thái proxy trong database.

**Request Body:**
```json
{
  "proxy_status": "active",
  "public_ip": "171.254.79.238",
  "public_ip_v6": "2402:800:63ad:fc3:...",
  "proxy_ip": "192.168.1.1"
}
```

### 5.3. GPMLogin Profile Management

#### `GET /api/gpmlogin/profiles`
Lấy danh sách GPMLogin profiles.

**Query Parameters:**
- `page`: Số trang (mặc định: 1)
- `per_page`: Số items mỗi trang (mặc định: 100)
- `search`: Tìm kiếm theo tên

**Response:**
```json
{
  "success": true,
  "profiles": [...],
  "count": 50,
  "synced": true
}
```

#### `POST /api/gpmlogin/profiles/sync-proxy`
Đồng bộ proxy từ GPMLogin về database.

**Response:**
```json
{
  "success": true,
  "message": "Đã đồng bộ 10 profiles",
  "synced_count": 10
}
```

#### `POST /api/gpmlogin/profiles/login`
Đăng nhập thủ công cho một profile.

**Request Body:**
```json
{
  "profile_id": "uuid-here",
  "email": "user@example.com",
  "password": "password123"
}
```

#### `POST /api/gpmlogin/profiles/<profile_id>/start`
Mở profile GPMLogin.

**Request Body:**
```json
{
  "account_data": {
    "proxy_id": 1,
    "proxy_api_url": "http://192.168.1.41",
    "auto_change_proxy": true
  }
}
```

#### `POST /api/gpmlogin/profiles/<profile_id>/stop`
Đóng profile GPMLogin.

#### `GET /api/gpmlogin/profiles/active`
Lấy danh sách profiles đang mở.

#### `DELETE /api/gpmlogin/profiles/<profile_id>`
Xóa profile GPMLogin (vĩnh viễn).

#### `PUT /api/gpmlogin/profiles/<profile_id>/proxy`
Cập nhật proxy cho profile GPMLogin.

**Request Body:**
```json
{
  "proxy": "proxy.example.com:8080"
}
```

### 5.4. Logs & Statistics

#### `GET /api/logs/<account_id>`
Lấy logs của một tài khoản.

**Query Parameters:**
- `limit`: Số lượng logs (mặc định: 100)

#### `GET /api/stats`
Lấy thống kê tổng quan.

**Response:**
```json
{
  "success": true,
  "stats": {
    "total_accounts": 100,
    "active_accounts": 95,
    "logged_out_accounts": 3,
    "error_accounts": 2,
    "total_proxies": 50,
    "used_proxies": 45,
    "unused_proxies": 5
  }
}
```

### 5.5. Task Management

#### `GET /api/tasks/running`
Lấy danh sách tasks đang chạy.

#### `POST /api/tasks/stop/<task_id>`
Dừng một task đang chạy.

### 5.6. Deleted Profiles

#### `GET /api/deleted-profiles`
Lấy danh sách profiles đã xóa.

#### `POST /api/deleted-profiles/<profile_id>/restore`
Khôi phục profile đã xóa.

#### `DELETE /api/deleted-profiles/<profile_id>/permanent`
Xóa vĩnh viễn profile.

---

## 6. Tính năng Chi tiết

### 6.1. Quản lý Tài khoản

#### 6.1.1. Thêm Tài khoản

- Nhập email và password
- Tự động tạo GPMLogin profile (nếu bật)
- Tự động gán proxy (nếu bật)
- Lưu vào database
- Hỗ trợ thêm nhiều tài khoản cùng lúc

#### 6.1.2. Kiểm tra Tài khoản

- **Kiểm tra đơn lẻ**: Kiểm tra một tài khoản cụ thể
- **Kiểm tra tất cả**: Kiểm tra tất cả tài khoản với thread pool
- **Tự động kiểm tra**: Lên lịch kiểm tra định kỳ (mặc định: mỗi giờ)
- **Kết quả**: Cập nhật trạng thái (active, logged_out, error)

#### 6.1.3. Chăm sóc Tài khoản

- **Tự động**: Tự động chăm sóc sau mỗi lần kiểm tra thành công (nếu đủ thời gian)
- **Thủ công**: Chăm sóc các tài khoản đã chọn
- **Hành động**: Đọc email, tương tác, tìm kiếm, duyệt thư mục
- **Thời gian tối thiểu**: 6 giờ giữa các lần chăm sóc

### 6.2. Quản lý Proxy

#### 6.2.1. Thêm Proxy

- Thêm từ file `proxies.txt`
- Thêm thủ công qua UI
- Thêm nhiều proxy cùng lúc (textarea)
- Hỗ trợ nhiều format: `ip:port`, `ip:port:user:pass`

#### 6.2.2. Quản lý Proxy

- Xem danh sách proxy
- Chỉnh sửa proxy (thêm Proxy API Server URL)
- Xóa proxy
- Đánh dấu đã sử dụng/chưa sử dụng

#### 6.2.3. Kiểm tra Proxy

- **Check Status**: Kiểm tra trạng thái proxy (active/inactive)
- **Check IP**: Lấy IP công cộng hiện tại (IPv4 và IPv6)
- **Sử dụng Public API**: Sử dụng `httpbin.org/ip` để kiểm tra
- **Lưu kết quả**: Tự động lưu trạng thái và IP vào database

#### 6.2.4. Thay đổi IP Proxy

- **Change IP**: Thay đổi IP proxy qua Proxy API Server
- **Auto Change**: Tự động thay đổi IP khi mở profile (nếu bật)
- **Lưu kết quả**: Cập nhật IP mới vào database

### 6.3. Quản lý GPMLogin Profiles

#### 6.3.1. Xem Danh sách Profiles

- Hiển thị tất cả profiles từ GPMLogin
- Hiển thị trạng thái (đang mở/đã đóng)
- Hiển thị proxy hiện tại
- Tìm kiếm và lọc profiles

#### 6.3.2. Mở/Đóng Profile

- **Mở profile**: Mở profile trong browser
- **Đóng profile**: Đóng profile đang mở
- **Mở nhiều profile**: Chọn nhiều profiles và mở cùng lúc
- **Auto Change IP**: Tự động thay đổi IP proxy khi mở (nếu bật)

#### 6.3.3. Quản lý Proxy cho Profile

- **Đổi proxy**: Thay đổi proxy cho profile
- **Dropdown inline**: Chọn proxy trực tiếp trong bảng
- **Đồng bộ**: Tự động đồng bộ proxy giữa GPMLogin và database

#### 6.3.4. Đăng nhập Thủ công

- Mở profile và đăng nhập thủ công
- Hỗ trợ 2FA (đợi người dùng xử lý)
- Lưu cookies sau khi đăng nhập

#### 6.3.5. Xóa Profile

- Xóa profile (chuyển vào thùng rác)
- Khôi phục profile đã xóa
- Xóa vĩnh viễn profile

### 6.4. Cookie Management

#### 6.4.1. Lưu Cookies

- Tự động lưu cookies sau mỗi lần đăng nhập thành công
- Lưu vào database (JSON format)

#### 6.4.2. Inject Cookies

- Tự động inject cookies khi mở profile
- Giảm thiểu số lần đăng nhập lại

#### 6.4.3. Validate & Refresh

- Kiểm tra cookies còn hạn không
- Tự động refresh nếu cookies hết hạn
- Đăng nhập lại nếu cookies không hợp lệ

### 6.5. Đồng bộ Dữ liệu

#### 6.5.1. Đồng bộ Proxy

- Tự động đồng bộ proxy từ GPMLogin về database khi load profiles
- Đảm bảo dữ liệu nhất quán giữa các module
- Endpoint đồng bộ thủ công: `POST /api/gpmlogin/profiles/sync-proxy`

#### 6.5.2. Ưu tiên Database

- Frontend ưu tiên hiển thị proxy từ database
- Chỉ dùng `profile.raw_proxy` từ GPMLogin làm fallback

---

## 7. Cấu hình

### 7.1. File `config.py`

```python
# Database
DATABASE_PATH = "gmail_accounts.db"

# GPMLogin API
GPMLOGIN_API_URL = "http://127.0.0.1:19995"
GPMLOGIN_API_VERSION = "v3"

# Monitoring
CHECK_INTERVAL_MINUTES = 60  # Kiểm tra mỗi giờ
ALERT_EMAIL = ""  # Email nhận cảnh báo

# Gmail
GMAIL_LOGIN_URL = "https://accounts.google.com/signin"
GMAIL_INBOX_URL = "https://mail.google.com"

# API Server (Vercel)
API_SERVER_URL = "https://your-app.vercel.app"
SYNC_TO_SERVER = True

# Chăm sóc
CARE_ENABLED = True
CARE_INTERVAL_HOURS = 24  # Chăm sóc mỗi 24 giờ
MIN_CARE_INTERVAL_HOURS = 6  # Tối thiểu 6 giờ

# Browser
BROWSER_TIMEOUT = 30  # Timeout (seconds)

# Manual Login
MANUAL_LOGIN_WAIT_FOR_2FA = True
MANUAL_LOGIN_2FA_WAIT_SECONDS = 300  # 5 phút
MANUAL_LOGIN_2FA_CHECK_INTERVAL = 10  # 10 giây

# Threading
DEFAULT_MAX_THREADS = 3
MAX_THREADS_LIMIT = 10

# Proxy API Server
PROXY_API_SERVER_URL = ""  # URL Proxy API Server
```

### 7.2. File `.env` (Tùy chọn)

```env
GPMLOGIN_API_URL=http://127.0.0.1:19995
API_SERVER_URL=https://your-app.vercel.app
SYNC_TO_SERVER=true
ALERT_EMAIL=your-email@example.com
PROXY_API_SERVER_URL=http://192.168.1.41
```

### 7.3. File `proxies.txt`

```
# Format: ip:port hoặc ip:port:user:pass
proxy1.example.com:8080
proxy2.example.com:8080:username:password
192.168.1.100:3128
```

---

## 8. Workflow & Luồng Xử lý

### 8.1. Workflow Thêm Tài khoản

```
1. User nhập email + password
2. AccountManager.add_account_with_auto_profile()
   ├─ Kiểm tra email đã tồn tại?
   ├─ Auto assign proxy? → ProxyManager.get_unused_proxy()
   ├─ Auto create profile? → GPMLoginManager.create_profile_for_email()
   │  ├─ Tạo profile với proxy
   │  └─ Trả về profile_id
   └─ Database.add_account()
      └─ Lưu email, password, profile_id, proxy_id
3. Trả về kết quả cho user
```

### 8.2. Workflow Kiểm tra Tài khoản

```
1. GmailMonitor.check_account()
   ├─ Kết nối đến GPMLogin profile
   ├─ Inject cookies (nếu có)
   ├─ GPMLoginManager.check_gmail_status()
   │  ├─ Kiểm tra URL hiện tại
   │  ├─ Tìm email trong UI
   │  ├─ Kiểm tra login form
   │  └─ Xác định trạng thái: logged_in / logged_out / unknown
   │
   ├─ Nếu logged_out:
   │  ├─ GPMLoginManager.login_gmail()
   │  ├─ Lưu cookies mới
   │  └─ Cập nhật last_login
   │
   └─ Cập nhật status và last_check trong database
```

### 8.3. Workflow Chăm sóc Tài khoản

```
1. Kiểm tra điều kiện:
   ├─ CARE_ENABLED = True?
   ├─ Đã đủ MIN_CARE_INTERVAL_HOURS?
   └─ Tài khoản đang active?

2. GmailCare.care_account()
   ├─ Đảm bảo đang ở Gmail inbox
   ├─ Đọc email mới (random 3-7 emails)
   ├─ Tương tác email (star, archive)
   ├─ Tìm kiếm email
   ├─ Duyệt thư mục (Sent, Drafts, Spam)
   ├─ Tạo draft email
   └─ Scroll inbox

3. Lưu care_history vào database
```

### 8.4. Workflow Mở Profile với Auto Change IP

```
1. User click "Mở profile"
2. Dashboard gọi POST /api/gpmlogin/profiles/<id>/start
   ├─ Lấy account_data từ database
   ├─ Kiểm tra auto_change_proxy = True?
   │  ├─ Lấy proxy_api_url từ proxy configuration
   │  ├─ ProxyAPIClient.reset_proxy_ip()
   │  │  ├─ Gọi Proxy API Server
   │  │  └─ Lấy IP mới
   │  └─ Cập nhật IP vào database
   │
   └─ GPMLoginManager.start_profile()
      ├─ Inject cookies (nếu có)
      ├─ Validate cookies
      └─ Mở browser
```

### 8.5. Workflow Đồng bộ Proxy

```
1. Frontend gọi GET /api/gpmlogin/profiles
2. Backend lấy profiles từ GPMLogin
3. Backend so sánh profile.raw_proxy với account.proxy_info
   ├─ Nếu khác nhau:
   │  ├─ Parse proxy string
   │  ├─ Tìm hoặc tạo proxy trong database
   │  └─ Cập nhật account.proxy_info và proxy_id
   │
   └─ Trả về profiles với flag synced=true

4. Frontend nhận synced=true
   ├─ Reload accounts từ database
   └─ Render với proxy từ database (ưu tiên)
```

---

## 9. Bảo mật

### 9.1. Lưu trữ Mật khẩu

- Mật khẩu được lưu trực tiếp trong database (chưa mã hóa)
- **Khuyến nghị**: Mã hóa mật khẩu trước khi lưu (có thể mở rộng)

### 9.2. Cookies

- Cookies được lưu trong database (JSON format)
- Chỉ được inject vào browser khi mở profile
- Tự động validate và refresh

### 9.3. Proxy

- Mỗi profile sử dụng proxy riêng
- Proxy credentials được lưu trong database
- Proxy API Server URL có thể cấu hình riêng cho mỗi proxy

### 9.4. API Security

- API chỉ chạy trên localhost (mặc định)
- CORS được bật để hỗ trợ frontend
- **Khuyến nghị**: Thêm authentication nếu deploy public

### 9.5. Database

- SQLite database file (`gmail_accounts.db`)
- **Khuyến nghị**: Backup thường xuyên
- **Khuyến nghị**: Mã hóa database file (có thể mở rộng)

---

## 10. Deployment

### 10.1. Local Development

```bash
# Cài đặt dependencies
pip install -r requirements.txt

# Chạy Flask server
python dashboard_server.py

# Truy cập
http://localhost:5000
```

### 10.2. Production (Local Network)

```bash
# Chạy với host 0.0.0.0 để truy cập từ mạng local
flask run --host=0.0.0.0 --port=5000

# Hoặc trong dashboard_server.py:
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
```

### 10.3. API Server trên Vercel

```bash
cd api_server
npm install -g vercel
vercel login
vercel deploy
```

Cấu hình trong `vercel.json`:
```json
{
  "version": 2,
  "builds": [
    {
      "src": "api/**/*.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "/api/$1"
    }
  ]
}
```

### 10.4. GPMLogin Setup

1. Tải và cài đặt GPMLogin từ [https://gpmloginapp.com](https://gpmloginapp.com)
2. Khởi động GPMLogin
3. Đảm bảo API đang chạy tại `http://127.0.0.1:19995`
4. Cấu hình trong `config.py` nếu cần thay đổi URL

---

## 11. Troubleshooting

### 11.1. Lỗi Kết nối GPMLogin API

**Triệu chứng**: Không thể kết nối đến GPMLogin API

**Giải pháp**:
- Kiểm tra GPMLogin đang chạy
- Kiểm tra API URL trong `config.py`
- Kiểm tra firewall/antivirus
- Thử truy cập `http://127.0.0.1:19995` trong browser

### 11.2. Lỗi Đăng nhập Gmail

**Triệu chứng**: Không thể đăng nhập Gmail

**Giải pháp**:
- Kiểm tra email/password đúng
- Có thể cần xác thực 2FA (sử dụng manual login)
- Google có thể yêu cầu xác minh
- Kiểm tra proxy có hoạt động không

### 11.3. Lỗi Selenium/ChromeDriver

**Triệu chứng**: Lỗi khi khởi động browser

**Giải pháp**:
- Cập nhật Chrome browser
- `webdriver-manager` sẽ tự động tải ChromeDriver
- Kiểm tra version compatibility

### 11.4. Proxy Không Hoạt động

**Triệu chứng**: Không thể kết nối qua proxy

**Giải pháp**:
- Kiểm tra proxy format đúng không
- Kiểm tra proxy có hoạt động không (dùng Proxy API check)
- Kiểm tra proxy credentials đúng không

### 11.5. Cookies Không Lưu

**Triệu chứng**: Phải đăng nhập lại mỗi lần mở profile

**Giải pháp**:
- Kiểm tra cookies có được lưu trong database không
- Kiểm tra `inject_cookies` có được gọi không
- Kiểm tra cookies có hết hạn không

### 11.6. Đồng bộ Proxy Không Hoạt động

**Triệu chứng**: Proxy hiển thị khác nhau giữa các module

**Giải pháp**:
- Gọi endpoint `POST /api/gpmlogin/profiles/sync-proxy` để đồng bộ thủ công
- Kiểm tra logic đồng bộ trong `get_gpmlogin_profiles`
- Refresh trang sau khi đồng bộ

---

## 12. Tài liệu Tham khảo

- **GPMLogin API**: [https://docs.gpmloginapp.com/api-document](https://docs.gpmloginapp.com/api-document)
- **Selenium Documentation**: [https://selenium-python.readthedocs.io/](https://selenium-python.readthedocs.io/)
- **Flask Documentation**: [https://flask.palletsprojects.com/](https://flask.palletsprojects.com/)
- **SQLite Documentation**: [https://www.sqlite.org/docs.html](https://www.sqlite.org/docs.html)

---

## 13. Roadmap & Tính năng Tương lai

### 13.1. Tính năng Đang Phát triển

- [ ] Mã hóa mật khẩu trong database
- [ ] Authentication cho API
- [ ] Webhook notifications
- [ ] Export/Import accounts (JSON)
- [ ] Multi-language support
- [ ] Dark mode cho dashboard

### 13.2. Tính năng Đề xuất

- [ ] Machine learning để phát hiện pattern bất thường
- [ ] Tự động rotate proxy
- [ ] Tích hợp với các email service khác (Outlook, Yahoo)
- [ ] Mobile app
- [ ] Real-time notifications
- [ ] Advanced analytics và reporting

---

**Phiên bản**: 1.0.0  
**Cập nhật lần cuối**: 2025-12-04  
**Tác giả**: Gmail Manager Team

