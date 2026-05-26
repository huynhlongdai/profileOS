"""
Module quản lý tài khoản với tự động tạo profile GPMLogin và gán proxy
"""
from database import Database
from gpmlogin_manager import GPMLoginManager
from proxy_manager import ProxyManager

class AccountManager:
    """Quản lý tài khoản với tự động tạo profile và gán proxy"""
    
    def __init__(self):
        self.db = Database()
        self.gpm_manager = GPMLoginManager()
        self.proxy_manager = ProxyManager()
    
    def add_account_with_auto_profile(self, email, password, proxy=None, auto_create_profile=True, 
                                     auto_assign_proxy=True, notes="", proxy_api_url=None, auto_change_proxy=False):
        """Thêm tài khoản và tự động tạo profile GPMLogin
        
        Args:
            email: Email tài khoản
            password: Password
            proxy: Proxy string (tùy chọn, nếu None sẽ tự động gán)
            auto_create_profile: Tự động tạo profile nếu chưa có
            auto_assign_proxy: Tự động gán proxy nếu chưa có
            notes: Ghi chú
        
        Returns:
            dict: {
                'success': bool,
                'account_id': int,
                'profile_id': str,
                'profile_name': str,
                'proxy': dict,
                'message': str
            }
        """
        try:
            # Kiểm tra tài khoản đã tồn tại chưa
            existing = self.db.get_account_by_email(email)
            if existing:
                return {
                    'success': False,
                    'error': 'Email already exists'
                }
            
            profile_id = None
            profile_name = None
            proxy_info = None
            proxy_id = None
            proxy_for_gpm = None  # Proxy đã format cho GPMLogin
            
            # Xử lý proxy
            if proxy:
                # Proxy được cung cấp thủ công
                print(f"[AccountManager] Sử dụng proxy thủ công: {proxy}")
                # Parse proxy để lưu vào DB
                proxy_dict = self.proxy_manager.parse_proxy(proxy)
                if proxy_dict:
                    proxy_info = proxy_dict.get('raw')
                    # Format cho GPMLogin
                    proxy_for_gpm = self.proxy_manager.format_proxy_for_gpmlogin(proxy_dict)
                    try:
                        proxy_id = self.db.add_proxy(proxy_dict)
                        print(f"[AccountManager] Proxy ID trong DB: {proxy_id}")
                    except Exception as e:
                        print(f"[AccountManager] Lỗi lưu proxy vào DB: {e}")
                        proxy_id = None
                else:
                    proxy_info = proxy
                    proxy_for_gpm = proxy  # Sử dụng trực tiếp nếu không parse được
                    proxy_id = None
            elif auto_assign_proxy:
                # Tự động gán proxy nếu chưa có
                print(f"[AccountManager] Tự động gán proxy cho: {email}")
                proxy_dict = self.proxy_manager.get_unused_proxy()
                if proxy_dict:
                    proxy_for_gpm = self.proxy_manager.format_proxy_for_gpmlogin(proxy_dict)
                    proxy_info = proxy_dict.get('raw')
                    print(f"[AccountManager] ✓ Đã chọn proxy: {proxy_info}")
                    print(f"[AccountManager] Proxy formatted cho GPMLogin: {proxy_for_gpm}")
                    # Lưu proxy vào database nếu chưa có
                    try:
                        proxy_id = self.db.add_proxy(proxy_dict)
                        print(f"[AccountManager] Proxy ID trong DB: {proxy_id}")
                    except Exception as e:
                        print(f"[AccountManager] Lỗi lưu proxy vào DB: {e}")
                        proxy_id = None
                else:
                    print(f"[AccountManager] ⚠ Không có proxy nào trong thư viện")
                    proxy_for_gpm = None
                    proxy_info = None
                    proxy_id = None
            
            # Tự động tạo profile nếu chưa có
            if auto_create_profile:
                print(f"[AccountManager] Bắt đầu tạo profile cho: {email}")
                print(f"[AccountManager] Proxy để gán vào profile: {proxy_for_gpm if proxy_for_gpm else 'None (không có proxy)'}")
                
                # Đảm bảo proxy được truyền vào
                if not proxy_for_gpm:
                    print(f"[AccountManager] ⚠ Cảnh báo: Tạo profile không có proxy")
                
                # Lấy password từ tham số để truyền vào create_profile_for_email
                # (password đã được truyền vào hàm add_account_with_auto_profile)
                result = self.gpm_manager.create_profile_for_email(
                    email=email,
                    password=password,  # Password được lưu nhưng không dùng để đăng nhập tự động
                    proxy=proxy_for_gpm,  # Sử dụng proxy đã format cho GPMLogin
                    auto_login=False,  # Không tự động đăng nhập, để người dùng tự đăng nhập thủ công
                    human_like=True  # Sử dụng hành vi giống người (nếu có đăng nhập sau này)
                )
                
                print(f"[AccountManager] Kết quả tạo profile: {result}")
                
                if result and result.get('success') and result.get('data'):
                    profile_data = result.get('data')
                    # Đảm bảo profile_data là dict
                    if isinstance(profile_data, dict):
                        profile_id = profile_data.get('id')
                        profile_name = profile_data.get('name', f"Gmail_{email.split('@')[0]}")
                        print(f"[AccountManager] ✓ Đã tạo profile: ID={profile_id}, Name={profile_name}")
                        
                        # Lưu cookies nếu đăng nhập thành công
                        if result.get('login_success') and result.get('cookies'):
                            cookies_data = result.get('cookies')
                            print(f"[AccountManager] ✓ Đã nhận cookies từ đăng nhập tự động")
                            # Cookies sẽ được lưu sau khi tạo account
                    else:
                        print(f"[AccountManager] ✗ Invalid profile data format: {type(profile_data)}")
                        return {
                            'success': False,
                            'error': f'Invalid profile data format: {type(profile_data)}'
                        }
                    
                    # Đánh dấu proxy đã sử dụng nếu có
                    if proxy_id:
                        self.db.mark_proxy_as_used(proxy_id, None)  # account_id sẽ update sau
                else:
                    error_msg = result.get('error', 'Failed to create GPMLogin profile') if result else 'No result returned'
                    print(f"[AccountManager] ✗ Lỗi tạo profile: {error_msg}")
                    return {
                        'success': False,
                        'error': f'Failed to create GPMLogin profile: {error_msg}'
                    }
            else:
                print(f"[AccountManager] Bỏ qua tạo profile (auto_create_profile=False)")
            
            # Lấy cookies từ result nếu có
            cookies_data = None
            if result and result.get('login_success') and result.get('cookies'):
                cookies_data = result.get('cookies')
            
            # Thêm tài khoản vào database
            account_id = self.db.add_account(
                email=email,
                password=password,
                gpmlogin_profile_id=profile_id,
                gpmlogin_profile_name=profile_name,
                proxy_id=proxy_id,
                proxy_info=proxy_info,
                notes=notes,
                proxy_api_url=proxy_api_url,
                auto_change_proxy=auto_change_proxy
            )
            
            if account_id:
                # Lưu cookies nếu có
                if cookies_data:
                    self.db.update_account(account_id, cookies=cookies_data)
                    print(f"[AccountManager] ✓ Đã lưu cookies vào database")
                
                # Cập nhật proxy với account_id
                if proxy_id:
                    self.db.mark_proxy_as_used(proxy_id, account_id)
                
                return {
                    'success': True,
                    'account_id': account_id,
                    'profile_id': profile_id,
                    'profile_name': profile_name,
                    'proxy': proxy_info,
                    'message': 'Account added successfully with auto-created profile'
                }
            else:
                return {
                    'success': False,
                    'error': 'Failed to add account to database'
                }
                
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }
    
    def add_proxy_to_account(self, account_id, proxy_string):
        """Thêm proxy cho tài khoản đã có"""
        try:
            account = self.db.get_account_by_id(account_id)
            if not account:
                return {'success': False, 'error': 'Account not found'}
            
            # Parse proxy
            proxy_dict = self.proxy_manager.parse_proxy(proxy_string)
            if not proxy_dict:
                return {'success': False, 'error': 'Invalid proxy format'}
            
            # Format cho GPMLogin
            proxy_formatted = self.proxy_manager.format_proxy_for_gpmlogin(proxy_dict)
            
            # Cập nhật profile với proxy mới (nếu có profile)
            if account.get('gpmlogin_profile_id'):
                # Có thể cần update profile qua API
                pass
            
            # Lưu proxy vào database
            proxy_id = self.db.add_proxy(proxy_dict)
            
            # Cập nhật account
            self.db.update_account(
                account_id=account_id,
                proxy_id=proxy_id,
                proxy_info=proxy_dict.get('raw')
            )
            
            if proxy_id:
                self.db.mark_proxy_as_used(proxy_id, account_id)
            
            return {
                'success': True,
                'message': 'Proxy added to account',
                'proxy_id': proxy_id
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

