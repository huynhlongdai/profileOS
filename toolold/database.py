import sqlite3
from datetime import datetime
from config import DATABASE_PATH

class Database:
    def __init__(self):
        self.conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
        self.conn.row_factory = sqlite3.Row
        self.create_tables()
    
    def create_tables(self):
        cursor = self.conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS accounts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email TEXT UNIQUE NOT NULL,
                password TEXT,
                gpmlogin_profile_id TEXT,
                gpmlogin_profile_name TEXT,
                proxy_id INTEGER,
                proxy_info TEXT,
                status TEXT DEFAULT 'active',
                last_check DATETIME,
                last_login DATETIME,
                last_care DATETIME,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (proxy_id) REFERENCES proxies (id)
            )
        ''')
        
        # Migration: Thêm các cột mới nếu chưa có
        self.migrate_database()
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS account_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                event_type TEXT,
                message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS care_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                account_id INTEGER,
                actions TEXT,
                success BOOLEAN,
                error_message TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (account_id) REFERENCES accounts (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS proxies (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                proxy_type TEXT,
                host TEXT,
                port TEXT,
                username TEXT,
                password TEXT,
                raw_proxy TEXT UNIQUE,
                is_used BOOLEAN DEFAULT 0,
                used_by_account_id INTEGER,
                proxy_api_url TEXT,
                proxy_status TEXT,
                public_ip TEXT,
                public_ip_v6 TEXT,
                last_check_status DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (used_by_account_id) REFERENCES accounts (id)
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS deleted_profiles (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                profile_id TEXT UNIQUE NOT NULL,
                profile_name TEXT,
                email TEXT,
                deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                permanently_deleted BOOLEAN DEFAULT 0
            )
        ''')
        
        self.conn.commit()
    
    def migrate_database(self):
        """Migration: Thêm các cột mới vào bảng accounts nếu chưa có"""
        cursor = self.conn.cursor()
        
        try:
            # Kiểm tra xem cột proxy_id đã tồn tại chưa
            cursor.execute("PRAGMA table_info(accounts)")
            columns = [column[1] for column in cursor.fetchall()]
            
            # Thêm cột proxy_id nếu chưa có
            if 'proxy_id' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN proxy_id INTEGER')
                print("✓ Đã thêm cột proxy_id vào bảng accounts")
            
            # Thêm cột proxy_info nếu chưa có
            if 'proxy_info' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN proxy_info TEXT')
                print("✓ Đã thêm cột proxy_info vào bảng accounts")
            
            # Thêm cột cookies nếu chưa có
            if 'cookies' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN cookies TEXT')
                print("✓ Đã thêm cột cookies vào bảng accounts")
            
            # Thêm cột two_factor_code nếu chưa có
            if 'two_factor_code' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN two_factor_code TEXT')
                print("✓ Đã thêm cột two_factor_code vào bảng accounts")
            
            # Thêm cột proxy_api_url nếu chưa có
            if 'proxy_api_url' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN proxy_api_url TEXT')
                print("✓ Đã thêm cột proxy_api_url vào bảng accounts")
            
            # Thêm cột auto_change_proxy nếu chưa có
            if 'auto_change_proxy' not in columns:
                cursor.execute('ALTER TABLE accounts ADD COLUMN auto_change_proxy BOOLEAN DEFAULT 0')
                print("✓ Đã thêm cột auto_change_proxy vào bảng accounts")
            
            # Kiểm tra và thêm cột proxy_api_url vào bảng proxies
            cursor.execute("PRAGMA table_info(proxies)")
            proxy_columns = [column[1] for column in cursor.fetchall()]
            
            if 'proxy_api_url' not in proxy_columns:
                cursor.execute('ALTER TABLE proxies ADD COLUMN proxy_api_url TEXT')
                print("✓ Đã thêm cột proxy_api_url vào bảng proxies")
            
            # Thêm các cột mới cho proxy status và IP
            if 'proxy_status' not in proxy_columns:
                cursor.execute('ALTER TABLE proxies ADD COLUMN proxy_status TEXT')
                print("✓ Đã thêm cột proxy_status vào bảng proxies")
            
            if 'public_ip' not in proxy_columns:
                cursor.execute('ALTER TABLE proxies ADD COLUMN public_ip TEXT')
                print("✓ Đã thêm cột public_ip vào bảng proxies")
            
            if 'public_ip_v6' not in proxy_columns:
                cursor.execute('ALTER TABLE proxies ADD COLUMN public_ip_v6 TEXT')
                print("✓ Đã thêm cột public_ip_v6 vào bảng proxies")
            
            if 'last_check_status' not in proxy_columns:
                cursor.execute('ALTER TABLE proxies ADD COLUMN last_check_status DATETIME')
                print("✓ Đã thêm cột last_check_status vào bảng proxies")
            
            self.conn.commit()
        except Exception as e:
            print(f"Lỗi migration database: {e}")
            self.conn.rollback()
    
    def add_account(self, email, password, gpmlogin_profile_id=None, gpmlogin_profile_name=None, 
                   proxy_id=None, proxy_info=None, notes="", proxy_api_url=None, auto_change_proxy=False):
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT INTO accounts (email, password, gpmlogin_profile_id, gpmlogin_profile_name, 
                                     proxy_id, proxy_info, notes, proxy_api_url, auto_change_proxy)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (email, password, gpmlogin_profile_id, gpmlogin_profile_name, 
                  proxy_id, proxy_info, notes, proxy_api_url, 1 if auto_change_proxy else 0))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_all_accounts(self):
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM accounts ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]
    
    def get_account_by_email(self, email):
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM accounts WHERE email = ?', (email,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_account_by_id(self, account_id):
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM accounts WHERE id = ?', (account_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def update_account_status(self, email, status):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE accounts 
            SET status = ?, last_check = ?
            WHERE email = ?
        ''', (status, datetime.now(), email))
        self.conn.commit()
    
    def update_last_login(self, email):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE accounts 
            SET last_login = ?
            WHERE email = ?
        ''', (datetime.now(), email))
        self.conn.commit()
    
    def update_last_care(self, email):
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE accounts 
            SET last_care = ?
            WHERE email = ?
        ''', (datetime.now(), email))
        self.conn.commit()
    
    def add_log(self, account_id, event_type, message):
        cursor = self.conn.cursor()
        cursor.execute('''
            INSERT INTO account_logs (account_id, event_type, message)
            VALUES (?, ?, ?)
        ''', (account_id, event_type, message))
        self.conn.commit()
        return cursor.lastrowid
    
    def get_logs(self, account_id=None, limit=100):
        cursor = self.conn.cursor()
        if account_id:
            cursor.execute('''
                SELECT * FROM account_logs 
                WHERE account_id = ?
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (account_id, limit))
        else:
            cursor.execute('''
                SELECT * FROM account_logs 
                ORDER BY timestamp DESC
                LIMIT ?
            ''', (limit,))
        return [dict(row) for row in cursor.fetchall()]
    
    def add_care_history(self, account_id, actions, success, error_message=None):
        cursor = self.conn.cursor()
        actions_str = ", ".join(actions) if isinstance(actions, list) else str(actions)
        cursor.execute('''
            INSERT INTO care_history (account_id, actions, success, error_message)
            VALUES (?, ?, ?, ?)
        ''', (account_id, actions_str, success, error_message))
        self.conn.commit()
        return cursor.lastrowid
    
    def update_account(self, account_id, email=None, password=None, gpmlogin_profile_id=None, gpmlogin_profile_name=None, notes=None, two_factor_code=None, cookies=None, proxy_api_url=None, auto_change_proxy=None, proxy_id=None, proxy_info=None):
        """Cập nhật thông tin tài khoản"""
        cursor = self.conn.cursor()
        updates = []
        params = []
        
        if email is not None:
            updates.append("email = ?")
            params.append(email)
        if password is not None:
            updates.append("password = ?")
            params.append(password)
        if gpmlogin_profile_id is not None:
            updates.append("gpmlogin_profile_id = ?")
            params.append(gpmlogin_profile_id)
        if gpmlogin_profile_name is not None:
            updates.append("gpmlogin_profile_name = ?")
            params.append(gpmlogin_profile_name)
        if notes is not None:
            updates.append("notes = ?")
            params.append(notes)
        if two_factor_code is not None:
            updates.append("two_factor_code = ?")
            params.append(two_factor_code)
        if proxy_api_url is not None:
            updates.append("proxy_api_url = ?")
            params.append(proxy_api_url)
        if auto_change_proxy is not None:
            updates.append("auto_change_proxy = ?")
            params.append(1 if auto_change_proxy else 0)
        if cookies is not None:
            updates.append("cookies = ?")
            params.append(cookies)
        if proxy_id is not None:
            updates.append("proxy_id = ?")
            params.append(proxy_id)
        if proxy_info is not None:
            updates.append("proxy_info = ?")
            params.append(proxy_info)
        
        if not updates:
            return False
        
        params.append(account_id)
        query = f"UPDATE accounts SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        self.conn.commit()
        return cursor.rowcount > 0
    
    def delete_account(self, account_id, keep_profile=True):
        """Xóa tài khoản nhưng giữ profile trong thùng rác nếu keep_profile=True"""
        cursor = self.conn.cursor()
        
        # Lấy thông tin tài khoản trước khi xóa
        account = self.get_account_by_id(account_id)
        if not account:
            return False
        
        # Nếu giữ profile, lưu vào deleted_profiles
        if keep_profile and account.get('gpmlogin_profile_id'):
            try:
                cursor.execute('''
                    INSERT OR IGNORE INTO deleted_profiles (profile_id, profile_name, email)
                    VALUES (?, ?, ?)
                ''', (
                    account.get('gpmlogin_profile_id'),
                    account.get('gpmlogin_profile_name'),
                    account.get('email')
                ))
            except:
                pass  # Đã tồn tại trong deleted_profiles
        
        # Xóa tài khoản
        cursor.execute('DELETE FROM accounts WHERE id = ?', (account_id,))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def get_deleted_profiles(self):
        """Lấy danh sách profiles đã xóa (thùng rác)"""
        cursor = self.conn.cursor()
        cursor.execute('''
            SELECT * FROM deleted_profiles 
            WHERE permanently_deleted = 0
            ORDER BY deleted_at DESC
        ''')
        rows = cursor.fetchall()
        return [dict(row) for row in rows] if rows else []
    
    def permanently_delete_profile(self, profile_id):
        """Xóa vĩnh viễn profile khỏi thùng rác"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE deleted_profiles 
            SET permanently_deleted = 1
            WHERE profile_id = ?
        ''', (profile_id,))
        self.conn.commit()
        return cursor.rowcount > 0
    
    def restore_profile(self, profile_id):
        """Khôi phục profile từ thùng rác"""
        cursor = self.conn.cursor()
        cursor.execute('DELETE FROM deleted_profiles WHERE profile_id = ?', (profile_id,))
        self.conn.commit()
        return cursor.rowcount > 0
    
    # Proxy management methods
    def add_proxy(self, proxy, proxy_api_url=None):
        """Thêm proxy vào database"""
        cursor = self.conn.cursor()
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO proxies (proxy_type, host, port, username, password, raw_proxy, proxy_api_url)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                proxy.get('type', 'http'),
                proxy.get('host'),
                proxy.get('port'),
                proxy.get('username'),
                proxy.get('password'),
                proxy.get('raw'),
                proxy_api_url
            ))
            self.conn.commit()
            return cursor.lastrowid
        except sqlite3.IntegrityError:
            return None
    
    def get_proxy_by_id(self, proxy_id):
        """Lấy proxy theo ID"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM proxies WHERE id = ?', (proxy_id,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_proxy_by_raw(self, raw_proxy):
        """Lấy proxy theo raw_proxy string"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM proxies WHERE raw_proxy = ?', (raw_proxy,))
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def update_proxy(self, proxy_id, proxy=None, proxy_api_url=None):
        """Cập nhật proxy"""
        cursor = self.conn.cursor()
        updates = []
        params = []
        
        if proxy:
            if 'host' in proxy:
                updates.append("host = ?")
                params.append(proxy.get('host'))
            if 'port' in proxy:
                updates.append("port = ?")
                params.append(proxy.get('port'))
            if 'username' in proxy:
                updates.append("username = ?")
                params.append(proxy.get('username'))
            if 'password' in proxy:
                updates.append("password = ?")
                params.append(proxy.get('password'))
            if 'raw' in proxy:
                updates.append("raw_proxy = ?")
                params.append(proxy.get('raw'))
            if 'type' in proxy:
                updates.append("proxy_type = ?")
                params.append(proxy.get('type'))
        
        if proxy_api_url is not None:
            updates.append("proxy_api_url = ?")
            params.append(proxy_api_url)
        
        if not updates:
            return False
        
        params.append(proxy_id)
        query = f"UPDATE proxies SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        self.conn.commit()
        return cursor.rowcount > 0
    
    def update_proxy_status(self, proxy_id, status=None, public_ip=None, public_ip_v6=None, message=None):
        """Cập nhật trạng thái và IP của proxy"""
        cursor = self.conn.cursor()
        updates = []
        params = []
        
        if status is not None:
            # status có thể là True/False hoặc string
            if isinstance(status, bool):
                updates.append("proxy_status = ?")
                params.append('active' if status else 'inactive')
            else:
                updates.append("proxy_status = ?")
                params.append(str(status))
        
        if public_ip is not None:
            updates.append("public_ip = ?")
            params.append(public_ip)
        
        if public_ip_v6 is not None:
            updates.append("public_ip_v6 = ?")
            params.append(public_ip_v6)
        
        # Cập nhật thời gian check
        from datetime import datetime
        updates.append("last_check_status = ?")
        params.append(datetime.now().isoformat())
        
        if not updates:
            return False
        
        params.append(proxy_id)
        query = f"UPDATE proxies SET {', '.join(updates)} WHERE id = ?"
        cursor.execute(query, params)
        self.conn.commit()
        return cursor.rowcount > 0
    
    def get_all_proxies(self):
        """Lấy tất cả proxy"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM proxies ORDER BY created_at DESC')
        return [dict(row) for row in cursor.fetchall()]
    
    def get_unused_proxy(self):
        """Lấy proxy chưa sử dụng"""
        cursor = self.conn.cursor()
        cursor.execute('SELECT * FROM proxies WHERE is_used = 0 LIMIT 1')
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def mark_proxy_as_used(self, proxy_id, account_id):
        """Đánh dấu proxy đã được sử dụng"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE proxies 
            SET is_used = 1, used_by_account_id = ?
            WHERE id = ?
        ''', (account_id, proxy_id))
        self.conn.commit()
    
    def mark_proxy_as_unused(self, proxy_id):
        """Đánh dấu proxy chưa được sử dụng"""
        cursor = self.conn.cursor()
        cursor.execute('''
            UPDATE proxies 
            SET is_used = 0, used_by_account_id = NULL
            WHERE id = ?
        ''', (proxy_id,))
        self.conn.commit()
    
    def close(self):
        self.conn.close()

