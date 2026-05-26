import requests
import time
import random
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from config import GPMLOGIN_API_URL, GPMLOGIN_API_VERSION, BROWSER_TIMEOUT, \
    MANUAL_LOGIN_WAIT_FOR_2FA, MANUAL_LOGIN_2FA_WAIT_SECONDS, MANUAL_LOGIN_2FA_CHECK_INTERVAL
from human_behavior import HumanBehavior

class GPMLoginManager:
    """Quản lý GPMLogin profiles thông qua API"""
    
    def __init__(self):
        self.api_base_url = f"{GPMLOGIN_API_URL}/api/{GPMLOGIN_API_VERSION}"
        self.active_profiles = {}  # {profile_id: {driver, remote_port, ...}}
    
    def get_profiles(self, page=1, per_page=100, group_id=None, search=None):
        """Lấy danh sách profiles từ GPMLogin API"""
        try:
            url = f"{self.api_base_url}/profiles"
            params = {
                "page": page,
                "per_page": per_page
            }
            
            if group_id:
                params["group_id"] = group_id
            if search:
                params["search"] = search
            
            response = requests.get(url, params=params, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("success"):
                return data.get("data", [])
            return []
        except Exception as e:
            print(f"Lỗi lấy danh sách profiles: {e}")
            return []
    
    def get_profile_info(self, profile_id):
        """Lấy thông tin chi tiết của một profile"""
        try:
            url = f"{self.api_base_url}/profiles/{profile_id}"
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            if data.get("success"):
                return data.get("data")
            return None
        except Exception as e:
            print(f"Lỗi lấy thông tin profile: {e}")
            return None
    
    def update_profile_proxy(self, profile_id, proxy=None):
        """Cập nhật proxy cho profile GPMLogin
        
        Args:
            profile_id: ID của profile cần cập nhật
            proxy: Proxy string (format: http://user:pass@host:port hoặc host:port:user:pass)
                   Nếu None, sẽ xóa proxy khỏi profile
        
        Returns:
            bool: True nếu cập nhật thành công, False nếu thất bại
        """
        try:
            # Theo tài liệu GPMLogin API: POST /api/v3/profiles/update/{profile_id}
            url = f"{self.api_base_url}/profiles/update/{profile_id}"
            
            # Lấy thông tin profile hiện tại để lấy profile_name (bắt buộc)
            profile_info = self.get_profile_info(profile_id)
            if not profile_info:
                print(f"[GPMLogin] ✗ Không tìm thấy profile {profile_id}")
                return False
            
            profile_name = profile_info.get("name", "")
            if not profile_name:
                print(f"[GPMLogin] ✗ Không tìm thấy profile_name cho profile {profile_id}")
                return False
            
            # Tạo payload để update - theo tài liệu: profile_name là bắt buộc
            payload = {
                "profile_name": profile_name
            }
            
            if proxy:
                # Format proxy cho GPMLogin - theo tài liệu: chỉ cần IP:Port:User:Pass (không có prefix "HTTP proxy|")
                # "HTTP proxy|" trong tài liệu chỉ là ví dụ về loại proxy, không phải phần cần truyền
                if isinstance(proxy, dict):
                    # Nếu là dict, format: IP:Port:User:Pass hoặc IP:Port
                    proxy_str = f"{proxy.get('host', '')}:{proxy.get('port', '')}"
                    if proxy.get('username'):
                        proxy_str += f":{proxy.get('username')}"
                        if proxy.get('password'):
                            proxy_str += f":{proxy.get('password')}"
                    proxy_clean = proxy_str
                else:
                    # Nếu là string, loại bỏ protocol và prefix nếu có
                    proxy_clean = str(proxy)
                    # Loại bỏ protocol
                    proxy_clean = proxy_clean.replace('http://', '').replace('https://', '').replace('socks5://', '')
                    # Loại bỏ prefix "HTTP proxy|" hoặc "Socks5|" nếu có
                    if '|' in proxy_clean:
                        parts = proxy_clean.split('|')
                        if len(parts) > 1:
                            proxy_clean = parts[1].strip()
                            # Loại bỏ protocol một lần nữa (trường hợp "Socks5| socks5://...")
                            proxy_clean = proxy_clean.replace('socks5://', '').replace('http://', '').replace('https://', '')
                
                payload["raw_proxy"] = proxy_clean
                print(f"[GPMLogin] Đang cập nhật proxy cho profile {profile_id}: {proxy_clean}")
            else:
                # Xóa proxy (set về empty string)
                payload["raw_proxy"] = ""
                print(f"[GPMLogin] Đang xóa proxy khỏi profile {profile_id}")
            
            print(f"[GPMLogin] API URL: {url}")
            print(f"[GPMLogin] Payload: {payload}")
            
            # Gửi request POST để update profile (theo tài liệu)
            response = requests.post(url, json=payload, timeout=30)
            
            # Log response để debug
            print(f"[GPMLogin] Response status: {response.status_code}")
            print(f"[GPMLogin] Response text: {response.text}")
            
            response.raise_for_status()
            data = response.json()
            
            if data.get("success"):
                print(f"[GPMLogin] ✓ Cập nhật proxy thành công cho profile {profile_id}")
                
                # Kiểm tra raw_proxy trong response có khớp với request không
                response_data = data.get("data", {})
                response_proxy = response_data.get("raw_proxy", "")
                expected_proxy = proxy_clean if proxy else ""
                
                if response_proxy != expected_proxy:
                    print(f"[GPMLogin] ⚠ Cảnh báo: Response proxy ({response_proxy}) khác với request proxy ({expected_proxy})")
                    print(f"[GPMLogin] ⚠ GPMLogin API có thể cần thời gian để cập nhật. Đợi 2 giây và kiểm tra lại...")
                    
                    # Đợi một chút rồi kiểm tra lại
                    import time
                    time.sleep(2)
                    
                    # Gọi lại get_profile_info để lấy giá trị mới nhất
                    updated_profile = self.get_profile_info(profile_id)
                    if updated_profile:
                        updated_proxy = updated_profile.get("raw_proxy", "")
                        if updated_proxy == expected_proxy:
                            print(f"[GPMLogin] ✓ Đã xác nhận proxy đã được cập nhật: {updated_proxy}")
                        else:
                            print(f"[GPMLogin] ⚠ Proxy vẫn chưa được cập nhật. Response: {updated_proxy}, Expected: {expected_proxy}")
                            print(f"[GPMLogin] ⚠ Có thể GPMLogin API cần thêm thời gian hoặc có vấn đề với format proxy")
                
                return True
            else:
                error_msg = data.get("error", "Unknown error")
                print(f"[GPMLogin] ✗ Lỗi cập nhật proxy: {error_msg}")
                return False
                
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP Error {response.status_code}: {response.text}"
            print(f"[GPMLogin] ✗ {error_msg}: {e}")
            return False
        except Exception as e:
            error_msg = f"Lỗi không xác định: {str(e)}"
            print(f"[GPMLogin] ✗ {error_msg}")
            return False
    
    def create_profile(self, name, proxy=None, group_id=None, browser_type="chromium"):
        """Tạo profile mới trên GPMLogin
        
        Args:
            name: Tên profile
            proxy: Proxy string (format: http://user:pass@host:port hoặc host:port:user:pass)
            group_id: ID nhóm (tùy chọn)
            browser_type: Loại browser (chromium/firefox)
        
        Returns:
            dict: {
                'success': bool,
                'data': dict (profile data) hoặc None,
                'error': str (error message nếu có)
            }
        """
        try:
            # Theo tài liệu GPMLogin: endpoint là /profiles/create
            url = f"{self.api_base_url}/profiles/create"
            payload = {
                "profile_name": name,  # Tài liệu yêu cầu "profile_name" không phải "name"
                "browser_core": browser_type  # Tài liệu yêu cầu "browser_core" không phải "browser_type"
            }
            
            if proxy:
                # GPMLogin nhận raw_proxy với format: IP:Port:User:Pass hoặc HTTP proxy| IP:Port:User:Pass
                # Format: IP:Port:User:Pass (không có protocol://)
                # Loại bỏ protocol:// nếu có
                proxy_clean = proxy.replace('http://', '').replace('https://', '').replace('socks5://', '')
                payload["raw_proxy"] = proxy_clean
                print(f"[GPMLogin] ✓ Proxy sẽ được gán vào profile: {proxy_clean}")
            else:
                print(f"[GPMLogin] ⚠ Tạo profile không có proxy")
            
            if group_id:
                # Có thể dùng group_id hoặc group_name
                payload["group_id"] = group_id
            
            print(f"[GPMLogin] Đang tạo profile: {name}")
            print(f"[GPMLogin] API URL: {url}")
            print(f"[GPMLogin] Payload: {payload}")
            
            response = requests.post(url, json=payload, timeout=30)
            
            # Log response để debug
            print(f"[GPMLogin] Response status: {response.status_code}")
            print(f"[GPMLogin] Response text: {response.text}")
            print(f"[GPMLogin] Response headers: {dict(response.headers)}")
            
            response.raise_for_status()
            data = response.json()
            
            # Xử lý response - có thể là dict hoặc list
            if isinstance(data, dict):
                if data.get("success"):
                    profile_data = data.get("data")
                    
                    # Nếu profile_data là list, lấy phần tử đầu tiên
                    if isinstance(profile_data, list):
                        if len(profile_data) > 0:
                            profile_data = profile_data[0]
                        else:
                            print(f"[GPMLogin] ✗ Profile created but no data in list")
                            return {
                                'success': False,
                                'data': None,
                                'error': 'Profile created but no data returned'
                            }
                    
                    # Nếu profile_data là None, có thể API trả về success nhưng không có data
                    if profile_data is None:
                        print(f"[GPMLogin] ✗ Profile created but data is None")
                        return {
                            'success': False,
                            'data': None,
                            'error': 'Profile created but data is None'
                        }
                    
                    # Đảm bảo profile_data là dict
                    if not isinstance(profile_data, dict):
                        print(f"[GPMLogin] ✗ Unexpected data format: {type(profile_data)}, value: {profile_data}")
                        return {
                            'success': False,
                            'data': None,
                            'error': f'Unexpected data format: {type(profile_data)}'
                        }
                    
                    profile_id = profile_data.get('id')
                    profile_name = profile_data.get('name', name)
                    print(f"[GPMLogin] ✓ Đã tạo profile: {profile_name} (ID: {profile_id})")
                    return {
                        'success': True,
                        'data': profile_data,
                        'error': None
                    }
                else:
                    error_msg = data.get('message', 'Unknown error')
                    print(f"[GPMLogin] ✗ Lỗi tạo profile: {error_msg}")
                    print(f"[GPMLogin] Full response: {data}")
                    return {
                        'success': False,
                        'data': None,
                        'error': error_msg
                    }
            elif isinstance(data, list):
                # Nếu response là list trực tiếp
                if len(data) > 0:
                    profile_data = data[0] if isinstance(data[0], dict) else None
                    if profile_data:
                        print(f"✓ Đã tạo profile: {name} (ID: {profile_data.get('id', 'N/A')})")
                        return {
                            'success': True,
                            'data': profile_data,
                            'error': None
                        }
                return {
                    'success': False,
                    'data': None,
                    'error': 'Unexpected response format: list without valid data'
                }
            else:
                return {
                    'success': False,
                    'data': None,
                    'error': f'Unexpected response type: {type(data)}'
                }
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Không thể kết nối GPMLogin API. Đảm bảo GPMLogin đang chạy tại {self.api_base_url}"
            print(f"✗ {error_msg}: {e}")
            return {
                'success': False,
                'data': None,
                'error': error_msg
            }
        except requests.exceptions.Timeout as e:
            error_msg = "Timeout khi kết nối GPMLogin API"
            print(f"✗ {error_msg}: {e}")
            return {
                'success': False,
                'data': None,
                'error': error_msg
            }
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP Error {response.status_code}: {response.text}"
            print(f"✗ {error_msg}: {e}")
            return {
                'success': False,
                'data': None,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"Lỗi không xác định: {str(e)}"
            print(f"✗ {error_msg}")
            return {
                'success': False,
                'data': None,
                'error': error_msg
            }
    
    def create_profile_for_email(self, email, password=None, proxy=None, group_id=None, 
                                 browser_type="chromium", auto_login=True, human_like=True):
        """Tạo profile mới cho email và tự động đăng nhập Gmail với hành vi giống người
        
        Args:
            email: Email để tạo profile
            password: Password để đăng nhập (bắt buộc nếu auto_login=True)
            proxy: Proxy string (tùy chọn)
            group_id: ID nhóm (tùy chọn)
            browser_type: Loại browser
            auto_login: Tự động đăng nhập sau khi tạo profile (mặc định: True)
            human_like: Sử dụng hành vi giống người khi đăng nhập (mặc định: True)
        
        Returns:
            dict: {
                'success': bool,
                'data': dict (profile data) hoặc None,
                'error': str (error message nếu có),
                'login_success': bool (nếu auto_login=True)
            }
        """
        # Tên profile dựa trên email với timestamp để đảm bảo unique
        from datetime import datetime
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        username = email.split('@')[0]
        profile_name = f"Gmail_{username}_{timestamp}"
        
        # Tạo profile
        result = self.create_profile(
            name=profile_name,
            proxy=proxy,
            group_id=group_id,
            browser_type=browser_type
        )
        
        # Nếu tạo profile thành công và có yêu cầu auto_login
        if result.get('success') and result.get('data') and auto_login:
            if not password:
                print(f"[GPMLogin] ⚠ Không có password, bỏ qua đăng nhập tự động")
                result['login_success'] = False
                return result
            
            profile_data = result.get('data')
            profile_id = profile_data.get('id')
            
            print(f"[GPMLogin] Bắt đầu đăng nhập tự động cho profile: {profile_id}")
            
            try:
                # Mở profile
                print(f"[GPMLogin] Bước 1: Mở profile {profile_id}...")
                profile_info = self.start_profile(profile_id)
                if not profile_info:
                    print(f"[GPMLogin] ✗ Không thể mở profile để đăng nhập")
                    result['login_success'] = False
                    result['error'] = 'Failed to start profile'
                    return result
                
                print(f"[GPMLogin] ✓ Profile đã được mở: {profile_info}")
                
                # Đợi browser khởi động hoàn toàn (quan trọng!)
                print(f"[GPMLogin] Bước 2: Đợi browser khởi động (5-8 giây)...")
                import random
                wait_time = random.uniform(5.0, 8.0)
                time.sleep(wait_time)
                print(f"[GPMLogin] ✓ Đã đợi {wait_time:.1f} giây")
                
                # Kết nối đến browser (thử nhiều lần nếu cần)
                print(f"[GPMLogin] Bước 3: Kết nối đến browser...")
                driver = None
                max_retries = 3
                for attempt in range(max_retries):
                    try:
                        driver = self.connect_to_profile(profile_id)
                        if driver:
                            print(f"[GPMLogin] ✓ Kết nối thành công (lần thử {attempt + 1})")
                            break
                        else:
                            print(f"[GPMLogin] ⚠ Lần thử {attempt + 1} thất bại, đợi thêm 2 giây...")
                            time.sleep(2)
                    except Exception as e:
                        print(f"[GPMLogin] ⚠ Lỗi kết nối lần {attempt + 1}: {e}")
                        if attempt < max_retries - 1:
                            time.sleep(2)
                
                if not driver:
                    print(f"[GPMLogin] ✗ Không thể kết nối đến browser sau {max_retries} lần thử")
                    result['login_success'] = False
                    result['error'] = 'Failed to connect to browser after multiple attempts'
                    # Đóng profile nếu không kết nối được
                    try:
                        self.stop_profile(profile_id)
                    except:
                        pass
                    return result
                
                # Đăng nhập với hành vi giống người
                print(f"[GPMLogin] Bước 4: Bắt đầu đăng nhập Gmail...")
                login_result = self.login_gmail(driver, email, password, human_like=human_like)
                
                # Xử lý kết quả login (có thể là bool hoặc dict với cookies)
                login_success = False
                cookies_data = None
                
                if isinstance(login_result, dict):
                    if login_result.get("needs_2fa"):
                        print(f"[GPMLogin] ⚠ Cần 2FA/challenge cho {email}")
                        result['login_success'] = False
                        result['needs_2fa'] = True
                        # Không đóng browser nếu cần 2FA
                        return result
                    elif login_result.get("success"):
                        login_success = True
                        cookies_data = login_result.get("cookies")
                        if cookies_data:
                            print(f"[GPMLogin] ✓ Đã lấy cookies ({len(cookies_data) if isinstance(cookies_data, list) else 'N/A'} cookies)")
                elif login_result == True:
                    login_success = True
                    # Lấy cookies nếu đăng nhập thành công
                    try:
                        cookies = driver.get_cookies()
                        import json
                        cookies_data = json.dumps(cookies)
                        print(f"[GPMLogin] ✓ Đã lấy cookies ({len(cookies)} cookies)")
                    except Exception as e:
                        print(f"[GPMLogin] ⚠ Lỗi lấy cookies: {e}")
                
                # Lưu cookies vào result để trả về
                if cookies_data:
                    result['cookies'] = cookies_data
                
                # Đóng browser sau khi đăng nhập
                print(f"[GPMLogin] Bước 5: Đóng browser...")
                try:
                    driver.quit()
                except Exception as e:
                    print(f"[GPMLogin] ⚠ Lỗi đóng driver: {e}")
                
                # Đóng profile
                print(f"[GPMLogin] Bước 6: Đóng profile...")
                try:
                    self.stop_profile(profile_id)
                except Exception as e:
                    print(f"[GPMLogin] ⚠ Lỗi đóng profile: {e}")
                
                result['login_success'] = login_success
                if login_success:
                    print(f"[GPMLogin] ✓ Đã tạo profile và đăng nhập thành công: {email}")
                else:
                    print(f"[GPMLogin] ⚠ Đã tạo profile nhưng đăng nhập thất bại: {email}")
                
            except Exception as e:
                print(f"[GPMLogin] ✗ Lỗi trong quá trình đăng nhập tự động: {e}")
                import traceback
                traceback.print_exc()
                result['login_success'] = False
        else:
            result['login_success'] = None
        
        return result
    
    def start_profile(self, profile_id, win_scale=None, win_pos=None, win_size=None, additional_args=None, force_restart=False, account_data=None):
        """Mở profile thông qua GPMLogin API
        
        Args:
            profile_id: ID của profile
            force_restart: Nếu True, đóng profile trước nếu đang mở (mặc định: False)
            account_data: Thông tin tài khoản (để check proxy nếu cần)
        
        Returns:
            dict: {
                'success': bool,
                'profile_id': str,
                'browser_location': str,
                'remote_debugging_address': str,
                'driver_path': str
            } hoặc None nếu lỗi
        """
        try:
            # Kiểm tra proxy trước khi mở profile (nếu có account_data)
            if account_data:
                proxy_info = account_data.get('proxy_info')
                proxy_id = account_data.get('proxy_id')
                auto_change_proxy = account_data.get('auto_change_proxy', False)
                
                print(f"[GPMLogin] ========== DEBUG PROXY INFO ==========")
                print(f"[GPMLogin] proxy_info: {proxy_info}")
                print(f"[GPMLogin] proxy_id: {proxy_id} (type: {type(proxy_id)})")
                print(f"[GPMLogin] auto_change_proxy từ account_data: {auto_change_proxy} (type: {type(auto_change_proxy)})")
                
                # Chuyển đổi auto_change_proxy từ integer sang boolean nếu cần
                if isinstance(auto_change_proxy, int):
                    auto_change_proxy = bool(auto_change_proxy)
                    print(f"[GPMLogin] Đã chuyển auto_change_proxy sang boolean: {auto_change_proxy}")
                
                # Lấy proxy_api_url từ proxy configuration (ưu tiên) hoặc từ account
                proxy_api_url = None
                # Kiểm tra proxy_id hợp lệ (phải > 0, không phải 0 hoặc None)
                if proxy_id and isinstance(proxy_id, int) and proxy_id > 0:
                    print(f"[GPMLogin] Có proxy_id hợp lệ ({proxy_id}), đang lấy proxy_api_url từ proxy config...")
                    # Lấy proxy_api_url từ proxy configuration trong database
                    try:
                        from database import Database
                        db = Database()
                        proxy_data = db.get_proxy_by_id(proxy_id)
                        if proxy_data:
                            print(f"[GPMLogin] Đã lấy proxy_data từ database: {list(proxy_data.keys())}")
                            proxy_api_url = proxy_data.get('proxy_api_url')
                            print(f"[GPMLogin] ✓ Lấy proxy_api_url từ proxy config: {proxy_api_url}")
                        else:
                            print(f"[GPMLogin] ⚠ Không tìm thấy proxy với ID: {proxy_id}")
                    except Exception as e:
                        print(f"[GPMLogin] ✗ Lỗi lấy proxy_api_url từ database: {e}")
                        import traceback
                        traceback.print_exc()
                else:
                    print(f"[GPMLogin] Không có proxy_id hợp lệ trong account_data (proxy_id={proxy_id}, type={type(proxy_id)})")
                    # Thử tìm proxy bằng proxy_info nếu có
                    if proxy_info:
                        try:
                            from database import Database
                            db = Database()
                            proxy_data = db.get_proxy_by_raw(proxy_info)
                            if proxy_data:
                                proxy_id_found = proxy_data.get('id')
                                print(f"[GPMLogin] Tìm thấy proxy bằng proxy_info, proxy_id={proxy_id_found}")
                                if proxy_id_found and proxy_id_found > 0:
                                    proxy_api_url = proxy_data.get('proxy_api_url')
                                    print(f"[GPMLogin] ✓ Lấy proxy_api_url từ proxy tìm được: {proxy_api_url}")
                                    # Cập nhật proxy_id vào account để lần sau không phải tìm lại
                                    try:
                                        account_id = account_data.get('id')
                                        if account_id:
                                            db.update_account(account_id, proxy_id=proxy_id_found)
                                            print(f"[GPMLogin] ✓ Đã cập nhật proxy_id={proxy_id_found} vào account")
                                    except Exception as e:
                                        print(f"[GPMLogin] ⚠ Lỗi cập nhật proxy_id: {e}")
                        except Exception as e:
                            print(f"[GPMLogin] ⚠ Lỗi tìm proxy bằng proxy_info: {e}")
                
                # Nếu không có từ proxy config, lấy từ account (fallback)
                if not proxy_api_url:
                    account_proxy_api_url = account_data.get('proxy_api_url')
                    print(f"[GPMLogin] proxy_api_url từ account: {account_proxy_api_url}")
                    if account_proxy_api_url:
                        proxy_api_url = account_proxy_api_url
                        print(f"[GPMLogin] ✓ Lấy proxy_api_url từ account: {proxy_api_url}")
                    else:
                        print(f"[GPMLogin] ⚠ Không có proxy_api_url trong account")
                
                print(f"[GPMLogin] Kết quả cuối cùng - proxy_api_url: {proxy_api_url}")
                print(f"[GPMLogin] auto_change_proxy: {auto_change_proxy} (type: {type(auto_change_proxy)})")
                print(f"[GPMLogin] ========== KẾT THÚC DEBUG PROXY INFO ==========")
                
                if proxy_info:
                    print(f"[GPMLogin] Kiểm tra proxy trước khi mở profile: {proxy_info}")
                    print(f"[GPMLogin] Proxy API URL sẽ truyền vào ProxyAPIClient: {proxy_api_url if proxy_api_url else 'None (sẽ dùng từ config)'}")
                    
                    from proxy_api_client import ProxyAPIClient
                    client = ProxyAPIClient(api_server_url=proxy_api_url)
                    
                    # Parse proxy để lấy host:port
                    from proxy_manager import ProxyManager
                    proxy_manager = ProxyManager()
                    
                    # Extract proxy string từ format GPMLogin nếu có (format: "HTTP proxy| IP:Port" hoặc "Socks5| socks5://IP:Port")
                    proxy_string_to_parse = proxy_info
                    if proxy_info and '|' in proxy_info:
                        # Extract phần sau dấu |
                        parts = proxy_info.split('|')
                        if len(parts) > 1:
                            extracted = parts[1].strip()
                            # Loại bỏ protocol nếu có
                            extracted = extracted.replace('socks5://', '').replace('http://', '').replace('https://', '')
                            proxy_string_to_parse = extracted
                            print(f"[GPMLogin] Đã extract proxy từ format GPMLogin: {proxy_string_to_parse}")
                    
                    proxy_dict = proxy_manager.parse_proxy(proxy_string_to_parse)
                    
                    if proxy_dict:
                        proxy_string = f"{proxy_dict.get('host')}:{proxy_dict.get('port')}"
                        
                        # Check proxy status
                        status_result = client.check_proxy_status(proxy_string)
                        
                        if not status_result.get('success'):
                            print(f"[GPMLogin] ✗ Không thể kiểm tra proxy: {status_result.get('error')}")
                            return {
                                'success': False,
                                'error': f"Proxy check failed: {status_result.get('error')}",
                                'proxy_error': True
                            }
                        
                        if not status_result.get('status'):
                            message = status_result.get('message', 'UNKNOWN')
                            print(f"[GPMLogin] ✗ Proxy không hoạt động: {message}")
                            return {
                                'success': False,
                                'error': f"Proxy is not ready: {message}",
                                'proxy_error': True,
                                'proxy_status': message
                            }
                        
                        print(f"[GPMLogin] ✓ Proxy đang hoạt động: {status_result.get('message')}")
                        
                        # Tự động change proxy nếu được bật
                        if auto_change_proxy:
                            print(f"[GPMLogin] ========== TỰ ĐỘNG CHANGE PROXY IP ==========")
                            print(f"[GPMLogin] Proxy string: {proxy_string}")
                            print(f"[GPMLogin] Proxy API URL: {proxy_api_url}")
                            reset_result = client.reset_proxy_ip(proxy_string)
                            if reset_result.get('success'):
                                print(f"[GPMLogin] ✓✓✓ ĐÃ RESET PROXY IP THÀNH CÔNG ✓✓✓")
                                print(f"[GPMLogin] Message: {reset_result.get('message')}")
                                # Đợi một chút để proxy reset xong
                                import time
                                wait_time = 5
                                print(f"[GPMLogin] Đợi {wait_time} giây để proxy reset xong...")
                                time.sleep(wait_time)
                                print(f"[GPMLogin] ✓ Đã đợi {wait_time} giây")
                            else:
                                print(f"[GPMLogin] ✗✗✗ KHÔNG THỂ RESET PROXY IP ✗✗✗")
                                print(f"[GPMLogin] Error: {reset_result.get('error')}")
                                # Vẫn tiếp tục mở profile nếu reset thất bại
                            print(f"[GPMLogin] ========== KẾT THÚC CHANGE PROXY IP ==========")
                        else:
                            print(f"[GPMLogin] auto_change_proxy = False, bỏ qua change proxy IP")
            # Kiểm tra xem profile đã mở chưa
            if profile_id in self.active_profiles:
                if force_restart:
                    print(f"[GPMLogin] Profile {profile_id} đang mở, đóng trước khi mở lại...")
                    self.stop_profile(profile_id)
                else:
                    print(f"[GPMLogin] Profile {profile_id} đã mở, sử dụng profile hiện tại")
                    # Trả về thông tin profile từ active_profiles
                    active_info = self.active_profiles[profile_id]
                    return {
                        'success': True,
                        'remote_debugging_address': active_info.get('remote_address'),
                        'browser_location': active_info.get('browser_location'),
                        'driver_path': active_info.get('driver_path')
                    }
            
            url = f"{self.api_base_url}/profiles/start/{profile_id}"
            params = {}
            
            if win_scale:
                params["win_scale"] = win_scale
            if win_pos:
                params["win_pos"] = win_pos
            if win_size:
                params["win_size"] = win_size
            if additional_args:
                params["additional_args"] = additional_args
            
            print(f"[GPMLogin] Đang mở profile: {profile_id}")
            print(f"[GPMLogin] API URL: {url}")
            print(f"[GPMLogin] Params: {params}")
            
            response = requests.get(url, params=params, timeout=30)
            
            print(f"[GPMLogin] Response status: {response.status_code}")
            print(f"[GPMLogin] Response text: {response.text[:500]}")  # Log 500 ký tự đầu
            
            response.raise_for_status()
            data = response.json()
            
            print(f"[GPMLogin] Response JSON: {data}")
            
            if data.get("success"):
                profile_data = data.get("data", {})
                # Kiểm tra nếu data là dict và có success
                if isinstance(profile_data, dict) and profile_data.get("success"):
                    return profile_data
                # Hoặc nếu data trực tiếp là thông tin profile
                elif isinstance(profile_data, dict) and "remote_debugging_address" in profile_data:
                    return profile_data
                else:
                    error_msg = data.get('message', f'Unexpected response format: {type(profile_data)}')
                    print(f"[GPMLogin] ✗ Không thể mở profile: {error_msg}")
                    print(f"[GPMLogin] Full response data: {data}")
                    return None
            else:
                error_msg = data.get('message', 'Unknown error')
                print(f"[GPMLogin] ✗ Không thể mở profile: {error_msg}")
                print(f"[GPMLogin] Full response: {data}")
                return None
        except requests.exceptions.HTTPError as e:
            error_msg = f"HTTP Error {response.status_code}: {response.text[:200]}"
            print(f"[GPMLogin] ✗ Lỗi HTTP khi mở profile: {error_msg}")
            return None
        except Exception as e:
            error_msg = f"Lỗi mở profile: {str(e)}"
            print(f"[GPMLogin] ✗ {error_msg}")
            import traceback
            traceback.print_exc()
            return None
    
    def stop_profile(self, profile_id):
        """Đóng profile"""
        print(f"[GPMLogin] ========== BẮT ĐẦU ĐÓNG PROFILE: {profile_id} ==========")
        
        # Bước 1: Đóng driver trước
        if profile_id in self.active_profiles:
            print(f"[GPMLogin] Đang đóng driver cho profile {profile_id}...")
            try:
                driver = self.active_profiles[profile_id].get("driver")
                if driver:
                    driver.quit()
                    print(f"[GPMLogin] ✓ Đã đóng driver")
                else:
                    print(f"[GPMLogin] ⚠ Driver không tồn tại trong active_profiles")
            except Exception as e:
                print(f"[GPMLogin] ⚠ Lỗi đóng driver: {e}")
            finally:
                # Luôn xóa khỏi active_profiles
                del self.active_profiles[profile_id]
                print(f"[GPMLogin] ✓ Đã xóa profile {profile_id} khỏi active_profiles")
        else:
            print(f"[GPMLogin] ⚠ Profile {profile_id} không có trong active_profiles")
        
        # Bước 2: Gọi API để đóng profile trong GPMLogin
        # Theo tài liệu: GET /api/v3/profiles/close/{id}
        try:
            url = f"{self.api_base_url}/profiles/close/{profile_id}"
            print(f"[GPMLogin] Gọi API đóng profile: {url}")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            print(f"[GPMLogin] API Response: {data}")
            
            if data.get("success"):
                print(f"[GPMLogin] ✓✓✓ ĐÃ ĐÓNG PROFILE THÀNH CÔNG: {profile_id} ✓✓✓")
                print(f"[GPMLogin] ========== KẾT THÚC ĐÓNG PROFILE ==========")
                return True
            else:
                error_msg = data.get("message", "Unknown error")
                print(f"[GPMLogin] ⚠ API trả về không thành công: {error_msg}")
                print(f"[GPMLogin] ========== KẾT THÚC ĐÓNG PROFILE (API failed) ==========")
                # Vẫn return True vì đã cleanup driver và active_profiles
                return True
        except requests.exceptions.RequestException as e:
            print(f"[GPMLogin] ⚠ Lỗi gọi API đóng profile: {e}")
            print(f"[GPMLogin] ========== KẾT THÚC ĐÓNG PROFILE (API error) ==========")
            # Vẫn return True vì đã cleanup driver và active_profiles
            return True
        except Exception as e:
            print(f"[GPMLogin] ✗✗✗ EXCEPTION khi đóng profile: {e} ✗✗✗")
            import traceback
            traceback.print_exc()
            print(f"[GPMLogin] ========== KẾT THÚC ĐÓNG PROFILE (Exception) ==========")
            # Vẫn return True vì đã cleanup driver và active_profiles
            return True
    
    def delete_profile(self, profile_id, mode=2):
        """Xóa profile từ GPMLogin
        
        Theo tài liệu: DELETE /api/v3/profiles/delete/{id}?mode={mode}
        
        Args:
            profile_id: ID của profile cần xóa
            mode: 1 - chỉ xóa ở database, 2 - xóa cả database và nơi lưu trữ (mặc định: 2)
        """
        try:
            # Đóng profile trước nếu đang mở
            if profile_id in self.active_profiles:
                self.stop_profile(profile_id)
            
            # Endpoint đúng theo tài liệu: /profiles/delete/{id}?mode=2
            url = f"{self.api_base_url}/profiles/delete/{profile_id}"
            params = {"mode": mode}
            
            print(f"[GPMLogin] Đang xóa profile: {profile_id}")
            print(f"[GPMLogin] Mode: {mode} ({'xóa vĩnh viễn' if mode == 2 else 'chỉ xóa database'})")
            print(f"[GPMLogin] API URL: {url}")
            print(f"[GPMLogin] Params: {params}")
            
            response = requests.delete(url, params=params, timeout=30)
            response.raise_for_status()
            data = response.json()
            
            print(f"[GPMLogin] Response status: {response.status_code}")
            print(f"[GPMLogin] Response text: {response.text}")
            
            if data.get("success"):
                print(f"[GPMLogin] ✓ Đã xóa profile: {profile_id} (mode={mode})")
                return {
                    'success': True,
                    'message': 'Profile deleted successfully'
                }
            else:
                error_msg = data.get('message', 'Unknown error')
                print(f"[GPMLogin] ✗ Lỗi xóa profile: {error_msg}")
                return {
                    'success': False,
                    'error': error_msg
                }
        except requests.exceptions.ConnectionError as e:
            error_msg = f"Không thể kết nối GPMLogin API"
            print(f"[GPMLogin] ✗ {error_msg}: {e}")
            return {
                'success': False,
                'error': error_msg
            }
        except Exception as e:
            error_msg = f"Lỗi xóa profile: {str(e)}"
            print(f"[GPMLogin] ✗ {error_msg}")
            return {
                'success': False,
                'error': error_msg
            }
    
    def inject_cookies(self, driver, cookies_json):
        """Inject cookies vào browser để khôi phục session
        
        Args:
            driver: Selenium WebDriver
            cookies_json: Cookies dạng JSON string hoặc list
        
        Returns:
            bool: True nếu inject thành công
        """
        try:
            import json
            
            # Parse cookies
            if isinstance(cookies_json, str):
                cookies = json.loads(cookies_json)
            else:
                cookies = cookies_json
            
            if not cookies or len(cookies) == 0:
                print(f"[InjectCookies] Không có cookies để inject")
                return False
            
            print(f"[InjectCookies] Bắt đầu inject {len(cookies)} cookies...")
            
            # Điều hướng đến domain trước khi inject cookies
            driver.get("https://accounts.google.com")
            time.sleep(1)
            
            # Xóa cookies cũ (nếu có)
            try:
                driver.delete_all_cookies()
                print(f"[InjectCookies] Đã xóa cookies cũ")
            except Exception as e:
                print(f"[InjectCookies] ⚠ Lỗi xóa cookies cũ: {e}")
            
            # Inject cookies mới
            injected_count = 0
            for cookie in cookies:
                try:
                    # Đảm bảo domain hợp lệ
                    if 'domain' in cookie:
                        # Loại bỏ dấu chấm đầu nếu có
                        if cookie['domain'].startswith('.'):
                            cookie['domain'] = cookie['domain'][1:]
                    
                    # Đảm bảo có các trường bắt buộc
                    if 'name' not in cookie or 'value' not in cookie:
                        continue
                    
                    driver.add_cookie(cookie)
                    injected_count += 1
                except Exception as e:
                    print(f"[InjectCookies] ⚠ Lỗi inject cookie {cookie.get('name', 'unknown')}: {e}")
            
            print(f"[InjectCookies] ✓ Đã inject {injected_count}/{len(cookies)} cookies")
            
            # Refresh để áp dụng cookies
            driver.refresh()
            time.sleep(2)
            
            return True
            
        except Exception as e:
            print(f"[InjectCookies] ✗ Lỗi inject cookies: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def validate_and_refresh_cookies(self, driver, account_data):
        """Kiểm tra và refresh cookies nếu cần
        
        Args:
            driver: Selenium WebDriver
            account_data: Thông tin tài khoản (email, password, cookies)
        
        Returns:
            bool: True nếu cookies còn valid, False nếu cần đăng nhập lại
        """
        try:
            email = account_data.get('email')
            password = account_data.get('password')
            cookies_json = account_data.get('cookies')
            
            if not cookies_json:
                print(f"[CookieValidation] Không có cookies trong database, cần đăng nhập mới")
                return False
            
            import json
            from datetime import datetime
            
            cookies = json.loads(cookies_json) if isinstance(cookies_json, str) else cookies_json
            
            if not cookies or len(cookies) == 0:
                print(f"[CookieValidation] Cookies rỗng, cần đăng nhập mới")
                return False
            
            # Kiểm tra cookie expiration
            current_time = datetime.now().timestamp()
            valid_cookies = []
            has_expired = False
            expired_count = 0
            
            for cookie in cookies:
                if 'expiry' in cookie:
                    if cookie['expiry'] < current_time:
                        has_expired = True
                        expired_count += 1
                    else:
                        # Cookie còn valid, kiểm tra thời gian còn lại
                        time_left = cookie['expiry'] - current_time
                        hours_left = time_left / 3600
                        if hours_left < 24:  # Còn < 24h
                            print(f"[CookieValidation] Cookie {cookie.get('name', 'unknown')} sắp hết hạn (còn {hours_left:.1f}h)")
                        valid_cookies.append(cookie)
                else:
                    # Cookie không có expiry (session cookie) - vẫn dùng được
                    valid_cookies.append(cookie)
            
            if has_expired:
                print(f"[CookieValidation] ⚠ Có {expired_count} cookies đã hết hạn")
            
            # Nếu > 30% cookies hết hạn → cần refresh
            if expired_count > len(cookies) * 0.3:
                print(f"[CookieValidation] ⚠ Nhiều cookies đã hết hạn ({expired_count}/{len(cookies)}), cần đăng nhập lại")
                return False
            
            # Inject cookies và kiểm tra session
            print(f"[CookieValidation] Injecting {len(valid_cookies)} cookies...")
            if not self.inject_cookies(driver, valid_cookies):
                return False
            
            # Kiểm tra xem đã đăng nhập chưa
            time.sleep(2)
            current_url = driver.current_url
            print(f"[CookieValidation] URL sau khi inject cookies: {current_url}")
            
            if "accounts.google.com/signin" in current_url or "accounts.google.com/ServiceLogin" in current_url:
                print(f"[CookieValidation] ✗ Cookies không còn valid, cần đăng nhập lại")
                return False
            
            # Thử truy cập Gmail để kiểm tra
            try:
                driver.get("https://mail.google.com")
                time.sleep(2)
                current_url = driver.current_url
                
                if "accounts.google.com/signin" in current_url or "accounts.google.com/ServiceLogin" in current_url:
                    print(f"[CookieValidation] ✗ Cookies không còn valid (redirected to signin)")
                    return False
                
                print(f"[CookieValidation] ✓ Cookies vẫn còn valid")
                return True
            except Exception as e:
                print(f"[CookieValidation] ⚠ Lỗi kiểm tra Gmail: {e}")
                # Nếu không kiểm tra được, giả định cookies còn valid
                return True
            
        except Exception as e:
            print(f"[CookieValidation] ⚠ Lỗi validate cookies: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def connect_to_profile(self, profile_id, account_data=None):
        """Kết nối Selenium driver đến profile đã mở
        
        Bước 1: Mở profile qua API
        Bước 2: Lấy remote_debugging_address
        Bước 3: Kết nối Selenium với remote debugging port
        Bước 4: Inject cookies nếu có (để khôi phục session)
        
        Args:
            profile_id: ID của profile
            account_data: Thông tin tài khoản (email, password, cookies) - tùy chọn
        """
        try:
            # Kiểm tra xem profile đã mở chưa
            if profile_id in self.active_profiles:
                driver = self.active_profiles[profile_id]["driver"]
                # Nếu có account_data và cookies, thử inject cookies
                if account_data and account_data.get('cookies'):
                    print(f"[GPMLogin] Profile đã mở, kiểm tra và inject cookies...")
                    if not self.validate_and_refresh_cookies(driver, account_data):
                        # Cookies không valid, cần đăng nhập lại
                        email = account_data.get('email')
                        password = account_data.get('password')
                        if password:
                            print(f"[GPMLogin] Tự động đăng nhập lại do cookies hết hạn...")
                            login_result = self.login_gmail(driver, email, password, human_like=True)
                            if isinstance(login_result, dict) and login_result.get('success'):
                                # Lưu cookies mới
                                try:
                                    cookies = driver.get_cookies()
                                    import json
                                    cookies_json = json.dumps(cookies)
                                    from database import Database
                                    db = Database()
                                    account = db.get_account_by_email(email)
                                    if account:
                                        db.update_account(account['id'], cookies=cookies_json)
                                        print(f"[GPMLogin] ✓ Đã lưu cookies mới")
                                except Exception as e:
                                    print(f"[GPMLogin] ⚠ Lỗi lưu cookies: {e}")
                return driver
            
            # Mở profile
            profile_data = self.start_profile(profile_id, account_data=account_data)
            if not profile_data:
                return None
            
            # Đợi browser khởi động
            time.sleep(2)
            
            # Parse remote_debugging_address
            remote_address = profile_data.get("remote_debugging_address", "")
            if not remote_address:
                print(f"[GPMLogin] ✗ Không có remote_debugging_address trong profile_data")
                print(f"[GPMLogin] Profile data keys: {list(profile_data.keys())}")
                print(f"[GPMLogin] Full profile_data: {profile_data}")
                return None
            
            print(f"[GPMLogin] Remote debugging address: {remote_address}")
            
            # Parse host và port
            if ":" in remote_address:
                host, port = remote_address.split(":")
            else:
                host = "127.0.0.1"
                port = remote_address
            
            # Tạo Chrome options với remote debugging
            chrome_options = Options()
            chrome_options.add_experimental_option("debuggerAddress", f"{host}:{port}")
            
            # Sử dụng driver_path nếu có
            driver_path = profile_data.get("driver_path")
            if driver_path:
                service = Service(driver_path)
                driver = webdriver.Chrome(service=service, options=chrome_options)
            else:
                driver = webdriver.Chrome(options=chrome_options)
            
            # Lưu thông tin
            self.active_profiles[profile_id] = {
                "driver": driver,
                "remote_address": remote_address,
                "browser_location": profile_data.get("browser_location"),
                "driver_path": driver_path
            }
            
            # Inject cookies nếu có account_data
            if account_data and account_data.get('cookies'):
                print(f"[GPMLogin] Kiểm tra và inject cookies từ database...")
                if not self.validate_and_refresh_cookies(driver, account_data):
                    # Cookies không valid, cần đăng nhập lại
                    email = account_data.get('email')
                    password = account_data.get('password')
                    if password:
                        print(f"[GPMLogin] Tự động đăng nhập lại do cookies hết hạn...")
                        login_result = self.login_gmail(driver, email, password, human_like=True)
                        if isinstance(login_result, dict) and login_result.get('success'):
                            # Lưu cookies mới
                            try:
                                cookies = driver.get_cookies()
                                import json
                                cookies_json = json.dumps(cookies)
                                from database import Database
                                db = Database()
                                account = db.get_account_by_email(email)
                                if account:
                                    db.update_account(account['id'], cookies=cookies_json)
                                    print(f"[GPMLogin] ✓ Đã lưu cookies mới")
                            except Exception as e:
                                print(f"[GPMLogin] ⚠ Lỗi lưu cookies: {e}")
                    else:
                        print(f"[GPMLogin] ⚠ Không có password để đăng nhập lại")
            
            return driver
            
        except Exception as e:
            print(f"Lỗi kết nối profile: {e}")
            import traceback
            traceback.print_exc()
            return None
    
    def check_gmail_status(self, driver, email):
        """Kiểm tra trạng thái Gmail"""
        try:
            # Đảm bảo đang ở tab Gmail, không phải extension
            current_url = driver.current_url
            print(f"[CheckStatus] Current URL ban đầu: {current_url}")
            
            # Nếu đang ở trang extension hoặc không phải Gmail, chuyển đến Gmail
            if "chrome-extension://" in current_url or "mail.google.com" not in current_url:
                print(f"[CheckStatus] Đang ở trang không phải Gmail, chuyển đến Gmail...")
                try:
                    # Thử tìm tab Gmail đang mở
                    all_windows = driver.window_handles
                    gmail_window = None
                    
                    for window in all_windows:
                        driver.switch_to.window(window)
                        if "mail.google.com" in driver.current_url:
                            gmail_window = window
                            print(f"[CheckStatus] Tìm thấy tab Gmail đang mở")
                            break
                    
                    if not gmail_window:
                        # Không có tab Gmail, mở tab mới
                        print(f"[CheckStatus] Không có tab Gmail, mở tab mới...")
                        driver.execute_script("window.open('https://mail.google.com', '_blank');")
                        time.sleep(2)
                        # Chuyển đến tab mới
                        all_windows = driver.window_handles
                        driver.switch_to.window(all_windows[-1])
                    else:
                        driver.switch_to.window(gmail_window)
                except Exception as e:
                    print(f"[CheckStatus] Lỗi khi chuyển tab: {e}, thử navigate trực tiếp...")
                    driver.get("https://mail.google.com")
            else:
                # Đã ở Gmail, chỉ cần refresh nếu cần
                if "mail.google.com" not in current_url:
                    driver.get("https://mail.google.com")
            
            driver.set_page_load_timeout(BROWSER_TIMEOUT)
            time.sleep(3)
            
            current_url = driver.current_url
            print(f"[CheckStatus] Current URL sau khi navigate: {current_url}")
            
            # Xử lý trường hợp redirect đến workspace.google.com (Gmail landing page)
            if "workspace.google.com" in current_url and "/gmail" in current_url:
                print(f"[CheckStatus] Phát hiện workspace.google.com/gmail, navigate đến mail.google.com trực tiếp...")
                try:
                    driver.get("https://mail.google.com/mail/u/0/#inbox")
                    time.sleep(3)
                    current_url = driver.current_url
                    print(f"[CheckStatus] URL sau khi navigate đến inbox: {current_url}")
                except Exception as e:
                    print(f"[CheckStatus] ⚠ Lỗi navigate đến inbox: {e}")
            
            # Cập nhật lại URL sau khi xử lý
            current_url = driver.current_url
            print(f"[CheckStatus] Current URL sau khi xử lý: {current_url}")
            
            if "accounts.google.com" in current_url:
                # Chưa đăng nhập hoặc bị đăng xuất
                print(f"[CheckStatus] Phát hiện accounts.google.com - logged_out")
                return "logged_out"
            elif "mail.google.com" in current_url or ("workspace.google.com" in current_url and "/gmail" in current_url):
                # Đã đăng nhập - kiểm tra email hiển thị
                print(f"[CheckStatus] Phát hiện mail.google.com - đang kiểm tra email...")
                
                # Thử nhiều cách để tìm email
                account_email = None
                email_selectors = [
                    "[data-ogsr-up]",  # Attribute chứa email
                    "[aria-label*='@']",  # Aria-label chứa @
                    "a[href*='accounts.google.com']",  # Link account
                    "[data-email]",  # Data-email attribute
                    ".gb_Db",  # Account button class
                    "[aria-label*='Google Account']",  # Google Account button
                ]
                
                for selector in email_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for elem in elements:
                            # Thử lấy từ các attribute
                            email_attr = (
                                elem.get_attribute("data-ogsr-up") or
                                elem.get_attribute("data-email") or
                                elem.get_attribute("aria-label") or
                                elem.get_attribute("title") or
                                elem.text
                            )
                            
                            if email_attr and "@" in email_attr:
                                # Extract email từ text (có thể có format "Account (email@gmail.com)")
                                import re
                                email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', email_attr)
                                if email_match:
                                    account_email = email_match.group(0).lower()
                                    print(f"[CheckStatus] Tìm thấy email từ selector '{selector}': {account_email}")
                                    break
                        
                        if account_email:
                            break
                    except Exception as e:
                        print(f"[CheckStatus] Lỗi với selector '{selector}': {e}")
                        continue
                
                # Nếu không tìm thấy email, kiểm tra kỹ hơn xem có thực sự đăng nhập hay không
                if not account_email:
                    print(f"[CheckStatus] Không tìm thấy email trong UI, kiểm tra kỹ hơn...")
                    try:
                        # Kiểm tra xem có form đăng nhập không (nếu có thì chưa đăng nhập)
                        login_elements = driver.find_elements(By.CSS_SELECTOR, 
                            "input[type='email'], input[type='password'], "
                            "[name='identifier'], [name='password'], "
                            "#identifierId, #password"
                        )
                        if login_elements:
                            print(f"[CheckStatus] Tìm thấy form đăng nhập - chưa đăng nhập")
                            return "logged_out"
                        
                        # Kiểm tra xem có inbox không (nếu có inbox thì có thể đã đăng nhập)
                        inbox_elements = driver.find_elements(By.CSS_SELECTOR, "[href*='#inbox'], [aria-label*='Inbox']")
                        if inbox_elements:
                            # Kiểm tra thêm xem có email hiển thị ở đâu đó không
                            try:
                                page_text = driver.page_source.lower()
                                if email.lower() in page_text:
                                    print(f"[CheckStatus] Tìm thấy inbox và email trong page source - logged_in")
                                    return "logged_in"
                                else:
                                    print(f"[CheckStatus] Tìm thấy inbox nhưng không tìm thấy email trong page source - có thể chưa đăng nhập")
                                    return "logged_out"
                            except:
                                print(f"[CheckStatus] Không thể kiểm tra page source, giả định logged_out để an toàn")
                                return "logged_out"
                    except Exception as e:
                        print(f"[CheckStatus] Lỗi khi kiểm tra: {e}")
                    
                    # Nếu không chắc chắn, trả về logged_out để an toàn (không giả định đã đăng nhập)
                    print(f"[CheckStatus] Không tìm thấy email và không chắc chắn - trả về logged_out để an toàn")
                    return "logged_out"
                
                # So sánh email
                expected_email = email.lower().strip()
                print(f"[CheckStatus] So sánh: expected='{expected_email}' vs found='{account_email}'")
                
                # So sánh chính xác hoặc so sánh phần trước @
                if account_email == expected_email:
                    print(f"[CheckStatus] ✓ Email khớp chính xác - logged_in")
                    return "logged_in"
                elif account_email.startswith(expected_email.split('@')[0] + '@'):
                    # Nếu phần trước @ khớp, có thể là cùng account
                    print(f"[CheckStatus] ✓ Email khớp phần trước @ - logged_in")
                    return "logged_in"
                elif expected_email in account_email or account_email in expected_email:
                    # Nếu một trong hai chứa cái kia
                    print(f"[CheckStatus] ✓ Email khớp (substring) - logged_in")
                    return "logged_in"
                else:
                    print(f"[CheckStatus] ✗ Email không khớp - wrong_account")
                    return "wrong_account"
            elif "workspace.google.com" in current_url and "/gmail" in current_url:
                # Trang Gmail landing page - có thể đã đăng nhập, thử navigate đến inbox và kiểm tra lại
                print(f"[CheckStatus] Phát hiện workspace.google.com/gmail - thử navigate đến inbox...")
                try:
                    driver.get("https://mail.google.com/mail/u/0/#inbox")
                    time.sleep(3)
                    current_url = driver.current_url
                    
                    if "mail.google.com" in current_url:
                        # Sau khi navigate, kiểm tra lại bằng cách gọi đệ quy
                        print(f"[CheckStatus] Đã navigate đến inbox, kiểm tra lại...")
                        return self.check_gmail_status(driver, email)
                    elif "accounts.google.com" in current_url:
                        # Redirect đến trang đăng nhập
                        print(f"[CheckStatus] Redirect đến accounts.google.com - logged_out")
                        return "logged_out"
                    else:
                        print(f"[CheckStatus] URL sau navigate: {current_url} - unknown")
                        return "unknown"
                except Exception as e:
                    print(f"[CheckStatus] ⚠ Lỗi navigate đến inbox: {e}")
                    # Không giả định đã đăng nhập, trả về unknown để an toàn
                    return "unknown"
            else:
                print(f"[CheckStatus] URL không xác định: {current_url} - unknown")
                return "unknown"
        except Exception as e:
            print(f"[CheckStatus] ✗✗✗ Lỗi kiểm tra Gmail status: {e} ✗✗✗")
            import traceback
            traceback.print_exc()
            return "error"
    
    def login_gmail(self, driver, email, password, human_like=True):
        """Đăng nhập Gmail với hành vi giống người thật
        
        Args:
            driver: Selenium WebDriver
            email: Email đăng nhập
            password: Password
            human_like: Bật hành vi giống người (mặc định: True)
        """
        # Import BySelector ở đầu function để tránh conflict
        from selenium.webdriver.common.by import By as BySelector
        
        try:
            print(f"[Login] ========== BẮT ĐẦU LOGIN_GMAIL ==========")
            print(f"[Login] Email: {email}")
            print(f"[Login] Human like: {human_like}")
            print(f"[Login] Driver: {driver}")
            
            if not driver:
                print(f"[Login] ✗ Driver is None!")
                return False
            
            print(f"[Login] Bước 1: Set page load timeout...")
            driver.set_page_load_timeout(BROWSER_TIMEOUT)
            
            # Kiểm tra và đảm bảo đang ở đúng tab trước khi navigate
            current_url = driver.current_url
            print(f"[Login] Current URL ban đầu: {current_url}")
            
            # Nếu đang ở extension page, tìm tab đúng hoặc mở tab mới
            if "chrome-extension://" in current_url or "moz-extension://" in current_url:
                print(f"[Login] Phát hiện đang ở extension page, tìm tab đúng...")
                gmail_tab_found = False
                
                # Tìm tab có accounts.google.com hoặc mail.google.com
                for handle in driver.window_handles:
                    try:
                        driver.switch_to.window(handle)
                        url = driver.current_url
                        if "accounts.google.com" in url or "mail.google.com" in url:
                            gmail_tab_found = True
                            print(f"[Login] ✓ Đã tìm thấy tab Gmail/Google, chuyển sang tab này")
                            break
                    except:
                        continue
                
                # Nếu không tìm thấy, mở tab mới
                if not gmail_tab_found:
                    print(f"[Login] Không tìm thấy tab Gmail, mở tab mới...")
                    driver.execute_script("window.open('https://accounts.google.com/signin', '_blank');")
                    time.sleep(3)  # Đợi tab mới mở và load
                    
                    # Chuyển sang tab mới nhất (tab vừa mở)
                    if len(driver.window_handles) > 1:
                        driver.switch_to.window(driver.window_handles[-1])
                        time.sleep(2)  # Đợi tab load
                        print(f"[Login] ✓ Đã mở và chuyển sang tab mới")
            
            print(f"[Login] Bước 2: Navigate to Google signin...")
            # Strategy: Mở tab mới ngay từ đầu để tránh extension page
            current_url = driver.current_url
            print(f"[Login] Current URL ban đầu: {current_url}")
            
            # Nếu đang ở extension page, mở tab mới ngay
            if "chrome-extension://" in current_url or "moz-extension://" in current_url:
                print(f"[Login] Phát hiện extension page, mở tab mới ngay...")
                try:
                    # Mở tab mới với URL đăng nhập
                    driver.execute_script("window.open('https://accounts.google.com/signin', '_blank');")
                    time.sleep(3)  # Đợi tab mới mở
                    
                    # Chuyển sang tab mới nhất (tab vừa mở)
                    if len(driver.window_handles) > 1:
                        driver.switch_to.window(driver.window_handles[-1])
                        time.sleep(2)
                        current_url = driver.current_url
                        print(f"[Login] URL sau khi mở tab mới: {current_url}")
                        
                        # Nếu vẫn ở extension page, thử navigate trong tab mới
                        if "chrome-extension://" in current_url or "moz-extension://" in current_url:
                            print(f"[Login] Tab mới vẫn ở extension, navigate trong tab này...")
                            driver.get("https://accounts.google.com/signin")
                            time.sleep(3)
                            current_url = driver.current_url
                            print(f"[Login] URL sau navigate trong tab mới: {current_url}")
                except Exception as e:
                    print(f"[Login] ⚠ Lỗi khi mở tab mới: {e}")
                    # Fallback: thử navigate trong tab hiện tại
                    try:
                        driver.get("https://accounts.google.com/signin")
                        time.sleep(3)
                        current_url = driver.current_url
                        print(f"[Login] URL sau navigate (fallback): {current_url}")
                    except Exception as e2:
                        print(f"[Login] ✗ Lỗi navigate: {e2}")
                        return False
            else:
                # Nếu không ở extension page, navigate bình thường
                try:
                    driver.get("https://accounts.google.com/signin")
                    time.sleep(3)
                    current_url = driver.current_url
                    print(f"[Login] URL sau navigate: {current_url}")
                except Exception as e:
                    print(f"[Login] ✗ Lỗi navigate: {e}")
                    return False
            
            # Kiểm tra lại URL sau tất cả các bước
            max_retries = 5
            for check_attempt in range(max_retries):
                current_url = driver.current_url
                print(f"[Login] Kiểm tra URL lần {check_attempt + 1}: {current_url}")
                
                if "accounts.google.com" in current_url or "mail.google.com" in current_url:
                    print(f"[Login] ✓ Đã ở đúng trang đăng nhập")
                    break
                elif "chrome-extension://" in current_url or "moz-extension://" in current_url:
                    print(f"[Login] ⚠ Vẫn ở extension page, thử chuyển tab hoặc navigate lại...")
                    
                    # Tìm tab có accounts.google.com
                    found_tab = False
                    for handle in driver.window_handles:
                        try:
                            driver.switch_to.window(handle)
                            url = driver.current_url
                            if "accounts.google.com" in url or "mail.google.com" in url:
                                found_tab = True
                                print(f"[Login] ✓ Tìm thấy tab đúng, chuyển sang")
                                break
                        except:
                            continue
                    
                    if not found_tab:
                        # Mở tab mới và navigate
                        print(f"[Login] Không tìm thấy tab đúng, mở tab mới...")
                        driver.execute_script("window.open('https://accounts.google.com/signin', '_blank');")
                        time.sleep(3)
                        if len(driver.window_handles) > 1:
                            driver.switch_to.window(driver.window_handles[-1])
                            time.sleep(2)
                    
                    if check_attempt < max_retries - 1:
                        time.sleep(2)
                else:
                    # URL khác, có thể đã ở đúng trang
                    print(f"[Login] URL không phải extension, tiếp tục...")
                    break
            
            # Kiểm tra URL cuối cùng
            final_url = driver.current_url
            print(f"[Login] Final URL: {final_url}")
            
            if "chrome-extension://" in final_url or "moz-extension://" in final_url:
                print(f"[Login] ✗ Vẫn ở extension page sau tất cả các bước")
                return False
            
            # Đợi trang load hoàn toàn với behavior giống người
            if human_like:
                HumanBehavior.wait_for_page_load(driver)
                HumanBehavior.simulate_reading(driver, 1.5, 3.0)  # Đọc trang một chút
            else:
                time.sleep(3)
            
            # Kiểm tra lại URL cuối cùng - QUAN TRỌNG: Kiểm tra nhiều lần vì browser có thể tự động chuyển
            final_url = driver.current_url
            print(f"[Login] Final URL sau khi load: {final_url}")
            
            # Nếu vẫn ở extension page, thử lại với cách khác
            if "chrome-extension://" in final_url or "moz-extension://" in final_url:
                print(f"[Login] ⚠ Vẫn ở extension page sau khi load, thử cách cuối cùng...")
                
                # Đóng tab extension hiện tại và mở tab mới
                try:
                    # Lưu handle hiện tại
                    current_handle = driver.current_window_handle
                    
                    # Mở tab mới
                    driver.execute_script("window.open('https://accounts.google.com/signin', '_blank');")
                    time.sleep(4)
                    
                    # Chuyển sang tab mới
                    for handle in driver.window_handles:
                        if handle != current_handle:
                            driver.switch_to.window(handle)
                            time.sleep(2)
                            final_url = driver.current_url
                            print(f"[Login] URL sau khi chuyển sang tab mới: {final_url}")
                            
                            # Nếu vẫn ở extension, navigate lại
                            if "chrome-extension://" in final_url or "moz-extension://" in final_url:
                                print(f"[Login] Tab mới vẫn ở extension, navigate lại...")
                                driver.get("https://accounts.google.com/signin")
                                time.sleep(4)
                                final_url = driver.current_url
                                print(f"[Login] URL sau navigate lại: {final_url}")
                            
                            break
                    
                    # Đóng tab extension cũ nếu có thể
                    try:
                        if len(driver.window_handles) > 1:
                            driver.switch_to.window(current_handle)
                            if "chrome-extension://" in driver.current_url or "moz-extension://" in driver.current_url:
                                driver.close()
                                time.sleep(1)
                                # Chuyển lại sang tab mới
                                for handle in driver.window_handles:
                                    driver.switch_to.window(handle)
                                    if "accounts.google.com" in driver.current_url or "mail.google.com" in driver.current_url:
                                        break
                    except:
                        pass
                        
                except Exception as e:
                    print(f"[Login] ⚠ Lỗi khi thử cách cuối cùng: {e}")
                
                # Kiểm tra lại URL sau tất cả
                final_url = driver.current_url
                print(f"[Login] Final URL sau tất cả các bước: {final_url}")
                
                if "chrome-extension://" in final_url or "moz-extension://" in final_url:
                    print(f"[Login] ✗ Vẫn ở extension page sau tất cả các bước, không thể tiếp tục")
                    return False
            
            # Đảm bảo đang ở đúng trang trước khi tiếp tục
            if "accounts.google.com" not in final_url and "mail.google.com" not in final_url:
                print(f"[Login] ✗ Không ở trang đăng nhập, URL: {final_url}")
                return False
            
            wait = WebDriverWait(driver, 15)
            
            # Nhập email với hành vi giống người
            print(f"[Login] Bước 3: Tìm email input field...")
            print(f"[Login] Current URL trước khi tìm input: {driver.current_url}")
            print(f"[Login] Page title: {driver.title}")
            
            # Thử nhiều selector để tìm email input
            email_input = None
            selectors_to_try = [
                (BySelector.ID, "identifierId"),
                (BySelector.CSS_SELECTOR, "input[type='email']"),
                (BySelector.CSS_SELECTOR, "input[name='identifier']"),
                (BySelector.CSS_SELECTOR, "#identifierId"),
                (BySelector.XPATH, "//input[@type='email']"),
                (BySelector.XPATH, "//input[@id='identifierId']"),
            ]
            
            for selector_type, selector_value in selectors_to_try:
                try:
                    selector_name = selector_type.__name__ if hasattr(selector_type, '__name__') else str(selector_type)
                    print("[Login] Thử selector:", selector_name, "=", selector_value)
                    email_input = wait.until(
                        EC.presence_of_element_located((selector_type, selector_value))
                    )
                    print("[Login] ✓ Đã tìm thấy email input với selector:", selector_value)
                    break
                except Exception as selector_error:
                    try:
                        error_str = str(selector_error)
                    except:
                        error_str = repr(selector_error)
                    # Cắt error message để tránh quá dài, và in an toàn
                    error_short = error_str[:100] if len(error_str) > 100 else error_str
                    print("[Login] Selector", selector_value, "không tìm thấy:", error_short)
                    continue
            
            if not email_input:
                print(f"[Login] ✗ Không thể tìm thấy email input với bất kỳ selector nào")
                return False
            
            try:
                print(f"[Login] Đã tìm thấy email input")
                
                if human_like:
                    # Di chuyển chuột đến input
                    HumanBehavior.random_mouse_movement(driver, email_input)
                    HumanBehavior.random_delay(0.3, 0.7)
                    # Click vào input
                    HumanBehavior.human_click(driver, email_input, move_mouse=False)
                    # Gõ email giống người
                    HumanBehavior.human_type(email_input, email)
                else:
                    email_input.clear()
                    email_input.send_keys(email)
                
                print(f"[Login] Đã nhập email")
            except Exception as e:
                # Dùng cách in exception an toàn để tránh lỗi với f-string
                try:
                    error_msg = str(e)
                except:
                    error_msg = repr(e)
                print("[Login] Lỗi khi nhập email:", error_msg)
                # Thử lại với element đã tìm được
                if email_input:
                    try:
                        if human_like:
                            HumanBehavior.human_click(driver, email_input)
                            HumanBehavior.human_type(email_input, email)
                        else:
                            email_input.clear()
                            email_input.send_keys(email)
                        print(f"[Login] Đã nhập email (thử lại)")
                    except Exception as e2:
                        try:
                            error_msg2 = str(e2)
                        except:
                            error_msg2 = repr(e2)
                        print("[Login] Không thể nhập email:", error_msg2)
                        return False
                else:
                    print("[Login] Không có email input element để thử lại")
                    return False
            
            # Pause trước khi click Next (giống người đang kiểm tra lại)
            if human_like:
                HumanBehavior.random_pause(0.5, 1.5)
            
            # Click Next với hành vi giống người
            try:
                next_button = wait.until(
                    EC.element_to_be_clickable((BySelector.ID, "identifierNext"))
                )
                if human_like:
                    HumanBehavior.human_click(driver, next_button)
                else:
                    next_button.click()
                    time.sleep(3)
                print(f"[Login] Đã click Next (email)")
            except Exception as e:
                try:
                    error_msg = str(e)
                except:
                    error_msg = repr(e)
                print("[Login] Lỗi click Next (email):", error_msg)
                return False
            
            # Đợi trang password load
            print(f"[Login] Bước 4: Đợi trang password load...")
            print(f"[Login] Current URL trước khi đợi: {driver.current_url}")
            
            # Kiểm tra và đảm bảo không ở extension page
            max_url_checks = 5
            for url_check in range(max_url_checks):
                current_url = driver.current_url
                print(f"[Login] Kiểm tra URL lần {url_check + 1}: {current_url}")
                
                if "chrome-extension://" in current_url or "moz-extension://" in current_url:
                    print(f"[Login] ⚠ Vẫn ở extension page, tìm tab đúng...")
                    # Tìm tab có accounts.google.com
                    found_tab = False
                    for handle in driver.window_handles:
                        try:
                            driver.switch_to.window(handle)
                            url = driver.current_url
                            if "accounts.google.com" in url or "mail.google.com" in url:
                                found_tab = True
                                print(f"[Login] ✓ Tìm thấy tab đúng, chuyển sang")
                                break
                        except:
                            continue
                    
                    if not found_tab:
                        print(f"[Login] Không tìm thấy tab đúng, đợi thêm...")
                        time.sleep(2)
                        if url_check < max_url_checks - 1:
                            continue
                else:
                    print(f"[Login] ✓ Đã ở trang đúng")
                    break
            
            if human_like:
                HumanBehavior.wait_for_page_load(driver)
                HumanBehavior.random_delay(1.5, 3.0)  # Đọc trang một chút, tăng thời gian đợi
            else:
                time.sleep(4)  # Tăng thời gian đợi
            
            # Kiểm tra lại URL sau khi đợi
            final_url_before_password = driver.current_url
            print(f"[Login] URL sau khi đợi: {final_url_before_password}")
            print(f"[Login] Page title: {driver.title}")
            
            if "chrome-extension://" in final_url_before_password or "moz-extension://" in final_url_before_password:
                print(f"[Login] ✗ Vẫn ở extension page sau khi đợi, không thể tiếp tục")
                return {"needs_manual": True, "reason": "Browser đang ở extension page, cần xử lý thủ công"}
            
            # Nhập password với hành vi giống người - thử nhiều selector và retry
            print(f"[Login] Bước 5: Tìm password input field...")
            password_input = None
            
            # Danh sách selector để thử
            password_selectors = [
                (BySelector.NAME, "password"),
                (BySelector.CSS_SELECTOR, "input[type='password']"),
                (BySelector.CSS_SELECTOR, "input[name='password']"),
                (BySelector.ID, "password"),
                (BySelector.XPATH, "//input[@type='password']"),
                (BySelector.XPATH, "//input[@name='password']"),
                (BySelector.CSS_SELECTOR, "#password"),
            ]
            
            # Thử với timeout dài hơn và nhiều lần
            max_retries = 3
            for retry in range(max_retries):
                print(f"[Login] Thử tìm password input (lần {retry + 1}/{max_retries})...")
                
                for selector_type, selector_value in password_selectors:
                    try:
                        selector_name = selector_type.__name__ if hasattr(selector_type, '__name__') else str(selector_type)
                        print(f"[Login] Thử selector: {selector_name} = {selector_value}")
                        
                        # Tăng timeout cho password input
                        password_wait = WebDriverWait(driver, 10)  # Timeout 10 giây
                        password_input = password_wait.until(
                            EC.presence_of_element_located((selector_type, selector_value))
                        )
                        print(f"[Login] ✓ Đã tìm thấy password input với selector: {selector_value}")
                        break
                    except Exception as selector_error:
                        try:
                            error_str = str(selector_error)
                        except:
                            error_str = repr(selector_error)
                        error_short = error_str[:100] if len(error_str) > 100 else error_str
                        print(f"[Login] Selector {selector_value} không tìm thấy: {error_short}")
                        continue
                
                if password_input:
                    break
                
                # Nếu không tìm thấy, đợi thêm và thử lại
                if retry < max_retries - 1:
                    print(f"[Login] Không tìm thấy password input, đợi thêm 3 giây và thử lại...")
                    time.sleep(3)
                    # Kiểm tra lại URL
                    current_url = driver.current_url
                    print(f"[Login] URL hiện tại: {current_url}")
                    if "chrome-extension://" in current_url or "moz-extension://" in current_url:
                        print(f"[Login] ⚠ Phát hiện đang ở extension page, tìm tab đúng...")
                        for handle in driver.window_handles:
                            try:
                                driver.switch_to.window(handle)
                                url = driver.current_url
                                if "accounts.google.com" in url or "mail.google.com" in url:
                                    print(f"[Login] ✓ Đã chuyển sang tab đúng")
                                    break
                            except:
                                continue
            
            if not password_input:
                # Thử tìm bằng cách khác - tìm tất cả input password
                print(f"[Login] Thử tìm tất cả input password trên trang...")
                try:
                    all_password_inputs = driver.find_elements(BySelector.CSS_SELECTOR, "input[type='password']")
                    print(f"[Login] Tìm thấy {len(all_password_inputs)} input password trên trang")
                    if all_password_inputs:
                        password_input = all_password_inputs[0]
                        print(f"[Login] ✓ Sử dụng input password đầu tiên")
                except Exception as e:
                    print(f"[Login] Không thể tìm input password: {e}")
                
                if not password_input:
                    # Log thông tin chi tiết để debug
                    print(f"[Login] ✗✗✗ KHÔNG THỂ TÌM THẤY PASSWORD INPUT ✗✗✗")
                    print(f"[Login] Current URL: {driver.current_url}")
                    print(f"[Login] Page title: {driver.title}")
                    print(f"[Login] Page source length: {len(driver.page_source)}")
                    
                    # Không return False ngay, mà trả về thông tin để xử lý thủ công
                    return {"needs_manual": True, "reason": "Không thể tìm thấy password input field. Browser đang mở để bạn có thể nhập password thủ công."}
            
            # Nhập password
            try:
                print(f"[Login] Đã tìm thấy password input, bắt đầu nhập password...")
                
                if human_like:
                    # Di chuyển chuột đến input
                    HumanBehavior.random_mouse_movement(driver, password_input)
                    HumanBehavior.random_delay(0.3, 0.7)
                    # Click vào input
                    HumanBehavior.human_click(driver, password_input, move_mouse=False)
                    # Gõ password giống người (chậm hơn email vì cần cẩn thận)
                    HumanBehavior.human_type(password_input, password, 
                                           typing_speed_min=0.08, typing_speed_max=0.4)
                else:
                    password_input.clear()
                    password_input.send_keys(password)
                
                print(f"[Login] ✓ Đã nhập password")
            except Exception as e:
                try:
                    error_msg = str(e)
                except:
                    error_msg = repr(e)
                print(f"[Login] ✗ Lỗi khi nhập password: {error_msg}")
                return {"needs_manual": True, "reason": f"Lỗi khi nhập password: {error_msg}. Browser đang mở để bạn có thể nhập password thủ công."}
            
            # Pause trước khi click Next (giống người đang suy nghĩ)
            if human_like:
                HumanBehavior.random_pause(0.8, 2.0)
            
            # Click Next với hành vi giống người
            try:
                password_next = wait.until(
                    EC.element_to_be_clickable((BySelector.ID, "passwordNext"))
                )
                if human_like:
                    HumanBehavior.human_click(driver, password_next)
                    # Đợi đăng nhập với delay dài hơn
                    HumanBehavior.random_delay(3.0, 6.0)
                else:
                    password_next.click()
                    time.sleep(5)
                print(f"[Login] Đã click Next (password)")
                
                # Kiểm tra xem có thông báo lỗi mật khẩu sai không
                time.sleep(2)  # Đợi thông báo lỗi xuất hiện nếu có
                try:
                    page_text = driver.page_source.lower()
                    page_title_lower = driver.title.lower()
                    
                    # Kiểm tra các thông báo lỗi mật khẩu sai
                    wrong_password_indicators = [
                        "wrong password",
                        "mật khẩu sai",
                        "password incorrect",
                        "incorrect password",
                        "try again",
                        "thử lại",
                        "forgot password",
                        "quên mật khẩu",
                        "password you entered is incorrect",
                        "mật khẩu bạn nhập không đúng"
                    ]
                    
                    is_wrong_password = False
                    for indicator in wrong_password_indicators:
                        if indicator in page_text or indicator in page_title_lower:
                            # Kiểm tra xem có phải là thông báo lỗi mật khẩu không (không phải ở trang khác)
                            current_url = driver.current_url
                            if "accounts.google.com" in current_url and "signin" in current_url:
                                is_wrong_password = True
                                print(f"[Login] ✗ Phát hiện thông báo mật khẩu sai: '{indicator}'")
                                break
                    
                    if is_wrong_password:
                        # Tìm thông báo lỗi cụ thể trên trang
                        try:
                            error_elements = driver.find_elements(BySelector.CSS_SELECTOR, 
                                "[role='alert'], .error, [class*='error'], [id*='error'], div[aria-live]")
                            for elem in error_elements:
                                try:
                                    elem_text = elem.text.lower()
                                    if any(ind in elem_text for ind in wrong_password_indicators[:6]):  # Chỉ kiểm tra các indicator chính
                                        print(f"[Login] ✗ Xác nhận thông báo mật khẩu sai: {elem.text[:100]}")
                                        print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - WRONG PASSWORD ==========")
                                        return {"wrong_password": True, "error": "Mật khẩu sai. Vui lòng kiểm tra lại."}
                                except:
                                    continue
                        except:
                            pass
                        
                        # Nếu không tìm thấy element cụ thể nhưng có indicator trong page text
                        print(f"[Login] ✗ Xác nhận mật khẩu sai từ page text")
                        print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - WRONG PASSWORD ==========")
                        return {"wrong_password": True, "error": "Mật khẩu sai. Vui lòng kiểm tra lại."}
                except Exception as e:
                    print(f"[Login] ⚠ Lỗi khi kiểm tra thông báo mật khẩu sai: {e}")
                    
            except Exception as e:
                try:
                    error_msg = str(e)
                except:
                    error_msg = repr(e)
                print("[Login] Lỗi click Next (password):", error_msg)
                return False
            
            # Đợi redirect và kiểm tra kết quả
            print(f"[Login] Bước 7: Đợi redirect và kiểm tra kết quả...")
            if human_like:
                HumanBehavior.wait_for_page_load(driver)
                HumanBehavior.random_delay(1.0, 2.0)
            else:
                time.sleep(3)
            
            current_url = driver.current_url
            print(f"[Login] Current URL sau khi đăng nhập: {current_url}")
            print(f"[Login] Page title: {driver.title}")
            
            # Kiểm tra lại xem có thông báo mật khẩu sai không (sau khi redirect)
            try:
                page_text = driver.page_source.lower()
                
                # Kiểm tra các thông báo lỗi mật khẩu sai
                wrong_password_indicators = [
                    "wrong password",
                    "mật khẩu sai",
                    "password incorrect",
                    "incorrect password",
                    "the password you entered is incorrect",
                    "mật khẩu bạn nhập không đúng"
                ]
                
                # Chỉ kiểm tra nếu vẫn ở trang signin
                if "accounts.google.com" in current_url and "signin" in current_url:
                    for indicator in wrong_password_indicators:
                        if indicator in page_text:
                            # Tìm thông báo lỗi cụ thể trên trang
                            try:
                                error_elements = driver.find_elements(BySelector.CSS_SELECTOR, 
                                    "[role='alert'], .error, [class*='error'], [id*='error'], div[aria-live], span[class*='error']")
                                for elem in error_elements:
                                    try:
                                        elem_text = elem.text.lower()
                                        if any(ind in elem_text for ind in wrong_password_indicators):
                                            print(f"[Login] ✗ Phát hiện thông báo mật khẩu sai sau redirect: {elem.text[:100]}")
                                            print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - WRONG PASSWORD ==========")
                                            return {"wrong_password": True, "error": "Mật khẩu sai. Vui lòng kiểm tra lại."}
                                    except:
                                        continue
                            except:
                                pass
                            
                            # Nếu tìm thấy indicator trong page text
                            print(f"[Login] ✗ Phát hiện mật khẩu sai từ page text sau redirect: '{indicator}'")
                            print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - WRONG PASSWORD ==========")
                            return {"wrong_password": True, "error": "Mật khẩu sai. Vui lòng kiểm tra lại."}
            except Exception as e:
                print(f"[Login] ⚠ Lỗi khi kiểm tra mật khẩu sai sau redirect: {e}")
            
            # Kiểm tra và xử lý các màn hình setup (như "Đặt địa chỉ nhà riêng")
            # Xử lý nhiều màn hình setup có thể xuất hiện liên tiếp
            max_setup_attempts = 5
            for setup_attempt in range(max_setup_attempts):
                try:
                    page_text = driver.page_source.lower()
                    page_title_lower = driver.title.lower()
                    
                    # Kiểm tra các dấu hiệu của màn hình setup
                    setup_indicators = [
                        "đặt địa chỉ nhà riêng",
                        "set home address",
                        "địa chỉ nhà riêng",
                        "home address",
                        "bỏ qua",
                        "skip",
                        "set up your account",
                        "thiết lập tài khoản",
                        "complete your profile",
                        "hoàn thiện hồ sơ",
                        "add phone number",
                        "thêm số điện thoại",
                        "add recovery email",
                        "thêm email khôi phục",
                        "set up two-step verification",
                        "thiết lập xác minh 2 bước"
                    ]
                    
                    is_setup_page = False
                    setup_indicator_found = None
                    for indicator in setup_indicators:
                        if indicator in page_text or indicator in page_title_lower:
                            is_setup_page = True
                            setup_indicator_found = indicator
                            print(f"[Login] Phát hiện màn hình setup (lần {setup_attempt + 1}): '{indicator}'")
                            break
                    
                    if not is_setup_page:
                        # Không còn màn hình setup nào, thoát vòng lặp
                        if setup_attempt > 0:
                            print(f"[Login] ✓ Đã xử lý xong tất cả màn hình setup")
                        break
                    
                    print(f"[Login] Tìm nút 'Bỏ qua' hoặc 'Skip'...")
                    
                    # Tìm và click nút "Bỏ qua" hoặc "Skip"
                    skip_button = None
                    skip_selectors = [
                        (BySelector.XPATH, "//button[contains(text(), 'Bỏ qua')]"),
                        (BySelector.XPATH, "//button[contains(text(), 'Skip')]"),
                        (BySelector.XPATH, "//span[contains(text(), 'Bỏ qua')]/parent::button"),
                        (BySelector.XPATH, "//span[contains(text(), 'Skip')]/parent::button"),
                        (BySelector.CSS_SELECTOR, "button[aria-label*='Bỏ qua']"),
                        (BySelector.CSS_SELECTOR, "button[aria-label*='Skip']"),
                        (BySelector.XPATH, "//button[contains(., 'Bỏ qua')]"),
                        (BySelector.XPATH, "//button[contains(., 'Skip')]"),
                        (BySelector.XPATH, "//div[@role='button' and contains(text(), 'Bỏ qua')]"),
                        (BySelector.XPATH, "//div[@role='button' and contains(text(), 'Skip')]"),
                    ]
                    
                    for selector_type, selector_value in skip_selectors:
                        try:
                            elements = driver.find_elements(selector_type, selector_value)
                            for elem in elements:
                                if elem.is_displayed():
                                    skip_button = elem
                                    print(f"[Login] ✓ Tìm thấy nút Bỏ qua/Skip với selector: {selector_value}")
                                    break
                            if skip_button:
                                break
                        except:
                            continue
                    
                    # Nếu không tìm thấy bằng selector, thử tìm bằng text trong tất cả button và div có role=button
                    if not skip_button:
                        try:
                            all_clickable = driver.find_elements(BySelector.TAG_NAME, "button")
                            all_clickable.extend(driver.find_elements(BySelector.CSS_SELECTOR, "div[role='button']"))
                            
                            for btn in all_clickable:
                                try:
                                    btn_text = btn.text.lower().strip()
                                    if ("bỏ qua" in btn_text or "skip" in btn_text) and btn.is_displayed():
                                        skip_button = btn
                                        print(f"[Login] ✓ Tìm thấy nút Bỏ qua/Skip bằng text: {btn.text}")
                                        break
                                except:
                                    continue
                        except Exception as e:
                            print(f"[Login] ⚠ Lỗi khi tìm nút Bỏ qua: {e}")
                    
                    # Click nút Bỏ qua nếu tìm thấy
                    if skip_button:
                        try:
                            # Scroll đến button nếu cần
                            driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", skip_button)
                            time.sleep(0.5)
                            
                            if human_like:
                                HumanBehavior.human_click(driver, skip_button)
                            else:
                                skip_button.click()
                            print(f"[Login] ✓ Đã click nút Bỏ qua/Skip")
                            
                            # Đợi modal đóng và trang load lại
                            if human_like:
                                HumanBehavior.wait_for_page_load(driver)
                                HumanBehavior.random_delay(1.5, 2.5)
                            else:
                                time.sleep(2)
                            
                            # Cập nhật URL sau khi click
                            current_url = driver.current_url
                            print(f"[Login] URL sau khi bỏ qua setup: {current_url}")
                            
                            # Đợi thêm một chút để đảm bảo modal đã đóng
                            time.sleep(1)
                        except Exception as e:
                            print(f"[Login] ⚠ Lỗi khi click nút Bỏ qua: {e}")
                            # Thử cách khác - click bằng JavaScript
                            try:
                                driver.execute_script("arguments[0].click();", skip_button)
                                print(f"[Login] ✓ Đã click nút Bỏ qua bằng JavaScript")
                                time.sleep(2)
                            except:
                                print(f"[Login] ✗ Không thể click nút Bỏ qua")
                    else:
                        print(f"[Login] ⚠ Không tìm thấy nút Bỏ qua/Skip, tiếp tục...")
                        # Nếu không tìm thấy nút, có thể màn hình setup đã tự đóng hoặc không phải setup page
                        break
                except Exception as e:
                    print(f"[Login] ⚠ Lỗi khi xử lý setup page (lần {setup_attempt + 1}): {e}")
                    break
            
            # Kiểm tra nếu đang ở màn hình "Verify it's you" (challenge/verification)
            try:
                page_text = driver.page_source.lower()
                page_title_lower = driver.title.lower()
                
                # Kiểm tra các dấu hiệu của màn hình xác nhận (cả tiếng Anh và tiếng Việt)
                verification_indicators = [
                    "verify it's you",
                    "verify it is you",
                    "choose how you want to sign in",
                    "get a verification code",
                    "get a call at",
                    "use another phone",
                    "confirm your recovery",
                    "xác minh danh tính của bạn",  # Tiếng Việt
                    "chọn cách bạn muốn đăng nhập",  # Tiếng Việt
                    "nhận mã xác minh",  # Tiếng Việt
                    "nhận cuộc gọi",  # Tiếng Việt
                    "sử dụng một điện thoại hoặc máy tính khác",  # Tiếng Việt
                    "xác nhận số điện thoại khôi phục"  # Tiếng Việt
                ]
                
                is_verification_page = False
                detected_indicator = None
                for indicator in verification_indicators:
                    if indicator in page_text or indicator in page_title_lower:
                        is_verification_page = True
                        detected_indicator = indicator
                        print(f"[Login] ⚠ Phát hiện màn hình xác nhận: '{indicator}'")
                        break
                
                if is_verification_page:
                    print(f"[Login] ⚠ Phát hiện màn hình verify - chờ đợi người dùng xử lý...")
                    print(f"[Login] URL: {current_url}")
                    print(f"[Login] Màn hình: {detected_indicator}")
                    
                    # Chờ đợi cho đến khi màn hình thay đổi (không còn là verification page)
                    max_wait_time = MANUAL_LOGIN_2FA_WAIT_SECONDS  # 5 phút mặc định
                    check_interval = MANUAL_LOGIN_2FA_CHECK_INTERVAL  # 10 giây mặc định
                    wait_start_time = time.time()
                    last_url = current_url
                    
                    print(f"[Login] Bắt đầu chờ đợi (tối đa {max_wait_time} giây, kiểm tra mỗi {check_interval} giây)...")
                    
                    while True:
                        elapsed_time = time.time() - wait_start_time
                        
                        if elapsed_time >= max_wait_time:
                            print(f"[Login] ⚠ Đã hết thời gian chờ ({max_wait_time} giây), vẫn ở màn hình verify")
                            print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - VERIFICATION TIMEOUT ==========")
                            return {"needs_2fa": True, "url": current_url, "verification_page": True, "timeout": True}
                        
                        # Đợi một khoảng thời gian trước khi kiểm tra lại
                        time.sleep(check_interval)
                        
                        try:
                            # Kiểm tra lại URL và page content
                            current_url_check = driver.current_url
                            page_text_check = driver.page_source.lower()
                            page_title_check = driver.title.lower()
                            
                            # Kiểm tra xem còn là verification page không
                            still_verification = False
                            for indicator in verification_indicators:
                                if indicator in page_text_check or indicator in page_title_check:
                                    still_verification = True
                                    break
                            
                            # Nếu URL thay đổi hoặc không còn là verification page
                            if current_url_check != last_url:
                                print(f"[Login] ✓ URL đã thay đổi: {last_url} -> {current_url_check}")
                                last_url = current_url_check
                                
                                if not still_verification:
                                    print(f"[Login] ✓ Màn hình đã thay đổi, không còn là verification page")
                                    print(f"[Login] Tiếp tục xử lý đăng nhập...")
                                    # Break khỏi vòng lặp chờ và tiếp tục xử lý
                                    break
                                else:
                                    print(f"[Login] URL đã thay đổi nhưng vẫn là verification page, tiếp tục chờ...")
                            elif not still_verification:
                                print(f"[Login] ✓ Màn hình đã thay đổi, không còn là verification page")
                                print(f"[Login] Tiếp tục xử lý đăng nhập...")
                                # Break khỏi vòng lặp chờ và tiếp tục xử lý
                                break
                            else:
                                # Vẫn là verification page
                                remaining_time = max_wait_time - elapsed_time
                                print(f"[Login] Vẫn ở màn hình verify... (còn lại ~{int(remaining_time)} giây)")
                                
                        except Exception as check_error:
                            print(f"[Login] ⚠ Lỗi khi kiểm tra lại màn hình: {check_error}")
                            # Tiếp tục chờ
                            continue
                    
                    # Sau khi màn hình đã thay đổi, cập nhật current_url và tiếp tục xử lý
                    current_url = driver.current_url
                    print(f"[Login] ✓ Màn hình verify đã được xử lý, URL hiện tại: {current_url}")
                    # Tiếp tục xử lý bình thường (không return, để code tiếp tục kiểm tra myaccount.google.com hoặc mail.google.com)
                    
            except Exception as e:
                print(f"[Login] ⚠ Lỗi khi kiểm tra verification page: {e}")
            
            # Kiểm tra nếu đã đăng nhập thành công vào myaccount.google.com
            if "myaccount.google.com" in current_url:
                print(f"[Login] ✓✓✓ ĐĂNG NHẬP THÀNH CÔNG VÀO MYACCOUNT: {email} ✓✓✓")
                
                # Thực hiện các thao tác random trên myaccount.google.com
                if human_like:
                    print(f"[Login] Thực hiện các thao tác random trên myaccount.google.com...")
                    
                    # 1. Đợi trang load hoàn toàn
                    HumanBehavior.wait_for_page_load(driver, timeout=15)
                    HumanBehavior.random_pause(2.0, 4.0)  # Đọc trang một chút
                    
                    # 2. Scroll để xem trang
                    HumanBehavior.human_scroll(driver, 'down', random.randint(200, 500))
                    HumanBehavior.random_pause(1.0, 2.0)
                    
                    # 3. Click vào các menu/liên kết ngẫu nhiên (30% khả năng)
                    if random.random() < 0.3:
                        try:
                            # Tìm các link trong menu
                            menu_links = driver.find_elements(BySelector.CSS_SELECTOR, "a[href*='myaccount.google.com'], nav a, .menu-item a")[:5]
                            if menu_links:
                                link_to_click = random.choice(menu_links)
                                link_text = link_to_click.text.strip()[:50] if link_to_click.text else "link"
                                print(f"[Login] Click vào menu: {link_text}")
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link_to_click)
                                HumanBehavior.random_pause(0.5, 1.0)
                                HumanBehavior.human_click(driver, link_to_click)
                                HumanBehavior.random_pause(2.0, 4.0)  # Xem trang mới
                                print(f"[Login] Đã xem trang: {link_text}")
                        except Exception as e:
                            print(f"[Login] Lỗi khi click menu: {e}")
                    
                    # 4. Scroll thêm
                    HumanBehavior.human_scroll(driver, 'down', random.randint(100, 300))
                    HumanBehavior.random_pause(1.0, 2.0)
                    
                    # 5. Di chuyển chuột ngẫu nhiên (40% khả năng)
                    if random.random() < 0.4:
                        try:
                            HumanBehavior.random_mouse_movement(driver)
                            print(f"[Login] Đã di chuyển chuột ngẫu nhiên")
                        except:
                            pass
                    
                    # 6. Quay lại trang chính nếu đã click vào menu
                    if random.random() < 0.5:
                        try:
                            driver.get("https://myaccount.google.com/")
                            HumanBehavior.random_pause(1.0, 2.0)
                            print(f"[Login] Đã quay lại trang chính myaccount")
                        except:
                            pass
                    
                    # 7. Pause cuối cùng
                    HumanBehavior.random_pause(1.5, 3.0)
                    print(f"[Login] ✓ Đã hoàn thành các thao tác random trên myaccount.google.com")
                
                # Lưu cookies sau khi đăng nhập thành công
                try:
                    cookies = driver.get_cookies()
                    import json
                    cookies_json = json.dumps(cookies)
                    print(f"[Login] Đã lấy cookies ({len(cookies)} cookies)")
                    print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - SUCCESS (myaccount) ==========")
                    return {"success": True, "cookies": cookies_json, "url": current_url}
                except Exception as e:
                    try:
                        error_msg = str(e)
                    except:
                        error_msg = repr(e)
                    print("[Login] ⚠ Lỗi lấy cookies:", error_msg)
                    print("[Login] ========== KẾT THÚC LOGIN_GMAIL - SUCCESS (myaccount, no cookies) ==========")
                    return {"success": True, "url": current_url}
            
            if "mail.google.com" in current_url:
                print(f"[Login] ✓✓✓ ĐĂNG NHẬP THÀNH CÔNG: {email} ✓✓✓")
                
                # Thực hiện các thao tác random giống người sau khi đăng nhập thành công
                if human_like:
                    print(f"[Login] Thực hiện các thao tác random giống người sau khi đăng nhập...")
                    
                    # 1. Đợi inbox load hoàn toàn
                    HumanBehavior.wait_for_page_load(driver, timeout=15)
                    HumanBehavior.random_pause(1.5, 3.0)  # Đọc inbox một chút
                    
                    # 2. Scroll nhẹ để "xem" inbox
                    HumanBehavior.human_scroll(driver, 'down', random.randint(100, 300))
                    HumanBehavior.random_pause(0.8, 1.5)
                    
                    # 3. Di chuyển chuột ngẫu nhiên (30% khả năng)
                    if random.random() < 0.3:
                        try:
                            HumanBehavior.random_mouse_movement(driver)
                            print(f"[Login] Đã di chuyển chuột ngẫu nhiên")
                        except:
                            pass
                    
                    # 4. Hover vào một email (40% khả năng)
                    if random.random() < 0.4:
                        try:
                            email_elements = driver.find_elements(BySelector.CSS_SELECTOR, "tr.zA")[:5]
                            if email_elements:
                                email_to_hover = random.choice(email_elements)
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_to_hover)
                                HumanBehavior.random_pause(0.5, 1.0)
                                HumanBehavior.random_mouse_movement(driver, email_to_hover)
                                print(f"[Login] Đã hover vào một email")
                        except Exception as e:
                            try:
                                error_msg = str(e)
                            except:
                                error_msg = repr(e)
                            print("[Login] Lỗi khi hover email:", error_msg)
                    
                    # 5. Click vào một email đã đọc (20% khả năng)
                    if random.random() < 0.2:
                        try:
                            read_emails = driver.find_elements(BySelector.CSS_SELECTOR, "tr.zA.zE")[:3]
                            if read_emails:
                                email_to_click = random.choice(read_emails)
                                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_to_click)
                                HumanBehavior.random_pause(0.5, 1.0)
                                email_to_click.click()
                                HumanBehavior.random_pause(2.0, 4.0)  # Đọc email một chút
                                print(f"[Login] Đã mở một email đã đọc")
                                
                                # Quay lại inbox
                                driver.back()
                                HumanBehavior.random_pause(1.0, 2.0)
                        except Exception as e:
                            try:
                                error_msg = str(e)
                            except:
                                error_msg = repr(e)
                            print("[Login] Lỗi khi click email:", error_msg)
                    
                    # 6. Scroll thêm một chút (50% khả năng)
                    if random.random() < 0.5:
                        scroll_direction = random.choice(['down', 'up'])
                        HumanBehavior.human_scroll(driver, scroll_direction, random.randint(50, 200))
                        HumanBehavior.random_pause(0.5, 1.0)
                    
                    # 7. Pause cuối cùng (giống người đang xem)
                    HumanBehavior.random_pause(1.0, 2.5)
                    print(f"[Login] ✓ Đã hoàn thành các thao tác random giống người")
                
                # Lưu cookies sau khi đăng nhập thành công và thực hiện các thao tác
                try:
                    cookies = driver.get_cookies()
                    import json
                    cookies_json = json.dumps(cookies)
                    print(f"[Login] Đã lấy cookies ({len(cookies)} cookies)")
                    # Trả về cookies cùng với success
                    print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - SUCCESS ==========")
                    return {"success": True, "cookies": cookies_json}
                except Exception as e:
                    try:
                        error_msg = str(e)
                    except:
                        error_msg = repr(e)
                    print("[Login] ⚠ Lỗi lấy cookies:", error_msg)
                    print("[Login] ========== KẾT THÚC LOGIN_GMAIL - SUCCESS (no cookies) ==========")
                    return True
            elif "challenge" in current_url or "signin/challenge" in current_url or "/challenge" in current_url:
                print(f"[Login] ⚠ Phát hiện challenge/2FA: {email}")
                print(f"[Login] URL: {current_url}")
                print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - CHALLENGE ==========")
                # Trả về một dict đặc biệt để báo cần xử lý 2FA
                return {"needs_2fa": True, "url": current_url}
            elif "signin" in current_url or ("accounts.google.com" in current_url and "myaccount" not in current_url):
                # Kiểm tra lại xem có phải là màn hình verification không
                try:
                    page_text = driver.page_source.lower()
                    page_title_lower = driver.title.lower()
                    
                    # Kiểm tra các dấu hiệu verification (cả tiếng Anh và tiếng Việt)
                    verification_indicators_check = [
                        "verify it's you",
                        "choose how you want to sign in",
                        "xác minh danh tính của bạn",
                        "chọn cách bạn muốn đăng nhập"
                    ]
                    
                    is_verification = False
                    detected_indicator = None
                    for indicator in verification_indicators_check:
                        if indicator in page_text or indicator in page_title_lower:
                            is_verification = True
                            detected_indicator = indicator
                            print(f"[Login] ⚠ Phát hiện màn hình verification trong accounts.google.com: '{indicator}'")
                            break
                    
                    if is_verification:
                        print(f"[Login] ⚠ Phát hiện màn hình verify - chờ đợi người dùng xử lý...")
                        print(f"[Login] URL: {current_url}")
                        print(f"[Login] Màn hình: {detected_indicator}")
                        
                        # Chờ đợi cho đến khi màn hình thay đổi
                        max_wait_time = MANUAL_LOGIN_2FA_WAIT_SECONDS
                        check_interval = MANUAL_LOGIN_2FA_CHECK_INTERVAL
                        wait_start_time = time.time()
                        last_url = current_url
                        
                        print(f"[Login] Bắt đầu chờ đợi (tối đa {max_wait_time} giây, kiểm tra mỗi {check_interval} giây)...")
                        
                        while True:
                            elapsed_time = time.time() - wait_start_time
                            
                            if elapsed_time >= max_wait_time:
                                print(f"[Login] ⚠ Đã hết thời gian chờ ({max_wait_time} giây), vẫn ở màn hình verify")
                                return {"needs_2fa": True, "url": current_url, "verification_page": True, "timeout": True}
                            
                            time.sleep(check_interval)
                            
                            try:
                                current_url_check = driver.current_url
                                page_text_check = driver.page_source.lower()
                                page_title_check = driver.title.lower()
                                
                                still_verification = False
                                for indicator in verification_indicators_check:
                                    if indicator in page_text_check or indicator in page_title_check:
                                        still_verification = True
                                        break
                                
                                if current_url_check != last_url:
                                    print(f"[Login] ✓ URL đã thay đổi: {last_url} -> {current_url_check}")
                                    last_url = current_url_check
                                    
                                    if not still_verification:
                                        print(f"[Login] ✓ Màn hình đã thay đổi, tiếp tục xử lý...")
                                        current_url = current_url_check
                                        break
                                    else:
                                        print(f"[Login] URL đã thay đổi nhưng vẫn là verification page, tiếp tục chờ...")
                                elif not still_verification:
                                    print(f"[Login] ✓ Màn hình đã thay đổi, tiếp tục xử lý...")
                                    current_url = current_url_check
                                    break
                                else:
                                    remaining_time = max_wait_time - elapsed_time
                                    print(f"[Login] Vẫn ở màn hình verify... (còn lại ~{int(remaining_time)} giây)")
                                    
                            except Exception as check_error:
                                print(f"[Login] ⚠ Lỗi khi kiểm tra lại: {check_error}")
                                continue
                        
                        # Sau khi màn hình đã thay đổi, kiểm tra lại URL để quyết định tiếp tục
                        print(f"[Login] ✓ Màn hình verify đã được xử lý, URL hiện tại: {current_url}")
                        
                        # Kiểm tra lại URL sau khi verify để quyết định tiếp tục
                        if "myaccount.google.com" in current_url:
                            print(f"[Login] ✓ Sau verify, đã đến myaccount.google.com")
                            # Tiếp tục xử lý myaccount (sẽ được xử lý ở phần code phía trên)
                            # Nhưng vì đã qua phần kiểm tra myaccount rồi, nên cần kiểm tra lại
                            try:
                                cookies = driver.get_cookies()
                                import json
                                cookies_json = json.dumps(cookies)
                                print(f"[Login] Đã lấy cookies ({len(cookies)} cookies)")
                                return {"success": True, "cookies": cookies_json, "url": current_url}
                            except:
                                return {"success": True, "url": current_url}
                        elif "mail.google.com" in current_url:
                            print(f"[Login] ✓ Sau verify, đã đến mail.google.com")
                            try:
                                cookies = driver.get_cookies()
                                import json
                                cookies_json = json.dumps(cookies)
                                print(f"[Login] Đã lấy cookies ({len(cookies)} cookies)")
                                return {"success": True, "cookies": cookies_json}
                            except:
                                return True
                        else:
                            # Vẫn ở trang khác, có thể cần xử lý thêm
                            print(f"[Login] Sau verify, URL: {current_url} - tiếp tục xử lý...")
                            # Tiếp tục xử lý bình thường (không return, để code tiếp tục)
                except:
                    pass
                
                print(f"[Login] ✗ Đăng nhập thất bại, vẫn ở trang signin: {email}")
                print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - FAILED ==========")
                return False
            else:
                print(f"[Login] ⚠ URL không xác định: {current_url}")
                print(f"[Login] ========== KẾT THÚC LOGIN_GMAIL - UNKNOWN ==========")
                return False
        except Exception as e:
            # Xử lý exception an toàn để tránh lỗi với f-string
            try:
                error_msg = str(e)
            except:
                try:
                    error_msg = repr(e)
                except:
                    error_msg = "Unknown error"
            print("[Login] ✗✗✗ EXCEPTION trong login_gmail:", error_msg, "✗✗✗")
            import traceback
            print("[Login] Traceback:")
            traceback.print_exc()
            print("[Login] ========== KẾT THÚC LOGIN_GMAIL - EXCEPTION ==========")
            return False
    
    def close_all_profiles(self):
        """Đóng tất cả profiles đang mở"""
        for profile_id in list(self.active_profiles.keys()):
            self.stop_profile(profile_id)

