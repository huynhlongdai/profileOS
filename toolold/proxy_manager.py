import os
import random
import json
from typing import List, Dict, Optional
from database import Database

class ProxyManager:
    """Quản lý thư viện proxy"""
    
    def __init__(self, proxy_file_path="proxies.txt", db=None):
        self.proxy_file_path = proxy_file_path
        self.db = db or Database()
        self.proxies = []
        self.load_proxies()
    
    def load_proxies(self):
        """Tải proxy từ file hoặc database"""
        # Tải từ file nếu có
        if os.path.exists(self.proxy_file_path):
            try:
                with open(self.proxy_file_path, 'r', encoding='utf-8') as f:
                    lines = f.readlines()
                    for line in lines:
                        line = line.strip()
                        if line and not line.startswith('#'):
                            proxy = self.parse_proxy(line)
                            if proxy:
                                self.proxies.append(proxy)
            except Exception as e:
                print(f"Lỗi đọc file proxy: {e}")
        
        # Tải từ database nếu có
        try:
            db_proxies = self.db.get_all_proxies()
            for db_proxy in db_proxies:
                # Convert database proxy to dict format
                proxy_dict = {
                    'type': db_proxy.get('proxy_type', 'http'),
                    'host': db_proxy.get('host'),
                    'port': db_proxy.get('port'),
                    'username': db_proxy.get('username'),
                    'password': db_proxy.get('password'),
                    'raw': db_proxy.get('raw_proxy')
                }
                # Check if not already in list
                if not any(p.get('raw') == proxy_dict.get('raw') for p in self.proxies):
                    self.proxies.append(proxy_dict)
        except:
            pass  # Table chưa tồn tại hoặc chưa có method
    
    def parse_proxy(self, proxy_string: str) -> Optional[Dict]:
        """Parse proxy string thành dict
        
        Formats hỗ trợ:
        - ip:port
        - ip:port:username:password
        - http://ip:port
        - http://username:password@ip:port
        - socks5://ip:port
        """
        proxy_string = proxy_string.strip()
        if not proxy_string:
            return None
        
        # Loại bỏ protocol nếu có
        proxy_string = proxy_string.replace('http://', '').replace('https://', '').replace('socks5://', '')
        
        parts = proxy_string.split(':')
        
        if len(parts) == 2:
            # ip:port
            return {
                'type': 'http',
                'host': parts[0],
                'port': parts[1],
                'username': None,
                'password': None,
                'raw': f"{parts[0]}:{parts[1]}"
            }
        elif len(parts) == 4:
            # ip:port:username:password
            return {
                'type': 'http',
                'host': parts[0],
                'port': parts[1],
                'username': parts[2],
                'password': parts[3],
                'raw': f"{parts[2]}:{parts[3]}@{parts[0]}:{parts[1]}"
            }
        else:
            # Thử parse với @
            if '@' in proxy_string:
                auth_part, host_part = proxy_string.split('@')
                username, password = auth_part.split(':')
                host, port = host_part.split(':')
                return {
                    'type': 'http',
                    'host': host,
                    'port': port,
                    'username': username,
                    'password': password,
                    'raw': proxy_string
                }
        
        return None
    
    def format_proxy_for_gpmlogin(self, proxy: Dict) -> str:
        """Format proxy cho GPMLogin API
        
        GPMLogin format theo tài liệu: IP:Port:User:Pass
        Hoặc: HTTP proxy| IP:Port:User:Pass
        Không dùng format protocol://
        """
        if proxy.get('username') and proxy.get('password'):
            # Format: IP:Port:User:Pass
            return f"{proxy['host']}:{proxy['port']}:{proxy['username']}:{proxy['password']}"
        else:
            # Format: IP:Port (không có auth)
            return f"{proxy['host']}:{proxy['port']}"
    
    def get_random_proxy(self) -> Optional[Dict]:
        """Lấy proxy ngẫu nhiên"""
        if not self.proxies:
            return None
        return random.choice(self.proxies)
    
    def get_proxy_by_index(self, index: int) -> Optional[Dict]:
        """Lấy proxy theo index"""
        if 0 <= index < len(self.proxies):
            return self.proxies[index]
        return None
    
    def get_all_proxies(self) -> List[Dict]:
        """Lấy tất cả proxy"""
        return self.proxies
    
    def add_proxy(self, proxy_string: str) -> bool:
        """Thêm proxy mới"""
        proxy = self.parse_proxy(proxy_string)
        if proxy:
            self.proxies.append(proxy)
            # Lưu vào database nếu có
            try:
                self.db.add_proxy(proxy)
            except:
                pass
            return True
        return False
    
    def remove_proxy(self, proxy: Dict) -> bool:
        """Xóa proxy"""
        if proxy in self.proxies:
            self.proxies.remove(proxy)
            return True
        return False
    
    def get_unused_proxy(self, used_proxies: List[str] = None) -> Optional[Dict]:
        """Lấy proxy chưa được sử dụng"""
        if used_proxies is None:
            used_proxies = []
        
        available = [p for p in self.proxies if p.get('raw') not in used_proxies]
        if available:
            return random.choice(available)
        return None
    
    def get_proxy_count(self) -> int:
        """Đếm số lượng proxy"""
        return len(self.proxies)
    
    def save_to_file(self, file_path: str = None):
        """Lưu proxy vào file"""
        if file_path is None:
            file_path = self.proxy_file_path
        
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                for proxy in self.proxies:
                    f.write(proxy.get('raw', '') + '\n')
            return True
        except Exception as e:
            print(f"Lỗi lưu file proxy: {e}")
            return False

