import time
import requests
from datetime import datetime, timedelta
from database import Database
from gpmlogin_manager import GPMLoginManager
from gmail_care import GmailCare
from config import CHECK_INTERVAL_MINUTES, API_SERVER_URL, SYNC_TO_SERVER, CARE_ENABLED, MIN_CARE_INTERVAL_HOURS

class GmailMonitor:
    def __init__(self):
        self.db = Database()
        self.gpm_manager = GPMLoginManager()
        self.care = GmailCare()
    
    def check_account(self, account_data):
        """Kiểm tra một tài khoản"""
        account_id = account_data["id"]
        email = account_data["email"]
        password = account_data.get("password")
        profile_id = account_data.get("gpmlogin_profile_id")
        
        print(f"[Monitor] ========== BẮT ĐẦU KIỂM TRA: {email} ==========")
        print(f"[Monitor] Account ID: {account_id}")
        print(f"[Monitor] Email: {email}")
        print(f"[Monitor] Profile ID: {profile_id}")
        
        driver = None
        try:
            # Kết nối đến browser qua GPMLogin
            if profile_id:
                print(f"[Monitor] Đang kết nối đến profile {profile_id}...")
                # Truyền account_data để inject cookies nếu có
                driver = self.gpm_manager.connect_to_profile(profile_id, account_data=account_data)
                if driver:
                    print(f"[Monitor] ✓ Đã kết nối đến browser")
                else:
                    print(f"[Monitor] ✗ Không thể kết nối đến browser")
            else:
                # Nếu không có profile_id, tạo profile mới hoặc sử dụng browser thường
                print(f"[Monitor] ⚠ Cảnh báo: {email} chưa có GPMLogin profile_id")
                self.db.add_log(account_id, "error", "Chưa có GPMLogin profile_id")
                self.db.update_account_status(email, "error")
                return
            
            if not driver:
                self.db.add_log(account_id, "error", "Không thể kết nối browser")
                self.db.update_account_status(email, "error")
                print(f"[Monitor] ✗ Không thể kết nối browser - dừng kiểm tra")
                return
            
            # Kiểm tra trạng thái Gmail
            print(f"[Monitor] Đang kiểm tra trạng thái Gmail...")
            gmail_status = self.gpm_manager.check_gmail_status(driver, email)
            print(f"[Monitor] Trạng thái Gmail: {gmail_status}")
            
            if gmail_status == "logged_out":
                # Thử đăng nhập lại
                if password:
                    login_result = self.gpm_manager.login_gmail(driver, email, password)
                    # Xử lý kết quả login (có thể là bool hoặc dict)
                    if isinstance(login_result, dict):
                        if login_result.get("needs_2fa"):
                            self.db.update_account_status(email, "needs_2fa")
                            self.db.add_log(account_id, "needs_2fa", "Cần xác thực 2FA")
                            print(f"⚠ Cần 2FA cho {email}")
                        elif login_result.get("success"):
                            self.db.update_account_status(email, "active")
                            self.db.update_last_login(email)
                            # Lưu cookies nếu có
                            if login_result.get("cookies"):
                                self.db.update_account(account_id, cookies=login_result.get("cookies"))
                            self.db.add_log(account_id, "login_success", "Đăng nhập lại thành công")
                            print(f"✓ Đăng nhập lại thành công: {email}")
                            
                            # Sau khi đăng nhập thành công, thực hiện chăm sóc
                            if CARE_ENABLED:
                                self.perform_care_if_needed(driver, account_data)
                    elif login_result == True:
                        self.db.update_account_status(email, "active")
                        self.db.update_last_login(email)
                        # Lấy và lưu cookies sau khi đăng nhập thành công
                        try:
                            cookies = driver.get_cookies()
                            import json
                            cookies_json = json.dumps(cookies)
                            self.db.update_account(account_id, cookies=cookies_json)
                            print(f"[Monitor] ✓ Đã lưu cookies ({len(cookies)} cookies) cho {email}")
                        except Exception as e:
                            print(f"[Monitor] ⚠ Lỗi lấy cookies: {e}")
                        self.db.add_log(account_id, "login_success", "Đăng nhập lại thành công")
                        print(f"✓ Đăng nhập lại thành công: {email}")
                        
                        # Sau khi đăng nhập thành công, thực hiện chăm sóc
                        if CARE_ENABLED:
                            self.perform_care_if_needed(driver, account_data)
                    else:
                        self.db.update_account_status(email, "login_failed")
                        self.db.add_log(account_id, "login_failed", "Không thể đăng nhập lại")
                        print(f"✗ Không thể đăng nhập: {email}")
                else:
                    self.db.update_account_status(email, "logged_out")
                    self.db.add_log(account_id, "logged_out", "Tài khoản bị đăng xuất (không có password)")
                    print(f"⚠ Tài khoản bị đăng xuất: {email}")
            
            elif gmail_status == "logged_in":
                self.db.update_account_status(email, "active")
                # Lấy và lưu cookies khi đã đăng nhập
                try:
                    cookies = driver.get_cookies()
                    import json
                    cookies_json = json.dumps(cookies)
                    self.db.update_account(account_id, cookies=cookies_json)
                    print(f"[Monitor] ✓ Đã cập nhật cookies ({len(cookies)} cookies) cho {email}")
                except Exception as e:
                    print(f"[Monitor] ⚠ Lỗi lấy cookies: {e}")
                self.db.add_log(account_id, "status_check", "Tài khoản hoạt động bình thường")
                print(f"✓ Tài khoản hoạt động: {email}")
                
                # Thực hiện chăm sóc nếu cần
                if CARE_ENABLED:
                    self.perform_care_if_needed(driver, account_data)
            
            elif gmail_status == "wrong_account":
                self.db.update_account_status(email, "wrong_account")
                self.db.add_log(account_id, "wrong_account", "Đăng nhập sai tài khoản")
                print(f"⚠ Sai tài khoản: {email}")
            
            elif gmail_status == "error":
                self.db.update_account_status(email, "error")
                self.db.add_log(account_id, "error", "Lỗi kiểm tra tài khoản")
                print(f"✗ Lỗi kiểm tra {email}")
            
            # Cập nhật thời gian kiểm tra
            self.db.update_account_status(email, self.db.get_account_by_email(email)["status"])
            
            # Đồng bộ lên server nếu bật
            if SYNC_TO_SERVER:
                self.sync_to_server(email, self.db.get_account_by_email(email))
            
        except Exception as e:
            error_msg = f"Lỗi: {str(e)}"
            self.db.add_log(account_id, "error", error_msg)
            print(f"✗ Lỗi kiểm tra {email}: {e}")
        
        finally:
            # Đóng driver và profile sau khi kiểm tra xong
            print(f"[Monitor] Đang đóng driver và profile sau khi kiểm tra...")
            try:
                if driver:
                    driver.quit()
                    print(f"[Monitor] ✓ Đã đóng driver")
            except Exception as e:
                print(f"[Monitor] ⚠ Lỗi đóng driver: {e}")
            
            try:
                if profile_id:
                    self.gpm_manager.stop_profile(profile_id)
                    print(f"[Monitor] ✓ Đã đóng profile {profile_id}")
            except Exception as e:
                print(f"[Monitor] ⚠ Lỗi đóng profile: {e}")
    
    def perform_care_if_needed(self, driver, account_data):
        """Thực hiện chăm sóc nếu đã đủ thời gian
        
        LƯU Ý: Hàm này KHÔNG đóng profile vì nó được gọi từ check_account,
        và check_account sẽ đóng profile trong finally block của nó.
        """
        email = account_data["email"]
        account_id = account_data["id"]
        password = account_data.get("password")
        last_care = account_data.get("last_care")
        
        # Kiểm tra xem có cần chăm sóc không
        if last_care:
            last_care_dt = datetime.fromisoformat(last_care) if isinstance(last_care, str) else last_care
            hours_since_care = (datetime.now() - last_care_dt).total_seconds() / 3600
            
            if hours_since_care < MIN_CARE_INTERVAL_HOURS:
                print(f"  → Bỏ qua chăm sóc {email} (chưa đủ {MIN_CARE_INTERVAL_HOURS} giờ)")
                return
        
        # Kiểm tra và đăng nhập nếu cần
        gmail_status = self.gpm_manager.check_gmail_status(driver, email)
        
        if gmail_status == "logged_out":
            # Tự động đăng nhập nếu có password
            if password:
                print(f"  → Đang đăng nhập {email} trước khi chăm sóc...")
                login_result = self.gpm_manager.login_gmail(driver, email, password)
                # Xử lý kết quả login (có thể là bool hoặc dict)
                if isinstance(login_result, dict):
                    if login_result.get("needs_2fa"):
                        self.db.add_log(account_id, "needs_2fa", "Cần xác thực 2FA")
                        print(f"  ⚠ Cần 2FA cho {email}")
                        return
                    elif login_result.get("success"):
                        self.db.update_last_login(email)
                        # Lưu cookies nếu có
                        if login_result.get("cookies"):
                            self.db.update_account(account_id, cookies=login_result.get("cookies"))
                            print(f"  ✓ Đã lưu cookies sau khi đăng nhập")
                        self.db.add_log(account_id, "auto_login", "Đăng nhập tự động trước khi chăm sóc")
                        print(f"  ✓ Đăng nhập thành công: {email}")
                    else:
                        self.db.add_log(account_id, "auto_login_failed", "Không thể đăng nhập tự động")
                        print(f"  ✗ Không thể đăng nhập: {email}")
                        return
                elif login_result == True:
                    self.db.update_last_login(email)
                    # Lấy và lưu cookies
                    try:
                        cookies = driver.get_cookies()
                        import json
                        cookies_json = json.dumps(cookies)
                        self.db.update_account(account_id, cookies=cookies_json)
                        print(f"  ✓ Đã lưu cookies ({len(cookies)} cookies) sau khi đăng nhập")
                    except Exception as e:
                        print(f"  ⚠ Lỗi lấy cookies: {e}")
                    self.db.add_log(account_id, "auto_login", "Đăng nhập tự động trước khi chăm sóc")
                    print(f"  ✓ Đăng nhập thành công: {email}")
                else:
                    self.db.add_log(account_id, "auto_login_failed", "Không thể đăng nhập tự động")
                    print(f"  ✗ Không thể đăng nhập: {email}")
                    return
            else:
                print(f"  ⚠ Bỏ qua chăm sóc {email}: chưa đăng nhập và không có password")
                self.db.add_log(account_id, "care_skipped", "Bỏ qua chăm sóc: chưa đăng nhập")
                return
        elif gmail_status == "logged_in":
            print(f"  ✓ {email} đã đăng nhập, bắt đầu chăm sóc...")
        
        # Thực hiện chăm sóc
        print(f"  → Bắt đầu chăm sóc {email}...")
        care_result = self.care.perform_daily_care(driver, email)
        
        if care_result["success"]:
            self.db.update_last_care(email)
            # Lưu cookies nếu có
            if care_result.get("cookies"):
                self.db.update_account(account_id, cookies=care_result.get("cookies"))
                print(f"  ✓ Đã cập nhật cookies sau khi chăm sóc")
            actions_str = ", ".join(care_result["actions"])
            self.db.add_log(account_id, "care_success", f"Chăm sóc: {actions_str}")
            self.db.add_care_history(account_id, care_result["actions"], True)
            print(f"  ✓ Chăm sóc thành công: {actions_str}")
        else:
            error_msg = care_result.get("error", "Unknown error")
            self.db.add_log(account_id, "care_error", f"Lỗi chăm sóc: {error_msg}")
            self.db.add_care_history(account_id, care_result.get("actions", []), False, error_msg)
            print(f"  ✗ Lỗi chăm sóc: {error_msg}")
        
        # KHÔNG đóng profile ở đây vì check_account sẽ đóng trong finally block
    
    def check_all_accounts(self):
        """Kiểm tra tất cả tài khoản"""
        accounts = self.db.get_all_accounts()
        print(f"\n=== Bắt đầu kiểm tra {len(accounts)} tài khoản ===")
        
        for account in accounts:
            self.check_account(account)
            time.sleep(2)  # Nghỉ giữa các lần kiểm tra
        
        print("=== Hoàn thành kiểm tra ===\n")
    
    def check_accounts_by_status(self, status):
        """Kiểm tra các tài khoản theo trạng thái"""
        accounts = self.db.get_all_accounts()
        filtered = [acc for acc in accounts if acc["status"] == status]
        
        print(f"\n=== Kiểm tra {len(filtered)} tài khoản với status: {status} ===")
        for account in filtered:
            self.check_account(account)
            time.sleep(2)
        print("=== Hoàn thành ===\n")
    
    def sync_to_server(self, email, account_data):
        """Đồng bộ status lên server"""
        try:
            payload = {
                "email": email,
                "status": account_data["status"],
                "lastCheck": account_data.get("last_check"),
                "lastLogin": account_data.get("last_login"),
                "lastCare": account_data.get("last_care"),
                "timestamp": datetime.now().isoformat()
            }
            
            response = requests.post(
                f"{API_SERVER_URL}/api/status",
                json=payload,
                timeout=5
            )
            
            if response.status_code == 200:
                print(f"  → Đã đồng bộ {email} lên server")
            else:
                print(f"  → Lỗi đồng bộ server: {response.status_code}")
        except Exception as e:
            # Không log lỗi để tránh spam, chỉ khi debug
            pass
    
    def get_accounts_by_status(self, status):
        """Lấy danh sách tài khoản theo trạng thái"""
        accounts = self.db.get_all_accounts()
        return [acc for acc in accounts if acc["status"] == status]
    
    def get_statistics(self):
        """Lấy thống kê tài khoản"""
        accounts = self.db.get_all_accounts()
        
        stats = {
            "total": len(accounts),
            "active": 0,
            "logged_out": 0,
            "login_failed": 0,
            "wrong_account": 0,
            "error": 0
        }
        
        for account in accounts:
            status = account["status"]
            if status == "active":
                stats["active"] += 1
            elif status == "logged_out":
                stats["logged_out"] += 1
            elif status == "login_failed":
                stats["login_failed"] += 1
            elif status == "wrong_account":
                stats["wrong_account"] += 1
            elif status == "error":
                stats["error"] += 1
        
        return stats

