import os
from dotenv import load_dotenv

load_dotenv()

# Database
DATABASE_PATH = "gmail_accounts.db"

# GPMLogin API settings
GPMLOGIN_API_URL = os.getenv("GPMLOGIN_API_URL", "http://127.0.0.1:19995")
GPMLOGIN_API_VERSION = "v3"

# Monitoring settings
CHECK_INTERVAL_MINUTES = 60  # Kiểm tra mỗi giờ
ALERT_EMAIL = os.getenv("ALERT_EMAIL", "")  # Email nhận cảnh báo

# Gmail settings
GMAIL_LOGIN_URL = "https://accounts.google.com/signin"
GMAIL_INBOX_URL = "https://mail.google.com"

# API Server settings (Vercel)
API_SERVER_URL = os.getenv("API_SERVER_URL", "https://your-app.vercel.app")
SYNC_TO_SERVER = os.getenv("SYNC_TO_SERVER", "true").lower() == "true"

# Chăm sóc settings
CARE_ENABLED = True
CARE_INTERVAL_HOURS = 24  # Chăm sóc mỗi 24 giờ
MIN_CARE_INTERVAL_HOURS = 6  # Tối thiểu 6 giờ giữa các lần chăm sóc

# Browser settings
BROWSER_TIMEOUT = 30  # Timeout cho browser operations (seconds)

# Manual login settings
MANUAL_LOGIN_WAIT_FOR_2FA = True  # Đợi người dùng xử lý 2FA/challenge
MANUAL_LOGIN_2FA_WAIT_SECONDS = 300  # Đợi tối đa 5 phút (300 giây) để xử lý 2FA
MANUAL_LOGIN_2FA_CHECK_INTERVAL = 10  # Kiểm tra lại mỗi 10 giây

# Threading settings
DEFAULT_MAX_THREADS = 3  # Số luồng mặc định để chạy check/care
MAX_THREADS_LIMIT = 10  # Số luồng tối đa

# Proxy API Server settings
PROXY_API_SERVER_URL = os.getenv("PROXY_API_SERVER_URL", "")  # URL của proxy API server (ví dụ: http://192.168.1.41)

