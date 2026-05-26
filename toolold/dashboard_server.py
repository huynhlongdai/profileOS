from flask import Flask, render_template, jsonify, request
from flask_cors import CORS
from database import Database
from gmail_monitor import GmailMonitor
from gpmlogin_manager import GPMLoginManager
from proxy_manager import ProxyManager
from account_manager import AccountManager
import threading
import time
from datetime import datetime

app = Flask(__name__)
CORS(app)

# Quản lý các task đang chạy để có thể dừng
running_tasks = {}  # {task_id: {'event': threading.Event, 'type': 'care'|'check', 'account_ids': [...]}}
task_counter = 0
task_lock = threading.Lock()

# Khởi tạo với error handling
try:
    print("[Init] Dang khoi tao Database...")
    db = Database()
    print("[Init] OK Database da khoi tao")
    
    print("[Init] Dang khoi tao GmailMonitor...")
    monitor = GmailMonitor()
    print("[Init] OK GmailMonitor da khoi tao")
    
    print("[Init] Dang khoi tao GPMLoginManager...")
    gpm_manager = GPMLoginManager()
    print("[Init] OK GPMLoginManager da khoi tao")
    
    print("[Init] Dang khoi tao ProxyManager...")
    proxy_manager = ProxyManager()
    print("[Init] OK ProxyManager da khoi tao")
    
    print("[Init] Dang khoi tao AccountManager...")
    account_manager = AccountManager()
    print("[Init] OK AccountManager da khoi tao")
    
    print("[Init] ========== TAT CA MODULES DA KHOI TAO THANH CONG ==========")
except Exception as e:
    print(f"[Init] LOI KHOI TAO: {e}")
    import traceback
    traceback.print_exc()
    raise

@app.route('/')
def index():
    """Trang chủ dashboard"""
    return render_template('dashboard.html')

