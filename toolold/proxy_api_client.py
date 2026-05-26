"""
Module để gọi API proxy server để check status và reset IP
"""
import requests
import time
from typing import Dict, Optional
from config import PROXY_API_SERVER_URL

class ProxyAPIClient:
    """Client để gọi API proxy server"""
    
    def __init__(self, api_server_url: Optional[str] = None):
        """
        Args:
            api_server_url: URL của proxy API server (ví dụ: http://192.168.1.41 hoặc 192.168.1.41)
        """
        # Sử dụng api_server_url từ tham số, nếu không có thì dùng từ config
        raw_url = None
        if api_server_url and api_server_url.strip():
            raw_url = api_server_url.strip()
        elif PROXY_API_SERVER_URL and PROXY_API_SERVER_URL.strip():
            raw_url = PROXY_API_SERVER_URL.strip()
        
        # Normalize URL để đảm bảo có scheme
        if raw_url:
            self.api_server_url = self._normalize_url(raw_url)
            print(f"[ProxyAPI] Đã normalize URL: {raw_url} -> {self.api_server_url}")
        else:
            self.api_server_url = None
            print("[ProxyAPI] ⚠ Không có PROXY_API_SERVER_URL trong config hoặc request")
    
    def _normalize_url(self, url: str) -> str:
        """
        Chuẩn hóa URL để đảm bảo có scheme
        
        Args:
            url: URL có thể có hoặc không có scheme (ví dụ: 192.168.1.41 hoặc http://192.168.1.41)
        
        Returns:
            URL đã được normalize với scheme (ví dụ: http://192.168.1.41)
        """
        if not url:
            return url
        
        url = str(url).strip()
        if not url:
            return url
        
        # Nếu URL không có scheme, thêm http://
        if not url.startswith('http://') and not url.startswith('https://'):
            # Nếu bắt đầu bằng //, thêm http:
            if url.startswith('//'):
                url = 'http:' + url
            else:
                # Thêm http:// vào đầu
                url = 'http://' + url
        
        # Loại bỏ trailing slash
        url = url.rstrip('/')
        
        return url
    
    def _extract_base_url(self, url: str) -> str:
        """
        Extract base URL từ URL đầy đủ (có thể chứa path và query params)
        
        Args:
            url: URL có thể là base URL hoặc full URL (ví dụ: http://192.168.1.41 hoặc http://192.168.1.41/reset?proxy=...)
        
        Returns:
            Base URL (ví dụ: http://192.168.1.41)
        """
        if not url:
            return url
        
        url = str(url).strip()
        if not url:
            return url
        
        # Normalize URL trước
        url = self._normalize_url(url)
        
        # Nếu URL chứa path hoặc query params, extract base URL
        try:
            from urllib.parse import urlparse
            parsed = urlparse(url)
            # Chỉ lấy scheme, netloc (host:port)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            return base_url
        except Exception as e:
            print(f"[ProxyAPI] Lỗi extract base URL: {e}, dùng URL gốc")
            return url
    
    def check_proxy_status_via_public_api(self, proxy: str, timeout: int = 10) -> Dict:
        """
        Kiểm tra proxy bằng cách sử dụng các dịch vụ check IP công khai qua proxy
        
        Args:
            proxy: Proxy string dạng ip:port hoặc ip:port:user:pass
            timeout: Timeout cho request (giây)
        
        Returns:
            dict: {
                'success': bool,
                'status': bool,  # True nếu proxy hoạt động, False nếu không
                'message': str,  # 'PROXY_WORKING' hoặc error message
                'public_ip': str,  # Public IP qua proxy
                'error': str (nếu có lỗi)
            }
        """
        # Danh sách các dịch vụ check IP công khai
        ip_check_services = [
            'http://httpbin.org/ip',
            'https://api.ipify.org?format=json',
            'http://api.myip.com',
            'https://ifconfig.me/ip',
            'https://icanhazip.com',
            'https://checkip.amazonaws.com',
            'http://ip-api.com/json'
        ]
        
        # Parse proxy string
        proxy_parts = proxy.split(':')
        proxy_host = proxy_parts[0] if len(proxy_parts) > 0 else ''
        proxy_port = int(proxy_parts[1]) if len(proxy_parts) > 1 else 0
        proxy_user = proxy_parts[2] if len(proxy_parts) > 2 else None
        proxy_pass = proxy_parts[3] if len(proxy_parts) > 3 else None
        
        if not proxy_host or not proxy_port:
            return {
                'success': False,
                'error': 'Invalid proxy format',
                'status': False,
                'message': 'INVALID_PROXY'
            }
        
        # Tạo proxy dict cho requests
        proxies_dict = {
            'http': f'http://{proxy_host}:{proxy_port}',
            'https': f'http://{proxy_host}:{proxy_port}'
        }
        
        if proxy_user and proxy_pass:
            proxies_dict['http'] = f'http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}'
            proxies_dict['https'] = f'http://{proxy_user}:{proxy_pass}@{proxy_host}:{proxy_port}'
        
        # Thử từng dịch vụ cho đến khi thành công
        for service_url in ip_check_services:
            try:
                print(f"[ProxyAPI] Thử check IP qua proxy bằng {service_url}")
                response = requests.get(service_url, proxies=proxies_dict, timeout=timeout)
                response.raise_for_status()
                
                # Parse IP từ response
                public_ip = None
                public_ip_v6 = None
                
                try:
                    if 'json' in response.headers.get('content-type', '').lower():
                        data = response.json()
                        # Các format khác nhau
                        public_ip = data.get('ip') or data.get('origin') or data.get('query')
                        if isinstance(public_ip, str) and ',' in public_ip:
                            # Có thể có nhiều IP (IPv4 và IPv6)
                            ips = [ip.strip() for ip in public_ip.split(',')]
                            for ip in ips:
                                if ':' in ip:
                                    public_ip_v6 = ip
                                else:
                                    public_ip = ip
                    else:
                        # Plain text response
                        text = response.text.strip()
                        if ':' in text:
                            public_ip_v6 = text
                        else:
                            public_ip = text
                except:
                    # Fallback: lấy text trực tiếp
                    text = response.text.strip()
                    if ':' in text:
                        public_ip_v6 = text
                    else:
                        public_ip = text
                
                if public_ip or public_ip_v6:
                    print(f"[ProxyAPI] ✓ Tìm thấy IP qua proxy: IPv4={public_ip}, IPv6={public_ip_v6}")
                    return {
                        'success': True,
                        'status': True,
                        'message': 'PROXY_WORKING',
                        'proxy_ip': proxy_host,
                        'public_ip': public_ip,
                        'public_ip_v6': public_ip_v6,
                        'display_ip': f"{public_ip} / {public_ip_v6}" if (public_ip and public_ip_v6) else (public_ip or public_ip_v6)
                    }
                    
            except requests.exceptions.ProxyError as e:
                print(f"[ProxyAPI] ✗ Proxy error với {service_url}: {e}")
                continue
            except requests.exceptions.Timeout:
                print(f"[ProxyAPI] ✗ Timeout với {service_url}")
                continue
            except Exception as e:
                print(f"[ProxyAPI] ✗ Lỗi với {service_url}: {e}")
                continue
        
        # Nếu tất cả đều thất bại
        return {
            'success': False,
            'error': 'Cannot connect through proxy',
            'status': False,
            'message': 'PROXY_NOT_WORKING'
        }
    
    def check_proxy_status(self, proxy: str, timeout: int = 10) -> Dict:
        """
        Kiểm tra trạng thái proxy bằng cách sử dụng các dịch vụ check IP công khai qua proxy
        
        Args:
            proxy: Proxy string dạng ip:port hoặc ip:port:user:pass
            timeout: Timeout cho request (giây)
        
        Returns:
            dict: {
                'success': bool,
                'status': bool,  # True nếu proxy hoạt động, False nếu không
                'message': str,  # 'PROXY_WORKING' hoặc error message
                'public_ip': str,  # Public IP qua proxy
                'error': str (nếu có lỗi)
            }
        """
        # Luôn dùng public API services để check proxy
        print(f"[ProxyAPI] Kiểm tra proxy bằng phương pháp check IP công khai: {proxy}")
        return self.check_proxy_status_via_public_api(proxy, timeout)
    
    def reset_proxy_ip(self, proxy: str, timeout: int = 30) -> Dict:
        """
        Reset/change/rotate public IP của proxy
        
        Args:
            proxy: Proxy string dạng ip:port (ví dụ: proxy.hoanong.com:4001)
            timeout: Timeout cho request (giây) - reset có thể mất thời gian
        
        Returns:
            dict: {
                'success': bool,
                'message': str,
                'error': str (nếu có lỗi)
            }
        """
        if not self.api_server_url:
            return {
                'success': False,
                'error': 'Proxy API server URL not configured'
            }
        
        try:
            # Extract base URL từ api_server_url (có thể là full URL hoặc base URL)
            base_url = self._extract_base_url(self.api_server_url) if self.api_server_url else None
            if not base_url:
                return {
                    'success': False,
                    'error': 'Invalid proxy API server URL'
                }
            
            url = f"{base_url}/reset"
            params = {'proxy': proxy}
            
            print(f"[ProxyAPI] Reset IP proxy: {proxy}")
            print(f"[ProxyAPI] Base URL: {base_url}")
            print(f"[ProxyAPI] Full URL: {url}")
            print(f"[ProxyAPI] Params: {params}")
            
            response = requests.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            
            data = response.json()
            
            result = {
                'success': True,
                'message': data.get('message', 'Reset initiated')
            }
            
            print(f"[ProxyAPI] Kết quả reset: {result['message']}")
            return result
            
        except requests.exceptions.Timeout:
            print(f"[ProxyAPI] ✗ Timeout khi reset proxy {proxy}")
            return {
                'success': False,
                'error': 'Request timeout - reset may still be in progress'
            }
        except requests.exceptions.ConnectionError as e:
            print(f"[ProxyAPI] ✗ Không thể kết nối đến proxy API server: {e}")
            return {
                'success': False,
                'error': f'Connection error: {str(e)}'
            }
        except Exception as e:
            print(f"[ProxyAPI] ✗ Lỗi khi reset proxy: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def get_proxy_ip(self, proxy: str) -> Optional[str]:
        """
        Lấy public IP của proxy bằng cách check status
        Note: Sử dụng check_proxy_status để lấy IP từ response
        """
        try:
            result = self.check_proxy_status(proxy)
            if result.get('success'):
                # Trả về public IP nếu có, nếu không thì trả về proxy IP
                return result.get('public_ip') or result.get('proxy_ip')
        except:
            pass
        return None

