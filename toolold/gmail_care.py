import time
import random
from datetime import datetime, timedelta
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import TimeoutException, NoSuchElementException
from config import BROWSER_TIMEOUT

class GmailCare:
    """Chăm sóc tài khoản Gmail để tránh bị die"""
    
    def __init__(self):
        pass
    
    def care_account(self, driver, email):
        """Thực hiện các hành động chăm sóc tài khoản"""
        care_actions = []
        
        print(f"[Care] ========== BẮT ĐẦU CHĂM SÓC: {email} ==========")
        
        try:
            if not driver:
                print(f"[Care] ✗ Driver is None!")
                return {
                    "success": False,
                    "error": "Driver is None",
                    "actions": [],
                    "timestamp": datetime.now().isoformat()
                }
            
            driver.set_page_load_timeout(BROWSER_TIMEOUT)
            print(f"[Care] ✓ Đã set page load timeout")
            
            # Đảm bảo đang ở Gmail inbox
            print(f"[Care] Đảm bảo đang ở Gmail inbox...")
            try:
                # Kiểm tra và switch đến tab Gmail nếu có
                current_handle = driver.current_window_handle
                all_handles = driver.window_handles
                print(f"[Care] Số window/tab: {len(all_handles)}")
                
                # Tìm tab Gmail
                gmail_handle = None
                for handle in all_handles:
                    try:
                        driver.switch_to.window(handle)
                        current_url = driver.current_url
                        print(f"[Care] Tab {handle[:8]}... URL: {current_url[:80]}")
                        if "mail.google.com" in current_url:
                            gmail_handle = handle
                            print(f"[Care] ✓ Tìm thấy tab Gmail: {handle[:8]}...")
                            break
                    except Exception as e:
                        print(f"[Care] ⚠ Lỗi khi kiểm tra tab {handle[:8]}...: {e}")
                        continue
                
                # Nếu không tìm thấy tab Gmail, tạo tab mới hoặc navigate
                if not gmail_handle:
                    print(f"[Care] Không tìm thấy tab Gmail, tạo tab mới...")
                    # Tạo tab mới bằng JavaScript
                    driver.execute_script("window.open('https://mail.google.com', '_blank');")
                    time.sleep(2)
                    # Switch đến tab mới
                    all_handles = driver.window_handles
                    if len(all_handles) > 0:
                        driver.switch_to.window(all_handles[-1])
                        print(f"[Care] ✓ Đã chuyển đến tab mới")
                    else:
                        # Fallback: navigate trong tab hiện tại
                        driver.get("https://mail.google.com")
                        print(f"[Care] ✓ Đã navigate đến Gmail trong tab hiện tại")
                else:
                    # Switch đến tab Gmail
                    driver.switch_to.window(gmail_handle)
                    print(f"[Care] ✓ Đã chuyển đến tab Gmail")
                
                # Đợi trang load
                time.sleep(3)
                
                # Kiểm tra lại URL
                current_url = driver.current_url
                print(f"[Care] Current URL sau khi switch: {current_url[:80]}")
                
                if "mail.google.com" not in current_url:
                    print(f"[Care] Vẫn chưa ở Gmail, navigate lại...")
                    driver.get("https://mail.google.com")
                    time.sleep(3)
                    print(f"[Care] ✓ Đã navigate đến Gmail")
                else:
                    print(f"[Care] ✓ Đã ở Gmail inbox")
                    
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi kiểm tra/chuyển đến Gmail: {e}")
                import traceback
                traceback.print_exc()
                # Fallback: thử navigate trực tiếp
                try:
                    driver.get("https://mail.google.com")
                    time.sleep(3)
                    print(f"[Care] ✓ Fallback: Đã navigate đến Gmail")
                except Exception as e2:
                    print(f"[Care] ✗ Lỗi fallback: {e2}")
            
            # 1. Kiểm tra và đọc email mới
            print(f"[Care] Bước 1: Kiểm tra email chưa đọc...")
            try:
                unread_count = self.check_unread_emails(driver)
                print(f"[Care] Số email chưa đọc: {unread_count}")
                if unread_count > 0:
                    read_count = self.read_emails(driver, min(5, unread_count))
                    if read_count > 0:
                        care_actions.append(f"Đã đọc {read_count} email")
                        print(f"[Care] ✓ Đã đọc {read_count} email")
                else:
                    print(f"[Care] Không có email chưa đọc")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi kiểm tra/đọc email (bỏ qua): {e}")
            
            # 2. Tương tác với email (star, archive, delete)
            print(f"[Care] Bước 2: Tương tác với email...")
            try:
                interacted = self.interact_with_emails(driver)
                if interacted:
                    care_actions.append("Đã tương tác với email")
                    print(f"[Care] ✓ Đã tương tác với email")
                else:
                    print(f"[Care] Không có email nào để tương tác")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi tương tác với email (bỏ qua): {e}")
            
            # 3. Tìm kiếm email
            print(f"[Care] Bước 3: Thực hiện tìm kiếm...")
            try:
                search_success = self.search_emails(driver)
                if search_success:
                    care_actions.append("Đã thực hiện tìm kiếm")
                    print(f"[Care] ✓ Đã thực hiện tìm kiếm")
                else:
                    print(f"[Care] ⚠ Không thể thực hiện tìm kiếm (bỏ qua)")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi tìm kiếm (bỏ qua): {e}")
            
            # 4. Xem các tab khác (Sent, Drafts, etc.)
            print(f"[Care] Bước 4: Duyệt các thư mục...")
            try:
                browse_success = self.browse_folders(driver)
                if browse_success:
                    care_actions.append("Đã duyệt các thư mục")
                    print(f"[Care] ✓ Đã duyệt các thư mục")
                else:
                    print(f"[Care] ⚠ Không thể duyệt thư mục (bỏ qua)")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi duyệt thư mục (bỏ qua): {e}")
            
            # 5. Kiểm tra settings (ít khi làm để tránh spam)
            if random.random() < 0.2:  # 20% khả năng
                print(f"[Care] Bước 5: Kiểm tra settings...")
                try:
                    settings_success = self.check_account_settings(driver)
                    if settings_success:
                        care_actions.append("Đã kiểm tra settings")
                        print(f"[Care] ✓ Đã kiểm tra settings")
                except Exception as e:
                    print(f"[Care] ⚠ Lỗi khi kiểm tra settings (bỏ qua): {e}")
            else:
                print(f"[Care] Bỏ qua kiểm tra settings (random)")
            
            # 6. Tạo draft email (thay vì gửi để tránh spam)
            if random.random() < 0.3:  # 30% khả năng
                print(f"[Care] Bước 6: Tạo draft email...")
                try:
                    draft_success = self.create_draft_email(driver, email)
                    if draft_success:
                        care_actions.append("Đã tạo draft email")
                        print(f"[Care] ✓ Đã tạo draft email")
                except Exception as e:
                    print(f"[Care] ⚠ Lỗi khi tạo draft (bỏ qua): {e}")
            else:
                print(f"[Care] Bỏ qua tạo draft (random)")
            
            # 7. Tìm kiếm Google và mở Gmail (20% khả năng)
            if random.random() < 0.2:  # 20% khả năng
                print(f"[Care] Bước 7: Tìm kiếm Google và mở Gmail...")
                try:
                    google_search_success = self.search_google_and_open_gmail(driver, email)
                    if google_search_success:
                        care_actions.append("Đã tìm kiếm Google và mở Gmail")
                        print(f"[Care] ✓ Đã tìm kiếm Google và mở Gmail")
                except Exception as e:
                    print(f"[Care] ⚠ Lỗi khi tìm kiếm Google (bỏ qua): {e}")
            else:
                print(f"[Care] Bỏ qua tìm kiếm Google (random)")
            
            # 8. Mở các email ngẫu nhiên trong Gmail
            print(f"[Care] Bước 8: Mở các email ngẫu nhiên...")
            try:
                opened_count = self.open_random_emails(driver)
                if opened_count > 0:
                    care_actions.append(f"Đã mở {opened_count} email ngẫu nhiên")
                    print(f"[Care] ✓ Đã mở {opened_count} email ngẫu nhiên")
                else:
                    print(f"[Care] Không có email nào để mở")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi mở email ngẫu nhiên (bỏ qua): {e}")
            
            # 9. Các hành động random khác trong Gmail
            print(f"[Care] Bước 9: Thực hiện hành động random...")
            try:
                random_actions = self.perform_random_gmail_actions(driver)
                if random_actions:
                    care_actions.append(f"Đã thực hiện {len(random_actions)} hành động random")
                    print(f"[Care] ✓ Đã thực hiện các hành động random: {', '.join(random_actions)}")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi khi thực hiện hành động random (bỏ qua): {e}")
            
            print(f"[Care] ========== KẾT THÚC CHĂM SÓC: {email} ==========")
            print(f"[Care] Tổng số hành động: {len(care_actions)}")
            print(f"[Care] Hành động: {', '.join(care_actions) if care_actions else 'Không có'}")
            
            # Lấy cookies sau khi chăm sóc thành công
            cookies_data = None
            try:
                cookies = driver.get_cookies()
                import json
                cookies_data = json.dumps(cookies)
                print(f"[Care] ✓ Đã lấy cookies ({len(cookies)} cookies) sau khi chăm sóc")
            except Exception as e:
                print(f"[Care] ⚠ Lỗi lấy cookies: {e}")
            
            return {
                "success": True,
                "actions": care_actions,
                "cookies": cookies_data,  # Trả về cookies để lưu vào database
                "timestamp": datetime.now().isoformat()
            }
            
        except Exception as e:
            print(f"[Care] ✗✗✗ EXCEPTION trong care_account: {e} ✗✗✗")
            import traceback
            traceback.print_exc()
            return {
                "success": False,
                "error": str(e),
                "actions": care_actions,
                "timestamp": datetime.now().isoformat()
            }
    
    def check_unread_emails(self, driver):
        """Kiểm tra số email chưa đọc"""
        try:
            # Đảm bảo đang ở Gmail
            current_url = driver.current_url
            if "mail.google.com" not in current_url:
                driver.get("https://mail.google.com")
                time.sleep(3)
            
            # Tìm số email chưa đọc từ badge
            try:
                # Tìm các selector có thể chứa số email chưa đọc
                unread_selectors = [
                    ".bsU",  # Badge số
                    "[aria-label*='unread']",
                    ".T-KT",
                    ".n0"
                ]
                
                for selector in unread_selectors:
                    try:
                        elements = driver.find_elements(By.CSS_SELECTOR, selector)
                        for elem in elements:
                            text = elem.text.strip()
                            if text.isdigit():
                                return int(text)
                    except:
                        continue
                
                # Đếm email chưa đọc trong danh sách
                unread_emails = driver.find_elements(By.CSS_SELECTOR, "tr.zA.yO:not(.zE)")
                return len(unread_emails)
                
            except:
                return 0
        except:
            return 0
    
    def read_emails(self, driver, count=5):
        """Đọc email"""
        read_count = 0
        try:
            driver.get("https://mail.google.com")
            time.sleep(2)
            
            # Lấy danh sách email
            email_elements = driver.find_elements(By.CSS_SELECTOR, "tr.zA")[:count]
            
            for email_elem in email_elements:
                try:
                    # Scroll đến email
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_elem)
                    time.sleep(0.5)
                    
                    email_elem.click()
                    time.sleep(random.uniform(2, 5))  # Đọc trong 2-5 giây
                    
                    # Scroll để đọc toàn bộ
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(1)
                    
                    # Quay lại danh sách
                    driver.back()
                    time.sleep(1)
                    read_count += 1
                except Exception as e:
                    print(f"Lỗi đọc email: {e}")
                    continue
            
            return read_count
        except Exception as e:
            print(f"Lỗi đọc email: {e}")
            return read_count
    
    def create_draft_email(self, driver, email):
        """Tạo draft email (không gửi để tránh spam)"""
        try:
            driver.get("https://mail.google.com")
            time.sleep(2)
            
            # Click nút Compose
            compose_selectors = [
                "[gh='cm']",
                ".T-I.T-I-KE.L3",
                "[aria-label*='Compose']",
                ".z0"
            ]
            
            compose_button = None
            for selector in compose_selectors:
                try:
                    compose_button = WebDriverWait(driver, 5).until(
                        EC.element_to_be_clickable((By.CSS_SELECTOR, selector))
                    )
                    break
                except:
                    continue
            
            if not compose_button:
                return False
            
            compose_button.click()
            time.sleep(2)
            
            # Nhập địa chỉ email
            to_input = WebDriverWait(driver, 10).until(
                EC.presence_of_element_located((By.NAME, "to"))
            )
            to_input.send_keys(email)
            time.sleep(1)
            
            # Nhập subject
            subject_input = driver.find_element(By.NAME, "subjectbox")
            subject_input.send_keys(f"Auto draft - {datetime.now().strftime('%Y-%m-%d %H:%M')}")
            time.sleep(1)
            
            # Nhập nội dung
            body_input = driver.find_element(By.CSS_SELECTOR, "[aria-label='Message Body'], .Am")
            body_input.send_keys("Auto-generated draft to keep account active.")
            time.sleep(1)
            
            # Đóng compose window (lưu draft tự động)
            close_button = driver.find_element(By.CSS_SELECTOR, "[aria-label*='Close'], .Ha")
            close_button.click()
            time.sleep(2)
            
            return True
            
        except Exception as e:
            print(f"Lỗi tạo draft email: {e}")
            return False
    
    def interact_with_emails(self, driver):
        """Tương tác với email (star, archive, etc.)"""
        try:
            driver.get("https://mail.google.com")
            time.sleep(2)
            
            # Lấy một vài email
            email_elements = driver.find_elements(By.CSS_SELECTOR, "tr.zA")[:3]
            interacted = False
            
            for email_elem in email_elements:
                try:
                    # Hover để hiện các nút
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_elem)
                    time.sleep(0.5)
                    
                    # Star email (30% khả năng)
                    if random.random() < 0.3:
                        try:
                            star_button = email_elem.find_element(By.CSS_SELECTOR, "[aria-label*='Star'], [title*='Star']")
                            if "not starred" in star_button.get_attribute("aria-label").lower():
                                star_button.click()
                                time.sleep(0.5)
                                interacted = True
                        except:
                            pass
                    
                    # Archive email (20% khả năng)
                    if random.random() < 0.2:
                        try:
                            archive_button = email_elem.find_element(By.CSS_SELECTOR, "[aria-label*='Archive'], [title*='Archive']")
                            archive_button.click()
                            time.sleep(0.5)
                            interacted = True
                        except:
                            pass
                            
                except:
                    continue
            
            return interacted
                    
        except Exception as e:
            print(f"Lỗi tương tác với email: {e}")
            return False
    
    def check_account_settings(self, driver):
        """Kiểm tra account settings"""
        try:
            # Mở settings
            driver.get("https://myaccount.google.com/")
            time.sleep(3)
            
            # Scroll và xem các phần
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            
            # Quay lại Gmail
            driver.get("https://mail.google.com")
            time.sleep(2)
            return True
            
        except Exception as e:
            print(f"Lỗi kiểm tra settings: {e}")
            return False
    
    def search_emails(self, driver):
        """Thực hiện tìm kiếm email"""
        try:
            # Đảm bảo đang ở Gmail
            current_url = driver.current_url
            if "mail.google.com" not in current_url:
                print(f"[Care] Chuyển đến Gmail trước khi tìm kiếm...")
                driver.get("https://mail.google.com")
                time.sleep(2)
            
            # Click vào ô tìm kiếm
            search_selectors = [
                "[name='q']",
                "[aria-label*='Search']",
                ".gb_gf"
            ]
            
            search_box = None
            for selector in search_selectors:
                try:
                    search_box = WebDriverWait(driver, 5).until(
                        EC.presence_of_element_located((By.CSS_SELECTOR, selector))
                    )
                    break
                except:
                    continue
            
            if not search_box:
                return False
            
            # Tìm kiếm các từ khóa ngẫu nhiên
            keywords = ["important", "work", "newsletter", "unread", "from:me", "has:attachment"]
            keyword = random.choice(keywords)
            
            search_box.clear()
            search_box.send_keys(keyword)
            search_box.submit()
            time.sleep(3)
            
            # Quay lại inbox
            driver.get("https://mail.google.com")
            time.sleep(2)
            return True
            
        except Exception as e:
            print(f"Lỗi tìm kiếm: {e}")
            return False
    
    def browse_folders(self, driver):
        """Duyệt các thư mục khác"""
        try:
            # Đảm bảo đang ở Gmail
            current_url = driver.current_url
            if "mail.google.com" not in current_url:
                print(f"[Care] Chuyển đến Gmail trước khi duyệt thư mục...")
                driver.get("https://mail.google.com")
                time.sleep(2)
            
            folders = [
                "https://mail.google.com/mail/u/0/#sent",
                "https://mail.google.com/mail/u/0/#drafts",
                "https://mail.google.com/mail/u/0/#starred",
                "https://mail.google.com/mail/u/0/#important"
            ]
            
            folder = random.choice(folders)
            print(f"[Care] Duyệt thư mục: {folder}")
            driver.get(folder)
            wait_time = random.uniform(2, 4)
            time.sleep(wait_time)
            print(f"[Care] ✓ Đã duyệt thư mục ({wait_time:.1f}s)")
            
            # Quay lại inbox
            print(f"[Care] Quay lại inbox...")
            driver.get("https://mail.google.com")
            time.sleep(2)
            print(f"[Care] ✓ Đã quay lại inbox")
            return True
            
        except Exception as e:
            print(f"[Care] Lỗi duyệt thư mục: {e}")
            import traceback
            traceback.print_exc()
            return False
    
    def search_google_and_open_gmail(self, driver, email):
        """Tìm kiếm Google để tìm Gmail và mở link"""
        try:
            # Tìm kiếm trên Google
            search_queries = [
                "gmail login",
                "gmail sign in",
                "gmail.com",
                "google mail",
                f"gmail {email}"
            ]
            
            query = random.choice(search_queries)
            print(f"[Care] Tìm kiếm Google với từ khóa: {query}")
            
            driver.get(f"https://www.google.com/search?q={query}")
            time.sleep(random.uniform(2, 4))
            
            # Tìm và click vào link Gmail
            gmail_links = driver.find_elements(By.CSS_SELECTOR, "a[href*='mail.google.com'], a[href*='accounts.google.com']")
            
            if gmail_links:
                # Chọn link ngẫu nhiên hoặc link đầu tiên
                link = random.choice(gmail_links[:3]) if len(gmail_links) > 1 else gmail_links[0]
                
                # Scroll đến link
                driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", link)
                time.sleep(random.uniform(0.5, 1.5))
                
                # Click vào link
                link.click()
                time.sleep(random.uniform(3, 5))
                
                # Kiểm tra xem đã đến Gmail chưa
                current_url = driver.current_url
                if "mail.google.com" in current_url or "accounts.google.com" in current_url:
                    print(f"[Care] ✓ Đã mở Gmail từ Google search")
                    return True
                else:
                    # Nếu chưa đến Gmail, navigate trực tiếp
                    driver.get("https://mail.google.com")
                    time.sleep(2)
                    return True
            else:
                # Không tìm thấy link, navigate trực tiếp đến Gmail
                print(f"[Care] Không tìm thấy link Gmail, navigate trực tiếp...")
                driver.get("https://mail.google.com")
                time.sleep(2)
                return True
                
        except Exception as e:
            print(f"[Care] Lỗi khi tìm kiếm Google: {e}")
            # Fallback: navigate trực tiếp đến Gmail
            try:
                driver.get("https://mail.google.com")
                time.sleep(2)
                return True
            except:
                return False
    
    def open_random_emails(self, driver):
        """Mở các email ngẫu nhiên trong Gmail"""
        try:
            # Đảm bảo đang ở Gmail
            current_url = driver.current_url
            if "mail.google.com" not in current_url:
                driver.get("https://mail.google.com")
                time.sleep(2)
            
            # Lấy danh sách email
            email_elements = driver.find_elements(By.CSS_SELECTOR, "tr.zA")
            
            if not email_elements:
                print(f"[Care] Không tìm thấy email nào")
                return 0
            
            # Số lượng email ngẫu nhiên để mở (1-5 email)
            num_to_open = random.randint(1, min(5, len(email_elements)))
            print(f"[Care] Sẽ mở {num_to_open} email ngẫu nhiên")
            
            # Chọn email ngẫu nhiên
            selected_emails = random.sample(email_elements, num_to_open) if len(email_elements) >= num_to_open else email_elements
            
            opened_count = 0
            for email_elem in selected_emails:
                try:
                    # Scroll đến email
                    driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_elem)
                    time.sleep(random.uniform(0.5, 1.0))
                    
                    # Click để mở email
                    email_elem.click()
                    time.sleep(random.uniform(2, 5))  # Đọc email trong 2-5 giây
                    
                    # Scroll trong email để đọc
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(random.uniform(1, 2))
                    
                    # Scroll lên lại
                    driver.execute_script("window.scrollTo(0, 0);")
                    time.sleep(random.uniform(0.5, 1.0))
                    
                    # Quay lại danh sách (có thể dùng back hoặc click inbox)
                    if random.random() < 0.5:
                        driver.back()
                    else:
                        # Click vào inbox
                        try:
                            inbox_link = driver.find_element(By.CSS_SELECTOR, "a[href*='#inbox'], [aria-label*='Inbox']")
                            inbox_link.click()
                        except:
                            driver.get("https://mail.google.com")
                    
                    time.sleep(random.uniform(1, 2))
                    opened_count += 1
                    
                except Exception as e:
                    print(f"[Care] Lỗi khi mở email: {e}")
                    continue
            
            return opened_count
            
        except Exception as e:
            print(f"[Care] Lỗi khi mở email ngẫu nhiên: {e}")
            return 0
    
    def perform_random_gmail_actions(self, driver):
        """Thực hiện các hành động random trong Gmail"""
        actions_performed = []
        
        try:
            # Đảm bảo đang ở Gmail
            current_url = driver.current_url
            if "mail.google.com" not in current_url:
                driver.get("https://mail.google.com")
                time.sleep(2)
            
            # 1. Click vào các label/tab khác nhau (30% khả năng)
            if random.random() < 0.3:
                try:
                    labels = [
                        ("#sent", "Sent"),
                        ("#drafts", "Drafts"),
                        ("#starred", "Starred"),
                        ("#important", "Important"),
                        ("#spam", "Spam"),
                        ("#trash", "Trash")
                    ]
                    
                    label_url, label_name = random.choice(labels)
                    print(f"[Care] Mở label: {label_name}")
                    driver.get(f"https://mail.google.com/mail/u/0/{label_url}")
                    time.sleep(random.uniform(2, 4))
                    actions_performed.append(f"Mở {label_name}")
                    
                    # Quay lại inbox
                    driver.get("https://mail.google.com")
                    time.sleep(1)
                except Exception as e:
                    print(f"[Care] Lỗi khi mở label: {e}")
            
            # 2. Scroll ngẫu nhiên trong inbox (50% khả năng)
            if random.random() < 0.5:
                try:
                    scroll_amount = random.randint(200, 800)
                    scroll_direction = random.choice(['down', 'up'])
                    
                    if scroll_direction == 'down':
                        driver.execute_script(f"window.scrollBy(0, {scroll_amount});")
                    else:
                        driver.execute_script(f"window.scrollBy(0, -{scroll_amount});")
                    
                    time.sleep(random.uniform(1, 2))
                    actions_performed.append("Scroll inbox")
                except Exception as e:
                    print(f"[Care] Lỗi khi scroll: {e}")
            
            # 3. Hover vào các email (40% khả năng)
            if random.random() < 0.4:
                try:
                    email_elements = driver.find_elements(By.CSS_SELECTOR, "tr.zA")[:5]
                    if email_elements:
                        email_to_hover = random.choice(email_elements)
                        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_to_hover)
                        time.sleep(random.uniform(0.5, 1.5))
                        actions_performed.append("Hover email")
                except Exception as e:
                    print(f"[Care] Lỗi khi hover email: {e}")
            
            # 4. Click vào các email đã đọc (30% khả năng)
            if random.random() < 0.3:
                try:
                    # Tìm email đã đọc (không có class zE - unread)
                    read_emails = driver.find_elements(By.CSS_SELECTOR, "tr.zA.zE")
                    if read_emails:
                        email_to_click = random.choice(read_emails[:3])
                        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", email_to_click)
                        time.sleep(random.uniform(0.5, 1.0))
                        email_to_click.click()
                        time.sleep(random.uniform(2, 4))
                        actions_performed.append("Mở email đã đọc")
                        
                        # Quay lại
                        driver.back()
                        time.sleep(1)
                except Exception as e:
                    print(f"[Care] Lỗi khi click email đã đọc: {e}")
            
            # 5. Kiểm tra số lượng email (20% khả năng)
            if random.random() < 0.2:
                try:
                    # Scroll xuống để load thêm email
                    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
                    time.sleep(random.uniform(2, 3))
                    actions_performed.append("Kiểm tra số lượng email")
                except Exception as e:
                    print(f"[Care] Lỗi khi kiểm tra số lượng: {e}")
            
            return actions_performed
            
        except Exception as e:
            print(f"[Care] Lỗi khi thực hiện hành động random: {e}")
            return actions_performed
    
    def perform_daily_care(self, driver, email):
        """Thực hiện chăm sóc hàng ngày"""
        return self.care_account(driver, email)