@app.route('/api/accounts', methods=['GET'])
def get_accounts():
    """Lấy danh sách tất cả tài khoản"""
    try:
        accounts = db.get_all_accounts()
        return jsonify({
            'success': True,
            'accounts': accounts,
            'count': len(accounts)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts', methods=['POST'])
def add_account():
    """Thêm tài khoản mới với tự động tạo profile và gán proxy"""
    try:
        data = request.json
        email = data.get('email')
        password = data.get('password')
        profile_id = data.get('gpmlogin_profile_id')
        profile_name = data.get('gpmlogin_profile_name')
        proxy = data.get('proxy')  # Proxy string
        auto_create_profile = data.get('auto_create_profile', True)
        auto_assign_proxy = data.get('auto_assign_proxy', True)
        notes = data.get('notes', '')
        proxy_api_url = data.get('proxy_api_url', '')  # URL của proxy API server
        auto_change_proxy = data.get('auto_change_proxy', False)  # Tự động change proxy khi mở
        
        if not email:
            return jsonify({
                'success': False,
                'error': 'Email is required'
            }), 400
        
        # Sử dụng AccountManager để tự động tạo profile và gán proxy
        if auto_create_profile or auto_assign_proxy:
            result = account_manager.add_account_with_auto_profile(
                email=email,
                password=password,
                proxy=proxy,
                auto_create_profile=auto_create_profile,
                auto_assign_proxy=auto_assign_proxy,
                notes=notes,
                proxy_api_url=proxy_api_url,
                auto_change_proxy=auto_change_proxy
            )
            return jsonify(result)
        else:
            # Thêm tài khoản thủ công (không tự động)
            account_id = db.add_account(
                email=email,
                password=password,
                gpmlogin_profile_id=profile_id,
                gpmlogin_profile_name=profile_name,
                notes=notes
            )
            
            if account_id:
                return jsonify({
                    'success': True,
                    'message': 'Account added successfully',
                    'account_id': account_id
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Email already exists'
                }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/<int:account_id>', methods=['DELETE'])
def delete_account(account_id):
    """Xóa tài khoản (giữ profile trong thùng rác)"""
    try:
        # Lấy thông tin tài khoản trước khi xóa
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        # Xóa tài khoản nhưng giữ profile
        if db.delete_account(account_id, keep_profile=True):
            return jsonify({
                'success': True,
                'message': 'Account deleted successfully. Profile moved to trash.',
                'profile_id': account.get('gpmlogin_profile_id')
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to delete account'
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/<int:account_id>/check', methods=['POST'])
def check_account(account_id):
    """Kiểm tra một tài khoản"""
    try:
        print("=" * 80)
        print(f"[CheckAPI] ========== BẮT ĐẦU KIỂM TRA TÀI KHOẢN ==========")
        print(f"[CheckAPI] Account ID: {account_id}")
        
        account = db.get_account_by_id(account_id)
        if not account:
            print(f"[CheckAPI] ✗ Không tìm thấy tài khoản với ID: {account_id}")
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        email = account.get('email')
        profile_id = account.get('gpmlogin_profile_id')
        print(f"[CheckAPI] Email: {email}")
        print(f"[CheckAPI] Profile ID: {profile_id}")
        
        if not profile_id:
            print(f"[CheckAPI] ⚠ Tài khoản {email} chưa có GPMLogin profile_id")
            db.add_log(account_id, "check_error", "Chưa có GPMLogin profile_id")
            return jsonify({
                'success': False,
                'error': 'Account does not have GPMLogin profile_id'
            }), 400
        
        def run_check():
            try:
                print(f"[CheckAPI] Bắt đầu kiểm tra trong background thread...")
                monitor.check_account(account)
                print(f"[CheckAPI] ========== KẾT THÚC KIỂM TRA TÀI KHOẢN ==========")
            except Exception as e:
                print(f"[CheckAPI] ✗✗✗ EXCEPTION trong run_check: {e} ✗✗✗")
                import traceback
                traceback.print_exc()
                db.add_log(account_id, "check_error", f"Exception: {str(e)}")
        
        threading.Thread(target=run_check, daemon=True).start()
        
        print(f"[CheckAPI] ✓ Đã khởi động thread kiểm tra")
        print("=" * 80)
        
        return jsonify({
            'success': True,
            'message': 'Check started'
        })
    except Exception as e:
        print(f"[CheckAPI] ✗✗✗ EXCEPTION trong check_account endpoint: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/check-all', methods=['POST'])
def check_all_accounts():
    """Kiểm tra tất cả tài khoản với số luồng giới hạn"""
    try:
        data = request.json or {}
        max_threads = data.get('max_threads', 3)
        max_threads = min(max(1, max_threads), 10)  # Giới hạn 1-10
        
        print(f"[CheckAllAPI] Bắt đầu kiểm tra tất cả với {max_threads} luồng")
        
        def run_check():
            from concurrent.futures import ThreadPoolExecutor
            accounts = db.get_all_accounts()
            
            print(f"[CheckAllAPI] Tổng số tài khoản: {len(accounts)}")
            
            with ThreadPoolExecutor(max_workers=max_threads) as executor:
                futures = []
                for account in accounts:
                    future = executor.submit(monitor.check_account, account)
                    futures.append(future)
                
                # Đợi tất cả hoàn thành
                for future in futures:
                    try:
                        future.result()
                    except Exception as e:
                        print(f"[CheckAllAPI] Lỗi trong thread: {e}")
            
            print(f"[CheckAllAPI] Hoàn tất kiểm tra tất cả tài khoản")
        
        threading.Thread(target=run_check, daemon=True).start()
        
        return jsonify({
            'success': True,
            'message': f'Check all started with {max_threads} threads'
        })
    except Exception as e:
        print(f"[CheckAllAPI] ✗✗✗ EXCEPTION: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/care-selected', methods=['POST'])
def care_selected_accounts():
    """Chăm sóc các tài khoản đã chọn với số luồng giới hạn"""
    try:
        data = request.json or {}
        account_ids = data.get('account_ids', [])
        max_threads = data.get('max_threads', 3)
        max_threads = min(max(1, max_threads), 10)  # Giới hạn 1-10
        
        if not account_ids:
            return jsonify({
                'success': False,
                'error': 'No accounts selected'
            }), 400
        
        # Tạo task ID và event để có thể dừng
        with task_lock:
            global task_counter
            task_counter += 1
            task_id = f"care_{task_counter}"
            stop_event = threading.Event()
            running_tasks[task_id] = {
                'event': stop_event,
                'type': 'care',
                'account_ids': account_ids
            }
        
        print(f"[CareSelectedAPI] Bắt đầu chăm sóc {len(account_ids)} tài khoản với {max_threads} luồng (Task ID: {task_id})")
        
        def run_care():
            from concurrent.futures import ThreadPoolExecutor
            
            accounts = []
            for account_id in account_ids:
                if stop_event.is_set():
                    print(f"[CareSelectedAPI] Task {task_id} đã bị dừng")
                    break
                account = db.get_account_by_id(account_id)
                if account:
                    accounts.append(account)
            
            if stop_event.is_set():
                with task_lock:
                    if task_id in running_tasks:
                        del running_tasks[task_id]
                return
            
            print(f"[CareSelectedAPI] Tổng số tài khoản hợp lệ: {len(accounts)}")
            
            with ThreadPoolExecutor(max_workers=max_threads) as executor:
                futures = []
                for account in accounts:
                    if stop_event.is_set():
                        break
                    future = executor.submit(care_account_internal, account['id'], stop_event)
                    futures.append(future)
                
                # Đợi tất cả hoàn thành hoặc bị dừng
                for future in futures:
                    if stop_event.is_set():
                        print(f"[CareSelectedAPI] Dừng các task đang chạy...")
                        break
                    try:
                        future.result(timeout=1)
                    except Exception as e:
                        if not stop_event.is_set():
                            print(f"[CareSelectedAPI] Lỗi trong thread: {e}")
            
            # Xóa task khỏi running_tasks
            with task_lock:
                if task_id in running_tasks:
                    del running_tasks[task_id]
            
            if stop_event.is_set():
                print(f"[CareSelectedAPI] Task {task_id} đã bị dừng")
            else:
                print(f"[CareSelectedAPI] Hoàn tất chăm sóc tất cả tài khoản đã chọn")
        
        threading.Thread(target=run_care, daemon=True).start()
        
        return jsonify({
            'success': True,
            'message': f'Care started for {len(account_ids)} accounts with {max_threads} threads',
            'task_id': task_id
        })
    except Exception as e:
        print(f"[CareSelectedAPI] ✗✗✗ EXCEPTION: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

def care_account_internal(account_id, stop_event=None):
    """Hàm nội bộ để chăm sóc một tài khoản (dùng cho ThreadPoolExecutor)"""
    from gmail_care import GmailCare
    care = GmailCare()
    
    account = db.get_account_by_id(account_id)
    if not account:
        return
    
    profile_id = account.get('gpmlogin_profile_id')
    if not profile_id:
        return
    
    email = account['email']
    password = account.get('password')
    driver = None
    
    try:
        # Kiểm tra nếu task đã bị dừng
        if stop_event and stop_event.is_set():
            print(f"[CareSelectedAPI] Task đã bị dừng, bỏ qua account {account_id}")
            return
        
        # Truyền account_data để inject cookies nếu có
        driver = gpm_manager.connect_to_profile(profile_id, account_data=account)
        if not driver:
            print(f"[CareSelectedAPI] ✗ Không thể kết nối đến profile {profile_id}")
            return
        
        # Kiểm tra nếu task đã bị dừng
        if stop_event and stop_event.is_set():
            return
        
        # Kiểm tra trạng thái đăng nhập
        gmail_status = gpm_manager.check_gmail_status(driver, email)
        
        if gmail_status == "logged_out":
            if password:
                login_result = gpm_manager.login_gmail(driver, email, password, human_like=True)
                # Xử lý cookies nếu có
                if isinstance(login_result, dict):
                    if login_result.get("needs_2fa"):
                        print(f"[CareSelectedAPI] ⚠ Cần 2FA cho {email}, bỏ qua")
                        return
                    elif login_result.get("success") and login_result.get("cookies"):
                        # Lưu cookies
                        db.update_account(account_id, cookies=login_result.get("cookies"))
                        db.update_last_login(email)
                        print(f"[CareSelectedAPI] ✓ Đã lưu cookies cho {email}")
                elif login_result == True:
                    db.update_last_login(email)
                else:
                    print(f"[CareSelectedAPI] ✗ Đăng nhập thất bại cho {email}")
                    return
            else:
                print(f"[CareSelectedAPI] ⚠ Không có password cho {email}")
                return
        elif gmail_status != "logged_in":
            print(f"[CareSelectedAPI] ⚠ Trạng thái không hợp lệ: {gmail_status} cho {email}")
            return
        
        # Kiểm tra nếu task đã bị dừng
        if stop_event and stop_event.is_set():
            return
        
        # Thực hiện chăm sóc
        result = care.perform_daily_care(driver, email)
        
        if result['success']:
            db.update_last_care(email)
            # Lưu cookies nếu có
            if result.get('cookies'):
                db.update_account(account_id, cookies=result.get('cookies'))
                print(f"[CareSelectedAPI] ✓ Đã cập nhật cookies sau khi chăm sóc")
            db.add_care_history(account_id, result['actions'], True)
            print(f"[CareSelectedAPI] ✓ Chăm sóc thành công: {email}")
        else:
            db.add_care_history(account_id, result.get('actions', []), False, result.get('error'))
            print(f"[CareSelectedAPI] ✗ Chăm sóc thất bại: {email} - {result.get('error')}")
            
    except Exception as e:
        print(f"[CareSelectedAPI] ✗✗✗ EXCEPTION chăm sóc account {account_id}: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
    finally:
        # LUÔN đóng driver và profile trong finally block
        print(f"[CareSelectedAPI] Đang đóng driver và profile cho account {account_id}...")
        try:
            if driver:
                driver.quit()
                print(f"[CareSelectedAPI] ✓ Đã đóng driver")
        except Exception as e:
            print(f"[CareSelectedAPI] ⚠ Lỗi đóng driver: {e}")
        
        try:
            gpm_manager.stop_profile(profile_id)
            print(f"[CareSelectedAPI] ✓ Đã đóng profile {profile_id}")
        except Exception as e:
            print(f"[CareSelectedAPI] ⚠ Lỗi đóng profile: {e}")

@app.route('/api/accounts/<int:account_id>/care', methods=['POST'])
def care_account(account_id):
    """Chăm sóc một tài khoản"""
    try:
        from gmail_care import GmailCare
        care = GmailCare()
        
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        profile_id = account.get('gpmlogin_profile_id')
        if not profile_id:
            return jsonify({
                'success': False,
                'error': 'No GPMLogin profile ID'
            }), 400
        
        def run_care():
            print(f"[CareAPI] ========== BẮT ĐẦU CHĂM SÓC TÀI KHOẢN ==========")
            print(f"[CareAPI] Account ID: {account_id}")
            print(f"[CareAPI] Email: {account['email']}")
            print(f"[CareAPI] Profile ID: {profile_id}")
            
            driver = None
            
            try:
                # Truyền account_data để inject cookies nếu có
                driver = gpm_manager.connect_to_profile(profile_id, account_data=account)
                if not driver:
                    print(f"[CareAPI] ✗ Không thể kết nối đến profile")
                    db.add_log(account_id, "care_error", "Không thể kết nối đến browser")
                    return
                
                print(f"[CareAPI] ✓ Đã kết nối đến browser")
                
                # Kiểm tra và đăng nhập nếu cần
                email = account['email']
                password = account.get('password')
                
                # Kiểm tra trạng thái đăng nhập
                print(f"[CareAPI] Kiểm tra trạng thái đăng nhập...")
                gmail_status = gpm_manager.check_gmail_status(driver, email)
                print(f"[CareAPI] Trạng thái: {gmail_status}")
                
                if gmail_status == "logged_out":
                    # Tự động đăng nhập nếu có password
                    if password:
                        print(f"[CareAPI] → Đang đăng nhập {email}...")
                        login_result = gpm_manager.login_gmail(driver, email, password, human_like=True)
                        
                        # Xử lý kết quả login (có thể là bool hoặc dict nếu cần 2FA)
                        if isinstance(login_result, dict) and login_result.get("needs_2fa"):
                            print(f"[CareAPI] ⚠ Phát hiện yêu cầu 2FA/challenge, bỏ qua chăm sóc lần này")
                            db.add_log(account_id, "care_skipped", "Bỏ qua chăm sóc: cần xác thực 2FA")
                            return
                        elif login_result == True:
                            db.update_last_login(email)
                            db.add_log(account_id, "auto_login", "Đăng nhập tự động trước khi chăm sóc")
                            print(f"[CareAPI] ✓ Đăng nhập thành công: {email}")
                        else:
                            db.add_log(account_id, "auto_login_failed", "Không thể đăng nhập tự động")
                            print(f"[CareAPI] ✗ Không thể đăng nhập: {email}")
                            return
                    else:
                        db.add_log(account_id, "care_skipped", "Bỏ qua chăm sóc: chưa đăng nhập và không có password")
                        print(f"[CareAPI] ⚠ Bỏ qua chăm sóc {email}: chưa đăng nhập")
                        return
                elif gmail_status == "logged_in":
                    print(f"[CareAPI] ✓ {email} đã đăng nhập, bắt đầu chăm sóc...")
                else:
                    print(f"[CareAPI] ⚠ Trạng thái không xác định: {gmail_status}")
                    # Vẫn thử chăm sóc nếu có thể
                
                # Thực hiện chăm sóc
                print(f"[CareAPI] Bắt đầu thực hiện chăm sóc...")
                result = care.perform_daily_care(driver, email)
                
                print(f"[CareAPI] Kết quả chăm sóc: success={result.get('success')}, actions={result.get('actions')}")
                
                if result['success']:
                    db.update_last_care(email)
                    db.add_care_history(
                        account_id,
                        result['actions'],
                        True
                    )
                    actions_str = ', '.join(result['actions']) if result['actions'] else 'Không có hành động'
                    db.add_log(account_id, "care_success", f"Chăm sóc: {actions_str}")
                    print(f"[CareAPI] ✓✓✓ CHĂM SÓC THÀNH CÔNG: {actions_str} ✓✓✓")
                else:
                    error_msg = result.get('error', 'Unknown error')
                    db.add_care_history(
                        account_id,
                        result.get('actions', []),
                        False,
                        error_msg
                    )
                    db.add_log(account_id, "care_error", f"Lỗi chăm sóc: {error_msg}")
                    print(f"[CareAPI] ✗✗✗ LỖI CHĂM SÓC: {error_msg} ✗✗✗")
                
                print(f"[CareAPI] ========== KẾT THÚC CHĂM SÓC TÀI KHOẢN ==========")
                
            except Exception as e:
                print(f"[CareAPI] ✗✗✗ EXCEPTION trong run_care: {e} ✗✗✗")
                import traceback
                traceback.print_exc()
                db.add_log(account_id, "care_error", f"Exception: {str(e)}")
            finally:
                # LUÔN đóng driver và profile trong finally block
                print(f"[CareAPI] Đang đóng driver và profile...")
                try:
                    if driver:
                        driver.quit()
                        print(f"[CareAPI] ✓ Đã đóng driver")
                except Exception as e:
                    print(f"[CareAPI] ⚠ Lỗi đóng driver: {e}")
                
                try:
                    gpm_manager.stop_profile(profile_id)
                    print(f"[CareAPI] ✓ Đã đóng profile {profile_id}")
                except Exception as e:
                    print(f"[CareAPI] ⚠ Lỗi đóng profile: {e}")
        
        threading.Thread(target=run_care, daemon=True).start()
        
        return jsonify({
            'success': True,
            'message': 'Care started'
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/logs/<int:account_id>', methods=['GET'])
def get_logs(account_id):
    """Lấy logs của một tài khoản"""
    try:
        limit = request.args.get('limit', 100, type=int)
        logs = db.get_logs(account_id, limit)
        return jsonify({
            'success': True,
            'logs': logs
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/stats', methods=['GET'])
def get_stats():
    """Lấy thống kê"""
    try:
        stats = monitor.get_statistics()
        return jsonify({
            'success': True,
            'stats': stats
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles', methods=['GET'])
def get_gpmlogin_profiles():
    """Lấy danh sách GPMLogin profiles"""
    try:
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 100, type=int)
        search = request.args.get('search', None)
        
        profiles = gpm_manager.get_profiles(page=page, per_page=per_page, search=search)
        
        # Đồng bộ proxy từ GPMLogin về database nếu có sự khác biệt
        try:
            accounts = db.get_all_accounts()
            accounts_by_profile_id = {acc.get('gpmlogin_profile_id'): acc for acc in accounts if acc.get('gpmlogin_profile_id')}
            
            from proxy_manager import ProxyManager
            proxy_manager = ProxyManager()
            
            for profile in profiles:
                profile_id = profile.get('id')
                if not profile_id:
                    continue
                    
                account = accounts_by_profile_id.get(profile_id)
                if not account:
                    continue
                
                # Extract proxy từ profile.raw_proxy (có thể có format "HTTP proxy| IP:Port")
                profile_raw_proxy = profile.get('raw_proxy', '').strip()
                if profile_raw_proxy:
                    # Extract phần sau dấu | nếu có
                    if '|' in profile_raw_proxy:
                        parts = profile_raw_proxy.split('|')
                        if len(parts) > 1:
                            extracted_proxy = parts[1].strip()
                            # Loại bỏ protocol
                            extracted_proxy = extracted_proxy.replace('socks5://', '').replace('http://', '').replace('https://', '')
                            profile_raw_proxy = extracted_proxy
                
                account_proxy_info = account.get('proxy_info', '').strip() if account.get('proxy_info') else ''
                
                # Nếu proxy khác nhau, cập nhật database với proxy từ GPMLogin
                # Chỉ đồng bộ nếu GPMLogin có proxy (không đồng bộ nếu GPMLogin không có proxy nhưng DB có)
                if profile_raw_proxy:
                    if profile_raw_proxy != account_proxy_info:
                        print(f"[SyncProxy] Phát hiện proxy khác nhau cho profile {profile_id}: GPMLogin={profile_raw_proxy}, DB={account_proxy_info}")
                        print(f"[SyncProxy] Đang đồng bộ proxy từ GPMLogin về database...")
                        
                        # Parse và cập nhật proxy
                        proxy_dict = proxy_manager.parse_proxy(profile_raw_proxy)
                        proxy_id = None
                        if proxy_dict:
                            proxy_id = db.add_proxy(proxy_dict, None)
                            if proxy_id == 0 or proxy_id is None:
                                existing_proxy = db.get_proxy_by_raw(proxy_dict.get('raw'))
                                if existing_proxy:
                                    proxy_id = existing_proxy.get('id')
                        
                        db.update_account(
                            account_id=account.get('id'),
                            proxy_id=proxy_id,
                            proxy_info=profile_raw_proxy
                        )
                        print(f"[SyncProxy] ✓ Đã đồng bộ proxy cho account {account.get('id')}: {profile_raw_proxy}")
                elif account_proxy_info:
                    # Nếu GPMLogin không có proxy nhưng DB có, có thể proxy đã bị xóa trên GPMLogin
                    # Không tự động xóa, chỉ log để user biết
                    print(f"[SyncProxy] ⚠ Profile {profile_id} không có proxy trên GPMLogin nhưng DB có: {account_proxy_info}")
        except Exception as e:
            print(f"[SyncProxy] Cảnh báo: Lỗi đồng bộ proxy: {e}")
        
        return jsonify({
            'success': True,
            'profiles': profiles,
            'count': len(profiles),
            'synced': True  # Đánh dấu đã đồng bộ
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/sync-proxy', methods=['POST'])
def sync_proxy_from_gpmlogin():
    """Đồng bộ proxy từ GPMLogin về database cho tất cả profiles"""
    try:
        from proxy_manager import ProxyManager
        proxy_manager = ProxyManager()
        
        # Lấy tất cả profiles từ GPMLogin
        profiles = gpm_manager.get_profiles(page=1, per_page=1000)
        
        # Lấy tất cả accounts
        accounts = db.get_all_accounts()
        accounts_by_profile_id = {acc.get('gpmlogin_profile_id'): acc for acc in accounts if acc.get('gpmlogin_profile_id')}
        
        synced_count = 0
        for profile in profiles:
            profile_id = profile.get('id')
            if not profile_id:
                continue
                
            account = accounts_by_profile_id.get(profile_id)
            if not account:
                continue
            
            # Extract proxy từ profile.raw_proxy
            profile_raw_proxy = profile.get('raw_proxy', '').strip()
            if profile_raw_proxy:
                # Extract phần sau dấu | nếu có
                if '|' in profile_raw_proxy:
                    parts = profile_raw_proxy.split('|')
                    if len(parts) > 1:
                        extracted_proxy = parts[1].strip()
                        extracted_proxy = extracted_proxy.replace('socks5://', '').replace('http://', '').replace('https://', '')
                        profile_raw_proxy = extracted_proxy
            
            account_proxy_info = account.get('proxy_info', '').strip() if account.get('proxy_info') else ''
            
            # Nếu proxy khác nhau, cập nhật database
            if profile_raw_proxy and profile_raw_proxy != account_proxy_info:
                proxy_dict = proxy_manager.parse_proxy(profile_raw_proxy)
                proxy_id = None
                if proxy_dict:
                    proxy_id = db.add_proxy(proxy_dict, None)
                    if proxy_id == 0 or proxy_id is None:
                        existing_proxy = db.get_proxy_by_raw(proxy_dict.get('raw'))
                        if existing_proxy:
                            proxy_id = existing_proxy.get('id')
                
                db.update_account(
                    account_id=account.get('id'),
                    proxy_id=proxy_id,
                    proxy_info=profile_raw_proxy
                )
                synced_count += 1
                print(f"[SyncProxy] ✓ Đã đồng bộ proxy cho account {account.get('id')}: {profile_raw_proxy}")
        
        return jsonify({
            'success': True,
            'message': f'Đã đồng bộ {synced_count} profiles',
            'synced_count': synced_count
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/login', methods=['POST'])
def manual_login_profile():
    """Đăng nhập thủ công cho một profile - chạy đồng bộ để đợi kết quả thực sự"""
    import sys
    import traceback
    import time  # Đảm bảo time có sẵn trong hàm
    
    print("=" * 80)
    print("[ManualLogin] ========== BẮT ĐẦU ĐĂNG NHẬP THỦ CÔNG ==========")
    print("=" * 80)
    
    try:
        print(f"[ManualLogin] Nhận request: {request.method} {request.path}")
        print(f"[ManualLogin] Request headers: {dict(request.headers)}")
        
        data = request.json
        print(f"[ManualLogin] Request data: {data}")
        
        if not data:
            print("[ManualLogin] ✗ Không có data trong request")
            return jsonify({
                'success': False,
                'error': 'No data in request'
            }), 400
        
        profile_id = data.get('profile_id')
        email = data.get('email')
        password = data.get('password')
        human_like = data.get('human_like', True)
        
        print(f"[ManualLogin] Profile ID: {profile_id}")
        print(f"[ManualLogin] Email: {email}")
        print(f"[ManualLogin] Password: {'*' * len(password) if password else 'None'}")
        print(f"[ManualLogin] Human like: {human_like}")
        
        if not profile_id or not email or not password:
            print("[ManualLogin] ✗ Thiếu thông tin bắt buộc")
            return jsonify({
                'success': False,
                'error': 'Missing required fields: profile_id, email, password'
            }), 400
        
        print(f"[ManualLogin] ✓ Đã validate input")
        print(f"[ManualLogin] Bắt đầu đăng nhập thủ công cho profile: {profile_id}, email: {email}")
        
        # Kiểm tra xem profile đã mở chưa
        if profile_id in gpm_manager.active_profiles:
            print(f"[ManualLogin] Profile đã mở, kiểm tra driver hiện tại...")
            # Không cần mở lại, chỉ cần kết nối
            driver = gpm_manager.active_profiles[profile_id].get("driver")
            if driver:
                try:
                    # Kiểm tra driver còn hoạt động không
                    test_url = driver.current_url
                    print(f"[ManualLogin] ✓ Driver đang hoạt động (URL: {test_url[:80]}), sử dụng driver hiện tại")
                    profile_info = {'remote_debugging_address': gpm_manager.active_profiles[profile_id].get('remote_address')}
                    # Bỏ qua bước kết nối, sử dụng driver hiện có
                    skip_connection = True
                except Exception as e:
                    # Driver không hoạt động, cần mở lại
                    print(f"[ManualLogin] Driver không hoạt động ({e}), đóng và mở lại profile...")
                    try:
                        gpm_manager.stop_profile(profile_id)
                        time.sleep(2)  # Đợi profile đóng hoàn toàn
                    except Exception as stop_error:
                        print(f"[ManualLogin] ⚠ Lỗi khi đóng profile: {stop_error}")
                    # Lấy account data để check proxy
                    account = db.get_account_by_email(email)
                    profile_info = gpm_manager.start_profile(profile_id, force_restart=True, account_data=account)
                    skip_connection = False
            else:
                print(f"[ManualLogin] Profile đã mở nhưng không có driver, mở lại profile...")
                try:
                    gpm_manager.stop_profile(profile_id)
                    time.sleep(2)
                except:
                    pass
                # Lấy account data để check proxy
                account = db.get_account_by_email(email)
                profile_info = gpm_manager.start_profile(profile_id, force_restart=True, account_data=account)
                skip_connection = False
        else:
            # Mở profile mới
            print(f"[ManualLogin] Profile chưa mở, mở profile mới...")
            # Lấy account data để check proxy
            account = db.get_account_by_email(email)
            profile_info = gpm_manager.start_profile(profile_id, account_data=account)
            skip_connection = False
        
        if not profile_info:
            print(f"[ManualLogin] ✗ Không thể mở profile")
            return jsonify({
                'success': False,
                'error': 'Failed to start profile. Profile may already be open or GPMLogin API error. Check console logs for details.'
            }), 500
        
        # Kiểm tra xem có phải lỗi proxy không (sau khi đã kiểm tra profile_info không None)
        if isinstance(profile_info, dict) and profile_info.get('proxy_error'):
            print(f"[ManualLogin] ✗ Lỗi proxy: {profile_info.get('error')}")
            return jsonify({
                'success': False,
                'error': profile_info.get('error', 'Proxy error'),
                'proxy_error': True,
                'proxy_status': profile_info.get('proxy_status', 'UNKNOWN')
            }), 500
        
        print(f"[ManualLogin] ✓ Profile đã được mở")
        
        # Kết nối đến browser (chỉ nếu chưa có driver)
        if not skip_connection:
            # Đợi browser khởi động
            import random
            wait_time = random.uniform(5.0, 8.0)
            print(f"[ManualLogin] Đợi browser khởi động ({wait_time:.1f} giây)...")
            time.sleep(wait_time)
            print(f"[ManualLogin] ✓ Đã đợi {wait_time:.1f} giây")
            
            # Lấy account data để truyền vào connect_to_profile (để inject cookies)
            account = db.get_account_by_email(email)
            
            # Kết nối đến browser
            driver = None
            max_retries = 3
            for attempt in range(max_retries):
                try:
                    print(f"[ManualLogin] Thử kết nối browser (lần {attempt + 1}/{max_retries})...")
                    driver = gpm_manager.connect_to_profile(profile_id, account_data=account)
                    if driver:
                        print(f"[ManualLogin] ✓ Kết nối thành công (lần thử {attempt + 1})")
                        break
                    else:
                        print(f"[ManualLogin] ⚠ Lần thử {attempt + 1} thất bại, đợi thêm 2 giây...")
                        time.sleep(2)
                except Exception as e:
                    print(f"[ManualLogin] ⚠ Lỗi kết nối lần {attempt + 1}: {e}")
                    if attempt < max_retries - 1:
                        time.sleep(2)
        else:
            # Sử dụng driver hiện có
            driver = gpm_manager.active_profiles[profile_id].get("driver")
            print(f"[ManualLogin] Sử dụng driver hiện có, bỏ qua bước kết nối")
        
        if not driver:
            print(f"[ManualLogin] ✗ Không thể kết nối đến browser sau {max_retries} lần thử")
            try:
                gpm_manager.stop_profile(profile_id)
            except:
                pass
            return jsonify({
                'success': False,
                'error': 'Failed to connect to browser after multiple attempts. Profile may not be ready. Please try again in a few seconds.'
            }), 500
        
        # Kiểm tra driver có hoạt động không
        try:
            test_url = driver.current_url
            print(f"[ManualLogin] ✓ Driver đang hoạt động, current URL: {test_url}")
        except Exception as e:
            print(f"[ManualLogin] ✗ Driver không hoạt động: {e}")
            try:
                gpm_manager.stop_profile(profile_id)
            except:
                pass
            return jsonify({
                'success': False,
                'error': f'Driver connection is invalid: {str(e)}. Please try again.'
            }), 500
        
        # Đăng nhập
        print(f"[ManualLogin] ========== BẮT ĐẦU ĐĂNG NHẬP GMAIL ==========")
        print(f"[ManualLogin] Driver: {driver}")
        print(f"[ManualLogin] Email: {email}")
        print(f"[ManualLogin] Human like: {human_like}")
        
        # Kiểm tra lại driver trước khi đăng nhập
        try:
            driver.current_url
        except Exception as e:
            print(f"[ManualLogin] ✗ Driver không còn hoạt động trước khi đăng nhập: {e}")
            try:
                gpm_manager.stop_profile(profile_id)
            except:
                pass
            return jsonify({
                'success': False,
                'error': f'Driver connection lost before login: {str(e)}. Please try again.'
            }), 500
        
        login_result = None
        try:
            login_result = gpm_manager.login_gmail(driver, email, password, human_like=human_like)
            print(f"[ManualLogin] Kết quả login_gmail: {login_result}")
            print(f"[ManualLogin] Kiểu dữ liệu của login_result: {type(login_result)}")
        except Exception as e:
            print(f"[ManualLogin] ✗ EXCEPTION trong login_gmail: {e}")
            import traceback
            traceback.print_exc()
            login_result = False
            # Kiểm tra lại driver sau exception
            try:
                driver.current_url
                print(f"[ManualLogin] Driver vẫn hoạt động sau exception")
            except Exception as driver_error:
                print(f"[ManualLogin] ✗ Driver không còn hoạt động sau exception: {driver_error}")
                # Không đóng profile ở đây, để người dùng có thể kiểm tra
        
        print(f"[ManualLogin] ========== KẾT THÚC ĐĂNG NHẬP GMAIL ==========")
        
        # Kiểm tra nếu cần xử lý 2FA hoặc cần xử lý thủ công
        needs_2fa = False
        needs_manual = False
        login_success = False
        
        if isinstance(login_result, dict) and login_result.get("needs_manual"):
            needs_manual = True
            print(f"[ManualLogin] ⚠ Cần xử lý thủ công: {login_result.get('reason', 'Unknown reason')}")
            # Giữ browser mở để người dùng xử lý thủ công
            return jsonify({
                'success': False,
                'needs_manual': True,
                'message': login_result.get('reason', 'Cần xử lý thủ công. Browser đang mở để bạn có thể tiếp tục.'),
                'browser_open': True
            }), 200  # Trả về 200 vì đây không phải lỗi nghiêm trọng
        
        if isinstance(login_result, dict) and login_result.get("needs_2fa"):
            needs_2fa = True
            print(f"[ManualLogin] ⚠ Phát hiện yêu cầu xác thực 2FA/challenge")
            print(f"[ManualLogin] URL challenge: {login_result.get('url')}")
            
            if MANUAL_LOGIN_WAIT_FOR_2FA:
                print(f"[ManualLogin] Đợi người dùng xử lý 2FA (tối đa {MANUAL_LOGIN_2FA_WAIT_SECONDS} giây)...")
                print(f"[ManualLogin] Browser sẽ được giữ mở để bạn xử lý thủ công")
                
                # Đợi và kiểm tra lại định kỳ
                import time
                from config import MANUAL_LOGIN_2FA_CHECK_INTERVAL
                
                elapsed_time = 0
                check_count = 0
                
                while elapsed_time < MANUAL_LOGIN_2FA_WAIT_SECONDS:
                    time.sleep(MANUAL_LOGIN_2FA_CHECK_INTERVAL)
                    elapsed_time += MANUAL_LOGIN_2FA_CHECK_INTERVAL
                    check_count += 1
                    
                    try:
                        # Kiểm tra URL hiện tại
                        current_url = driver.current_url
                        print(f"[ManualLogin] Kiểm tra lần {check_count}: URL = {current_url}")
                        
                        if "mail.google.com" in current_url:
                            print(f"[ManualLogin] ✓ Phát hiện đã đăng nhập thành công!")
                            login_success = True
                            break
                        elif "accounts.google.com" in current_url and "challenge" not in current_url:
                            # Có thể đã xử lý xong challenge, thử kiểm tra lại
                            print(f"[ManualLogin] Đang kiểm tra trạng thái đăng nhập...")
                            status = gpm_manager.check_gmail_status(driver, email)
                            if status == "logged_in":
                                print(f"[ManualLogin] ✓ Đã đăng nhập thành công!")
                                login_success = True
                                break
                    except Exception as e:
                        print(f"[ManualLogin] ⚠ Lỗi khi kiểm tra: {e}")
                        # Tiếp tục đợi
                    
                    remaining = MANUAL_LOGIN_2FA_WAIT_SECONDS - elapsed_time
                    if remaining > 0:
                        print(f"[ManualLogin] Còn {remaining} giây để xử lý 2FA...")
                
                if not login_success:
                    print(f"[ManualLogin] ⚠ Hết thời gian đợi, nhưng browser vẫn mở để bạn tiếp tục xử lý")
                    print(f"[ManualLogin] Browser sẽ KHÔNG tự động đóng")
                    return jsonify({
                        'success': False,
                        'needs_2fa': True,
                        'message': f'Đã phát hiện yêu cầu xác thực 2FA/challenge. Browser đang mở để bạn xử lý thủ công. Sau khi hoàn tất, vui lòng kiểm tra lại hoặc đóng browser thủ công.',
                        'browser_open': True
                    }), 200  # Trả về 200 vì đây không phải lỗi, chỉ là cần xử lý thủ công
                else:
                    # Đã xử lý xong 2FA và đăng nhập thành công
                    print(f"[ManualLogin] ✓ Đã xử lý xong 2FA và đăng nhập thành công!")
                    # Lưu cookies sau khi đăng nhập thành công
                    try:
                        cookies = driver.get_cookies()
                        import json
                        cookies_json = json.dumps(cookies)
                        # Tìm account_id từ email
                        account = db.get_account_by_email(email)
                        if account:
                            db.update_account(account['id'], cookies=cookies_json)
                            db.update_last_login(email)
                            print(f"[ManualLogin] ✓ Đã lưu cookies ({len(cookies)} cookies)")
                    except Exception as e:
                        print(f"[ManualLogin] ⚠ Lỗi lấy cookies: {e}")
        else:
            # Xử lý kết quả bình thường (không có 2FA)
            # login_result có thể là True, False, dict (với cookies), hoặc None
            if isinstance(login_result, dict):
                if login_result.get("needs_manual"):
                    needs_manual = True
                    print(f"[ManualLogin] ⚠ Cần xử lý thủ công: {login_result.get('reason', 'Unknown reason')}")
                    # Giữ browser mở để người dùng xử lý thủ công
                    return jsonify({
                        'success': False,
                        'needs_manual': True,
                        'message': login_result.get('reason', 'Cần xử lý thủ công. Browser đang mở để bạn có thể tiếp tục.'),
                        'browser_open': True
                    }), 200
                elif login_result.get("success"):
                    login_success = True
                    # Kiểm tra URL trong result
                    result_url = login_result.get("url", "")
                    if "myaccount.google.com" in result_url:
                        print(f"[ManualLogin] ✓ Đăng nhập thành công vào myaccount.google.com")
                    elif "mail.google.com" in result_url:
                        print(f"[ManualLogin] ✓ Đăng nhập thành công vào mail.google.com")
                    
                    # Lưu cookies nếu có
                    if login_result.get("cookies"):
                        account = db.get_account_by_email(email)
                        if account:
                            db.update_account(account['id'], cookies=login_result.get("cookies"))
                            db.update_last_login(email)
                            print(f"[ManualLogin] ✓ Đã lưu cookies từ login_result")
                elif login_result.get("wrong_password"):
                    # Mật khẩu sai - đóng profile ngay
                    print(f"[ManualLogin] ✗✗✗ MẬT KHẨU SAI: {email} ✗✗✗")
                    login_success = False
                    needs_2fa = False
                    
                    # Đóng browser và profile ngay lập tức
                    try:
                        if driver:
                            driver.quit()
                            print(f"[ManualLogin] ✓ Đã đóng browser")
                    except Exception as e:
                        print(f"[ManualLogin] ⚠ Lỗi đóng driver: {e}")
                    
                    try:
                        gpm_manager.stop_profile(profile_id)
                        print(f"[ManualLogin] ✓ Đã đóng profile")
                    except Exception as e:
                        print(f"[ManualLogin] ⚠ Lỗi đóng profile: {e}")
                    
                    # Cập nhật trạng thái trong database
                    account = db.get_account_by_email(email)
                    if account:
                        db.update_account_status(email, "wrong_password")
                        db.add_log(account['id'], "wrong_password", "Mật khẩu sai")
                    
                    return jsonify({
                        'success': False,
                        'wrong_password': True,
                        'error': 'Mật khẩu sai. Vui lòng kiểm tra lại.',
                        'message': 'Mật khẩu sai. Profile đã được đóng.'
                    }), 400
                elif login_result.get("needs_2fa") or login_result.get("verification_page"):
                    needs_2fa = True
                    login_success = False
                    print(f"[ManualLogin] ⚠ Phát hiện yêu cầu xác thực 2FA/verification")
                else:
                    login_success = login_result.get("success", False)
                    # Nếu đăng nhập thành công nhưng không có cookies trong result, lấy trực tiếp
                    if login_success:
                        try:
                            cookies = driver.get_cookies()
                            import json
                            cookies_json = json.dumps(cookies)
                            account = db.get_account_by_email(email)
                            if account:
                                db.update_account(account['id'], cookies=cookies_json)
                                db.update_last_login(email)
                                print(f"[ManualLogin] ✓ Đã lưu cookies ({len(cookies)} cookies)")
                        except Exception as e:
                            print(f"[ManualLogin] ⚠ Lỗi lấy cookies: {e}")
            elif login_result is True:
                login_success = True
                # Lưu cookies nếu có thể
                try:
                    cookies = driver.get_cookies()
                    import json
                    cookies_json = json.dumps(cookies)
                    account = db.get_account_by_email(email)
                    if account:
                        db.update_account(account['id'], cookies=cookies_json)
                        db.update_last_login(email)
                        print(f"[ManualLogin] ✓ Đã lưu cookies ({len(cookies)} cookies)")
                except Exception as e:
                    print(f"[ManualLogin] ⚠ Lỗi lấy cookies: {e}")
            elif login_result is False:
                login_success = False
            elif login_result is None:
                # Nếu None, coi như thất bại
                login_success = False
            else:
                # Nếu là kiểu khác (không nên xảy ra), coi như thất bại
                print(f"[ManualLogin] ⚠ login_result có kiểu không mong đợi: {type(login_result)}, giá trị: {login_result}")
                login_success = False
        
        # Xác minh lại trạng thái đăng nhập nếu login_result cho thấy thành công
        # Điều này đảm bảo rằng đăng nhập thực sự đã thành công
        if login_success and not needs_2fa:
            print(f"[ManualLogin] Xác minh lại trạng thái đăng nhập...")
            try:
                # Đợi một chút để đảm bảo trang đã load hoàn toàn
                time.sleep(2)
                
                # Kiểm tra URL hiện tại trước
                current_url = driver.current_url
                print(f"[ManualLogin] URL hiện tại: {current_url}")
                
                # Nếu URL là myaccount.google.com hoặc mail.google.com thì coi như đăng nhập thành công
                if "myaccount.google.com" in current_url:
                    print(f"[ManualLogin] ✓ Xác minh thành công: URL là myaccount.google.com - đã đăng nhập thành công")
                    should_close_browser = True
                elif "mail.google.com" in current_url:
                    # Kiểm tra trạng thái Gmail
                    gmail_status = gpm_manager.check_gmail_status(driver, email)
                    print(f"[ManualLogin] Trạng thái Gmail sau khi đăng nhập: {gmail_status}")
                    
                    if gmail_status == "logged_in":
                        print(f"[ManualLogin] ✓ Xác minh thành công: đã đăng nhập vào Gmail")
                        should_close_browser = True
                    else:
                        print(f"[ManualLogin] ⚠ Cảnh báo: ở mail.google.com nhưng check_gmail_status trả về: {gmail_status}")
                        print(f"[ManualLogin] Giữ browser mở để kiểm tra...")
                        should_close_browser = False
                        login_success = False
                elif "challenge" in current_url or "signin/challenge" in current_url or "/challenge" in current_url:
                    # Vẫn ở màn hình challenge
                    print(f"[ManualLogin] ⚠ Vẫn ở màn hình challenge, giữ browser mở")
                    should_close_browser = False
                    login_success = False
                    needs_2fa = True
                else:
                    # URL khác, kiểm tra xem có phải verification page không
                    try:
                        page_text = driver.page_source.lower()
                        if "verify it's you" in page_text or "choose how you want to sign in" in page_text:
                            print(f"[ManualLogin] ⚠ Phát hiện màn hình verification, giữ browser mở")
                            should_close_browser = False
                            login_success = False
                            needs_2fa = True
                        else:
                            print(f"[ManualLogin] ⚠ URL không xác định: {current_url}, giữ browser mở để kiểm tra")
                            should_close_browser = False
                            login_success = False
                    except:
                        print(f"[ManualLogin] ⚠ Không thể kiểm tra page source, giữ browser mở")
                        should_close_browser = False
                        login_success = False
            except Exception as e:
                print(f"[ManualLogin] ⚠ Lỗi khi xác minh trạng thái đăng nhập: {e}")
                # Nếu không thể xác minh, giữ browser mở để an toàn
                should_close_browser = False
        else:
            # Nếu không thành công hoặc cần 2FA, quyết định dựa trên logic cũ
            should_close_browser = not needs_2fa or (needs_2fa and login_success)
        
        print(f"[ManualLogin] Final login_success: {login_success}, needs_2fa: {needs_2fa}")
        print(f"[ManualLogin] should_close_browser: {should_close_browser}")
        
        if should_close_browser:
            # Kiểm tra driver trước khi đóng
            try:
                driver.current_url
                driver_valid = True
            except:
                driver_valid = False
                print(f"[ManualLogin] Driver không còn hoạt động, bỏ qua đóng driver")
            
            if driver_valid:
                try:
                    print(f"[ManualLogin] Đang đóng browser...")
                    driver.quit()
                    print(f"[ManualLogin] ✓ Đã đóng browser")
                except Exception as e:
                    print(f"[ManualLogin] ⚠ Lỗi đóng driver: {e}")
            
            # Đóng profile
            try:
                print(f"[ManualLogin] Đang đóng profile...")
                gpm_manager.stop_profile(profile_id)
                print(f"[ManualLogin] ✓ Đã đóng profile")
            except Exception as e:
                print(f"[ManualLogin] ⚠ Lỗi đóng profile: {e}")
        
        print("=" * 80)
        if login_success:
            print(f"[ManualLogin] ✓✓✓ ĐĂNG NHẬP THÀNH CÔNG: {email} ✓✓✓")
            print("=" * 80)
            return jsonify({
                'success': True,
                'message': 'Login successful'
            })
        else:
            if needs_2fa:
                # Đã xử lý ở trên, browser vẫn mở
                return jsonify({
                    'success': False,
                    'needs_2fa': True,
                    'message': 'Browser đang mở để xử lý 2FA. Vui lòng xử lý thủ công và kiểm tra lại sau.',
                    'browser_open': True
                }), 200
            else:
                print(f"[ManualLogin] ✗✗✗ ĐĂNG NHẬP THẤT BẠI: {email} ✗✗✗")
                print("=" * 80)
                
                # Kiểm tra xem browser có còn mở không để đưa ra thông báo phù hợp
                browser_still_open = False
                try:
                    if driver:
                        driver.current_url
                        browser_still_open = True
                except:
                    pass
                
                error_message = 'Đăng nhập thất bại. '
                if browser_still_open:
                    error_message += 'Browser vẫn đang mở, vui lòng kiểm tra thủ công. '
                error_message += 'Kiểm tra lại thông tin đăng nhập hoặc xem console để biết chi tiết lỗi.'
                
                return jsonify({
                    'success': False,
                    'error': error_message,
                    'browser_open': browser_still_open
                }), 500
        
    except Exception as e:
        print(f"[ManualLogin] ✗ Lỗi: {e}")
        import traceback
        traceback.print_exc()
        
        # Đảm bảo đóng profile nếu có lỗi
        try:
            profile_id = request.json.get('profile_id')
            if profile_id:
                gpm_manager.stop_profile(profile_id)
        except:
            pass
        
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/<profile_id>/start', methods=['POST'])
def start_gpmlogin_profile(profile_id):
    """Mở profile từ GPMLogin"""
    try:
        print(f"[StartProfileAPI] Bắt đầu mở profile: {profile_id}")
        
        # Tìm account có profile_id này để check proxy
        account = None
        try:
            accounts = db.get_all_accounts()
            for acc in accounts:
                if acc.get('gpmlogin_profile_id') == profile_id:
                    account = acc
                    break
        except:
            pass
        
        profile_info = gpm_manager.start_profile(profile_id, force_restart=False, account_data=account)
        
        if not profile_info:
            return jsonify({
                'success': False,
                'error': 'Failed to start profile'
            }), 500
        
        # Kiểm tra xem có phải lỗi proxy không (sau khi đã kiểm tra profile_info không None)
        if isinstance(profile_info, dict) and profile_info.get('proxy_error'):
            return jsonify({
                'success': False,
                'error': profile_info.get('error', 'Proxy error'),
                'proxy_error': True,
                'proxy_status': profile_info.get('proxy_status', 'UNKNOWN')
            }), 500
        
        return jsonify({
            'success': True,
            'message': 'Profile started successfully',
            'profile_info': profile_info
        })
    except Exception as e:
        print(f"[StartProfileAPI] ✗✗✗ EXCEPTION: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/<profile_id>/stop', methods=['POST'])
def stop_gpmlogin_profile(profile_id):
    """Đóng profile từ GPMLogin"""
    try:
        print(f"[StopProfileAPI] Bắt đầu đóng profile: {profile_id}")
        result = gpm_manager.stop_profile(profile_id)
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Profile stopped successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to stop profile'
            }), 500
    except Exception as e:
        print(f"[StopProfileAPI] ✗✗✗ EXCEPTION: {e} ✗✗✗")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/active', methods=['GET'])
def get_active_profiles():
    """Lấy danh sách các profile đang mở"""
    try:
        active_profile_ids = list(gpm_manager.active_profiles.keys())
        return jsonify({
            'success': True,
            'profile_ids': active_profile_ids,
            'count': len(active_profile_ids)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/<profile_id>', methods=['DELETE'])
def delete_gpmlogin_profile(profile_id):
    """Xóa profile từ GPMLogin (xóa vĩnh viễn)"""
    try:
        # Xóa từ GPMLogin
        result = gpm_manager.delete_profile(profile_id)
        
        if result.get('success'):
            # Đánh dấu đã xóa vĩnh viễn trong database
            db.permanently_delete_profile(profile_id)
            return jsonify({
                'success': True,
                'message': 'Profile deleted permanently from GPMLogin'
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to delete profile')
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/deleted-profiles', methods=['GET'])
def get_deleted_profiles():
    """Lấy danh sách profiles đã xóa (thùng rác)"""
    try:
        profiles = db.get_deleted_profiles()
        return jsonify({
            'success': True,
            'profiles': profiles,
            'count': len(profiles)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/deleted-profiles/<profile_id>/restore', methods=['POST'])
def restore_profile(profile_id):
    """Khôi phục profile từ thùng rác"""
    try:
        if db.restore_profile(profile_id):
            return jsonify({
                'success': True,
                'message': 'Profile restored from trash'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Profile not found in trash'
            }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/deleted-profiles/<profile_id>/permanent', methods=['DELETE'])
def permanently_delete_profile(profile_id):
    """Xóa vĩnh viễn profile từ thùng rác"""
    try:
        # Xóa từ GPMLogin
        result = gpm_manager.delete_profile(profile_id)
        
        if result.get('success'):
            # Đánh dấu đã xóa vĩnh viễn trong database
            db.permanently_delete_profile(profile_id)
            return jsonify({
                'success': True,
                'message': 'Profile permanently deleted'
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to delete profile from GPMLogin')
            }), 500
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tasks/stop/<task_id>', methods=['POST'])
def stop_task(task_id):
    """Dừng một task đang chạy"""
    try:
        with task_lock:
            if task_id in running_tasks:
                running_tasks[task_id]['event'].set()
                task_info = running_tasks[task_id]
                del running_tasks[task_id]
                return jsonify({
                    'success': True,
                    'message': f'Task {task_id} đã được dừng'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Task not found'
                }), 404
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/tasks/running', methods=['GET'])
def get_running_tasks():
    """Lấy danh sách các task đang chạy"""
    try:
        with task_lock:
            tasks = []
            for task_id, task_info in running_tasks.items():
                tasks.append({
                    'task_id': task_id,
                    'type': task_info['type'],
                    'account_ids': task_info['account_ids']
                })
            return jsonify({
                'success': True,
                'tasks': tasks
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/export', methods=['GET'])
def export_accounts():
    """Export tất cả tài khoản ra file JSON hoặc CSV"""
    try:
        accounts = db.get_all_accounts()
        format_type = request.args.get('format', 'json')
        
        if format_type == 'csv':
            import csv
            import io
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow(['ID', 'Email', 'Password', 'Profile ID', 'Profile Name', 'Proxy Info', 'Status', 'Last Check', 'Last Login', 'Last Care', 'Notes', '2FA Code'])
            
            # Data
            for account in accounts:
                writer.writerow([
                    account.get('id'),
                    account.get('email'),
                    account.get('password', ''),
                    account.get('gpmlogin_profile_id', ''),
                    account.get('gpmlogin_profile_name', ''),
                    account.get('proxy_info', ''),
                    account.get('status', ''),
                    account.get('last_check', ''),
                    account.get('last_login', ''),
                    account.get('last_care', ''),
                    account.get('notes', ''),
                    account.get('two_factor_code', '')
                ])
            
            from flask import Response
            return Response(
                output.getvalue(),
                mimetype='text/csv',
                headers={'Content-Disposition': 'attachment; filename=accounts_export.csv'}
            )
        else:
            # JSON format
            return jsonify({
                'success': True,
                'accounts': accounts,
                'count': len(accounts)
            })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/<int:account_id>', methods=['GET'])
def get_account(account_id):
    """Lấy thông tin một tài khoản"""
    try:
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        return jsonify({
            'success': True,
            'account': dict(account)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/<int:account_id>/cookies', methods=['GET'])
def get_account_cookies(account_id):
    """Lấy cookies của một tài khoản"""
    try:
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        cookies = account.get('cookies')
        if not cookies:
            return jsonify({
                'success': False,
                'error': 'No cookies found for this account'
            }), 404
        
        import json
        cookies_data = json.loads(cookies) if isinstance(cookies, str) else cookies
        
        return jsonify({
            'success': True,
            'cookies': cookies_data,
            'count': len(cookies_data) if isinstance(cookies_data, list) else 0
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxies', methods=['GET'])
def get_proxies():
    """Lấy danh sách proxy"""
    try:
        # Kiểm tra query parameter để xác định có cần full data không
        simple = request.args.get('simple', 'false').lower() == 'true'
        
        # Lấy từ proxy_manager
        proxies_list = proxy_manager.get_all_proxies()
        
        if simple:
            # Chỉ trả về dữ liệu đơn giản cho dropdown (nhanh hơn)
            try:
                db_proxies = db.get_all_proxies()
                # Tạo map để lookup nhanh
                db_proxy_map = {p.get('raw_proxy'): p for p in db_proxies}
                
                # Chỉ merge id và raw_proxy
                for proxy in proxies_list:
                    db_proxy = db_proxy_map.get(proxy.get('raw'))
                    if db_proxy:
                        proxy['id'] = db_proxy.get('id')
                    else:
                        proxy['id'] = None
            except:
                pass
            
            return jsonify({
                'success': True,
                'proxies': proxies_list,
                'count': len(proxies_list)
            })
        
        # Full data cho proxy management table
        # Lấy thêm từ database để có thông tin is_used, proxy_api_url, status và IP
        try:
            db_proxies = db.get_all_proxies()
            # Merge thông tin
            for proxy in proxies_list:
                # Tìm trong database
                db_proxy = next((p for p in db_proxies if p.get('raw_proxy') == proxy.get('raw')), None)
                if db_proxy:
                    proxy['id'] = db_proxy.get('id')
                    proxy['is_used'] = db_proxy.get('is_used', 0) == 1
                    proxy['proxy_api_url'] = db_proxy.get('proxy_api_url')
                    # Thêm thông tin status và IP đã lưu
                    proxy['saved_status'] = db_proxy.get('proxy_status')
                    proxy['saved_public_ip'] = db_proxy.get('public_ip')
                    proxy['saved_public_ip_v6'] = db_proxy.get('public_ip_v6')
                    proxy['last_check_status'] = db_proxy.get('last_check_status')
                else:
                    proxy['is_used'] = False
                    proxy['proxy_api_url'] = None
                    proxy['saved_status'] = None
                    proxy['saved_public_ip'] = None
                    proxy['saved_public_ip_v6'] = None
                    proxy['last_check_status'] = None
        except:
            # Nếu không có database, đánh dấu tất cả là chưa sử dụng
            for proxy in proxies_list:
                proxy['is_used'] = False
                proxy['proxy_api_url'] = None
                proxy['saved_status'] = None
                proxy['saved_public_ip'] = None
                proxy['saved_public_ip_v6'] = None
                proxy['last_check_status'] = None
        
        return jsonify({
            'success': True,
            'proxies': proxies_list,
            'count': len(proxies_list)
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxies', methods=['POST'])
def add_proxy():
    """Thêm proxy mới"""
    try:
        data = request.json
        proxy_string = data.get('proxy')
        proxy_api_url = data.get('proxy_api_url', '')
        
        if not proxy_string:
            return jsonify({
                'success': False,
                'error': 'Proxy string is required'
            }), 400
        
        # Parse proxy
        proxy_dict = proxy_manager.parse_proxy(proxy_string)
        if not proxy_dict:
            return jsonify({
                'success': False,
                'error': 'Invalid proxy format'
            }), 400
        
        # Thêm vào database với proxy_api_url
        proxy_id = db.add_proxy(proxy_dict, proxy_api_url=proxy_api_url if proxy_api_url else None)
        
        if proxy_id:
            # Thêm vào proxy_manager
            proxy_manager.proxies.append(proxy_dict)
            return jsonify({
                'success': True,
                'message': 'Proxy added successfully',
                'count': proxy_manager.get_proxy_count()
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Proxy already exists'
            }), 400
            
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxy/check', methods=['POST'])
def check_proxy():
    """Kiểm tra trạng thái proxy"""
    try:
        from proxy_api_client import ProxyAPIClient
        
        data = request.json
        proxy = data.get('proxy')  # Proxy string dạng ip:port
        proxy_api_url = data.get('proxy_api_url')  # URL của proxy API server (tùy chọn)
        
        if not proxy:
            return jsonify({
                'success': False,
                'error': 'Proxy is required'
            }), 400
        
        # Tạo client với URL từ request hoặc config
        print(f"[CheckProxy] Proxy: {proxy}, API URL: {proxy_api_url}")
        client = ProxyAPIClient(api_server_url=proxy_api_url)
        result = client.check_proxy_status(proxy)
        
        print(f"[CheckProxy] Result from ProxyAPIClient: {result}")
        print(f"[CheckProxy] Result keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxy/reset', methods=['POST'])
def reset_proxy():
    """Reset/change IP của proxy"""
    try:
        from proxy_api_client import ProxyAPIClient
        
        data = request.json
        proxy = data.get('proxy')  # Proxy string dạng ip:port
        proxy_api_url = data.get('proxy_api_url')  # URL của proxy API server (tùy chọn)
        
        if not proxy:
            return jsonify({
                'success': False,
                'error': 'Proxy is required'
            }), 400
        
        # Nếu không có proxy_api_url từ request, tìm trong database
        if not proxy_api_url or not proxy_api_url.strip():
            try:
                # Parse proxy để lấy host:port
                proxy_parts = proxy.split(':')
                if len(proxy_parts) >= 2:
                    proxy_host = proxy_parts[0]
                    proxy_port = proxy_parts[1]
                    # Tìm proxy trong database theo host:port hoặc raw_proxy
                    db_proxies = db.get_all_proxies()
                    for db_proxy in db_proxies:
                        # So sánh với raw_proxy hoặc host:port
                        raw_proxy = db_proxy.get('raw_proxy', '')
                        db_host = db_proxy.get('host', '')
                        db_port = str(db_proxy.get('port', ''))
                        
                        # Kiểm tra nếu proxy string khớp
                        if (raw_proxy == proxy or 
                            raw_proxy == f"{proxy_host}:{proxy_port}" or
                            (db_host == proxy_host and db_port == proxy_port)):
                            # Lấy proxy_api_url từ database
                            db_proxy_api_url = db_proxy.get('proxy_api_url')
                            if db_proxy_api_url and db_proxy_api_url.strip():
                                proxy_api_url = db_proxy_api_url.strip()
                                print(f"[ResetProxy] Tìm thấy proxy_api_url từ database: {proxy_api_url}")
                                break
            except Exception as e:
                print(f"[ResetProxy] Lỗi khi tìm proxy trong database: {e}")
        
        # Tạo client với URL từ request, database hoặc config
        print(f"[ResetProxy] Proxy: {proxy}, API URL: {proxy_api_url}")
        client = ProxyAPIClient(api_server_url=proxy_api_url)
        result = client.reset_proxy_ip(proxy)
        
        return jsonify(result)
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxies/<int:proxy_id>/status', methods=['PUT'])
def update_proxy_status(proxy_id):
    """Cập nhật trạng thái và IP của proxy vào database"""
    try:
        data = request.json
        status = data.get('status')  # True/False hoặc string
        public_ip = data.get('public_ip')
        public_ip_v6 = data.get('public_ip_v6')
        message = data.get('message')
        
        result = db.update_proxy_status(
            proxy_id=proxy_id,
            status=status,
            public_ip=public_ip,
            public_ip_v6=public_ip_v6,
            message=message
        )
        
        if result:
            return jsonify({
                'success': True,
                'message': 'Proxy status updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update proxy status'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/proxies/<int:proxy_id>', methods=['GET', 'PUT', 'DELETE'])
def proxy_by_id(proxy_id):
    """Xử lý proxy theo ID: GET, PUT, DELETE"""
    if request.method == 'GET':
        """Lấy thông tin proxy theo ID"""
        try:
            proxy = db.get_proxy_by_id(proxy_id)
            if proxy:
                return jsonify({
                    'success': True,
                    'proxy': proxy
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Proxy not found'
                }), 404
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    elif request.method == 'PUT':
        """Cập nhật proxy"""
        try:
            data = request.json
            proxy_string = data.get('proxy')
            proxy_api_url = data.get('proxy_api_url')
            
            # Kiểm tra proxy có tồn tại không
            existing_proxy = db.get_proxy_by_id(proxy_id)
            if not existing_proxy:
                return jsonify({
                    'success': False,
                    'error': 'Proxy not found'
                }), 404
            
            # Parse proxy nếu có
            proxy_dict = None
            if proxy_string:
                proxy_dict = proxy_manager.parse_proxy(proxy_string)
                if not proxy_dict:
                    return jsonify({
                        'success': False,
                        'error': 'Invalid proxy format'
                    }), 400
            
            # Cập nhật proxy
            success = db.update_proxy(proxy_id, proxy=proxy_dict, proxy_api_url=proxy_api_url)
            
            if success:
                # Cập nhật trong proxy_manager nếu có
                if proxy_dict:
                    for i, p in enumerate(proxy_manager.proxies):
                        if p.get('raw') == existing_proxy.get('raw_proxy'):
                            proxy_manager.proxies[i] = proxy_dict
                            break
                
                return jsonify({
                    'success': True,
                    'message': 'Proxy updated successfully'
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to update proxy'
                }), 500
                
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500
    
    elif request.method == 'DELETE':
        """Xóa proxy"""
        try:
            # Lấy proxy từ database
            cursor = db.conn.cursor()
            cursor.execute('SELECT * FROM proxies WHERE id = ?', (proxy_id,))
            row = cursor.fetchone()
            
            if not row:
                return jsonify({
                    'success': False,
                    'error': 'Proxy not found'
                }), 404
            
            # Convert row to dict
            if hasattr(row, 'keys'):
                proxy = dict(row)
            else:
                # If row is tuple, convert to dict
                columns = [desc[0] for desc in cursor.description]
                proxy = dict(zip(columns, row))
            
            # Kiểm tra proxy có đang được sử dụng không
            if proxy.get('is_used'):
                return jsonify({
                    'success': False,
                    'error': 'Proxy is being used and cannot be deleted'
                }), 400
            
            # Xóa proxy
            cursor.execute('DELETE FROM proxies WHERE id = ?', (proxy_id,))
            db.conn.commit()
            
            # Xóa khỏi proxy_manager
            proxy_manager.proxies = [p for p in proxy_manager.proxies if p.get('id') != proxy_id]
            
            return jsonify({
                'success': True,
                'message': 'Proxy deleted successfully'
            })
        except Exception as e:
            return jsonify({
                'success': False,
                'error': str(e)
            }), 500


@app.route('/api/accounts/<int:account_id>', methods=['PUT'])
def update_account(account_id):
    """Cập nhật thông tin tài khoản"""
    try:
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        data = request.json
        success = db.update_account(
            account_id,
            email=data.get('email'),
            password=data.get('password'),
            gpmlogin_profile_id=data.get('gpmlogin_profile_id'),
            gpmlogin_profile_name=data.get('gpmlogin_profile_name'),
            notes=data.get('notes'),
            two_factor_code=data.get('two_factor_code'),
            proxy_api_url=data.get('proxy_api_url'),
            auto_change_proxy=data.get('auto_change_proxy')
        )
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Account updated'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Update failed'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/accounts/<int:account_id>/proxy', methods=['PUT'])
def update_account_proxy(account_id):
    """Cập nhật proxy cho tài khoản"""
    try:
        account = db.get_account_by_id(account_id)
        if not account:
            return jsonify({
                'success': False,
                'error': 'Account not found'
            }), 404
        
        data = request.json
        new_proxy = data.get('proxy')  # Proxy string hoặc None để xóa
        
        # Parse proxy nếu có
        proxy_id = None
        proxy_info = None
        
        if new_proxy and new_proxy.strip():
            from proxy_manager import ProxyManager
            proxy_manager = ProxyManager()
            proxy_dict = proxy_manager.parse_proxy(new_proxy.strip())
            if proxy_dict:
                # Tìm proxy trong database bằng raw_proxy string
                raw_proxy_string = new_proxy.strip()
                existing_proxy = db.get_proxy_by_raw(raw_proxy_string)
                
                if existing_proxy:
                    proxy_id = existing_proxy['id']
                    print(f"[UpdateAccountProxy] ✓ Tìm thấy proxy trong database, proxy_id={proxy_id}")
                    # Lấy proxy_api_url từ proxy config nếu có
                    proxy_api_url = existing_proxy.get('proxy_api_url')
                    if proxy_api_url:
                        print(f"[UpdateAccountProxy] Proxy có proxy_api_url: {proxy_api_url}")
                else:
                    # Parse proxy dict thành raw_proxy string để lưu vào database
                    if proxy_dict.get('username') and proxy_dict.get('password'):
                        raw_proxy = f"{proxy_dict['host']}:{proxy_dict['port']}:{proxy_dict['username']}:{proxy_dict['password']}"
                    else:
                        raw_proxy = f"{proxy_dict['host']}:{proxy_dict['port']}"
                    
                    # Thêm proxy vào database
                    proxy_id = db.add_proxy(
                        proxy=proxy_dict,
                        proxy_api_url=None  # Sẽ cập nhật sau nếu cần
                    )
                    
                    # Nếu add_proxy trả về None (do INSERT OR IGNORE), tìm lại
                    if not proxy_id or proxy_id == 0:
                        print(f"[UpdateAccountProxy] ⚠ add_proxy trả về None/0, tìm lại proxy...")
                        existing_proxy = db.get_proxy_by_raw(raw_proxy)
                        if existing_proxy:
                            proxy_id = existing_proxy['id']
                            print(f"[UpdateAccountProxy] ✓ Tìm thấy proxy sau khi insert, proxy_id={proxy_id}")
                        else:
                            print(f"[UpdateAccountProxy] ✗ Không tìm thấy proxy sau khi insert")
                    else:
                        print(f"[UpdateAccountProxy] ✓ Đã thêm proxy mới vào database, proxy_id={proxy_id}")
                
                proxy_info = raw_proxy_string
                
                # Đảm bảo proxy_id hợp lệ trước khi lưu
                if not proxy_id or proxy_id == 0:
                    print(f"[UpdateAccountProxy] ⚠ Cảnh báo: proxy_id không hợp lệ ({proxy_id}), sẽ không lưu proxy_id")
                    proxy_id = None
        else:
            # Nếu new_proxy là None hoặc rỗng, xóa proxy (set về None)
            proxy_id = None
            proxy_info = None
        
        # Cập nhật account với proxy mới (hoặc None để xóa)
        success = db.update_account(
            account_id,
            proxy_id=proxy_id,
            proxy_info=proxy_info
        )
        
        # Cập nhật profile GPMLogin nếu có
        if account.get('gpmlogin_profile_id') and success:
            try:
                from gpmlogin_manager import GPMLoginManager
                gpm_manager = GPMLoginManager()
                profile_id = account['gpmlogin_profile_id']
                
                # Format proxy cho GPMLogin
                if new_proxy and new_proxy.strip():
                    proxy_dict = proxy_manager.parse_proxy(new_proxy.strip())
                    if proxy_dict:
                        proxy_formatted = proxy_manager.format_proxy_for_gpmlogin(proxy_dict)
                        # Update profile với proxy mới
                        update_result = gpm_manager.update_profile_proxy(profile_id, proxy_formatted)
                        if not update_result:
                            print(f"[UpdateAccountProxy] Cảnh báo: Không thể cập nhật proxy cho profile {profile_id}")
                else:
                    # Xóa proxy khỏi profile
                    gpm_manager.update_profile_proxy(profile_id, None)
            except Exception as e:
                print(f"[UpdateAccountProxy] Lỗi cập nhật proxy cho profile: {e}")
        
        if success:
            return jsonify({
                'success': True,
                'message': 'Proxy updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Update failed'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/gpmlogin/profiles/<profile_id>/proxy', methods=['PUT'])
def update_profile_proxy(profile_id):
    """Cập nhật proxy cho profile GPMLogin"""
    try:
        data = request.json
        new_proxy = data.get('proxy')  # Proxy string hoặc None để xóa
        
        from gpmlogin_manager import GPMLoginManager
        from proxy_manager import ProxyManager
        
        gpm_manager = GPMLoginManager()
        proxy_manager = ProxyManager()
        
        # Format proxy cho GPMLogin nếu có
        proxy_formatted = None
        if new_proxy and new_proxy.strip():
            proxy_dict = proxy_manager.parse_proxy(new_proxy.strip())
            if proxy_dict:
                # Format proxy theo format GPMLogin yêu cầu (IP:Port:User:Pass)
                proxy_formatted = proxy_manager.format_proxy_for_gpmlogin(proxy_dict)
            else:
                # Nếu không parse được, thử dùng trực tiếp (có thể đã đúng format)
                proxy_formatted = new_proxy.strip()
        
        # Cập nhật profile
        result = gpm_manager.update_profile_proxy(profile_id, proxy_formatted)
        
        if result:
            # Cập nhật proxy trong database cho account có profile_id này
            try:
                accounts = db.get_all_accounts()
                for account in accounts:
                    if account.get('gpmlogin_profile_id') == profile_id:
                        # Cập nhật proxy_info trong account
                        proxy_info = new_proxy.strip() if new_proxy and new_proxy.strip() else None
                        # Tìm proxy_id nếu có proxy
                        proxy_id = None
                        if proxy_info:
                            proxy_dict = proxy_manager.parse_proxy(proxy_info)
                            if proxy_dict:
                                # db.add_proxy() nhận proxy dict và proxy_api_url (optional)
                                proxy_id = db.add_proxy(proxy_dict, None)  # Không có proxy_api_url khi update từ profile
                                if proxy_id == 0 or proxy_id is None:  # Proxy đã tồn tại hoặc không thêm được
                                    existing_proxy = db.get_proxy_by_raw(proxy_dict.get('raw'))
                                    if existing_proxy:
                                        proxy_id = existing_proxy.get('id')
                        
                        db.update_account(
                            account_id=account.get('id'),
                            proxy_id=proxy_id,
                            proxy_info=proxy_info
                        )
                        print(f"[UpdateProfileProxy] Đã cập nhật proxy cho account {account.get('id')}: {proxy_info}")
                        break
            except Exception as e:
                print(f"[UpdateProfileProxy] Cảnh báo: Không thể cập nhật proxy trong database: {e}")
            
            return jsonify({
                'success': True,
                'message': 'Profile proxy updated successfully'
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Failed to update profile proxy'
            }), 400
    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("=" * 50)
    print("Gmail Manager Dashboard Server")
    print("=" * 50)
    print("Dashboard: http://localhost:5000")
    print("API: http://localhost:5000/api")
    print("=" * 50)
    print("Press Ctrl+C to stop")
    print("=" * 50)
    
    # Tắt debug mode để tránh reload loop
    # Nếu cần debug, set use_reloader=False
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True, use_reloader=False)

