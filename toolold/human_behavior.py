"""
Module mô phỏng hành vi con người khi tương tác với trình duyệt
"""
import random
import time
from selenium.webdriver.common.action_chains import ActionChains
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait


class HumanBehavior:
    """Mô phỏng hành vi con người khi tương tác với trình duyệt"""
    
    @staticmethod
    def random_delay(min_seconds=0.5, max_seconds=2.0):
        """Delay ngẫu nhiên giữa các hành động"""
        delay = random.uniform(min_seconds, max_seconds)
        time.sleep(delay)
        return delay
    
    @staticmethod
    def human_type(element, text, typing_speed_min=0.05, typing_speed_max=0.3):
        """Gõ phím giống người thật - từng ký tự với delay ngẫu nhiên"""
        element.clear()
        time.sleep(random.uniform(0.2, 0.5))  # Pause trước khi gõ
        
        for char in text:
            element.send_keys(char)
            # Delay ngẫu nhiên giữa các ký tự (giống người gõ)
            delay = random.uniform(typing_speed_min, typing_speed_max)
            time.sleep(delay)
        
        # Pause sau khi gõ xong
        time.sleep(random.uniform(0.3, 0.8))
    
    @staticmethod
    def human_click(driver, element, move_mouse=True):
        """Click giống người thật - có thể di chuyển chuột trước"""
        try:
            if move_mouse:
                # Di chuyển chuột đến element trước khi click
                actions = ActionChains(driver)
                actions.move_to_element(element)
                # Pause ngẫu nhiên trước khi click
                HumanBehavior.random_delay(0.2, 0.5)
                actions.click()
                actions.perform()
            else:
                # Click trực tiếp nhưng vẫn có delay
                HumanBehavior.random_delay(0.1, 0.3)
                element.click()
            
            # Delay sau khi click
            HumanBehavior.random_delay(0.3, 0.8)
            return True
        except Exception as e:
            print(f"[HumanBehavior] Lỗi click: {e}")
            return False
    
    @staticmethod
    def random_mouse_movement(driver, element=None):
        """Di chuyển chuột ngẫu nhiên (giống người đang xem trang)"""
        try:
            actions = ActionChains(driver)
            
            if element:
                # Di chuyển đến element
                actions.move_to_element(element)
            else:
                # Di chuyển ngẫu nhiên trong viewport
                viewport_width = driver.execute_script("return window.innerWidth")
                viewport_height = driver.execute_script("return window.innerHeight")
                
                x = random.randint(100, viewport_width - 100)
                y = random.randint(100, viewport_height - 100)
                actions.move_by_offset(x, y)
            
            actions.perform()
            HumanBehavior.random_delay(0.2, 0.5)
        except Exception as e:
            # Bỏ qua lỗi mouse movement
            pass
    
    @staticmethod
    def human_scroll(driver, direction='down', amount=None):
        """Scroll giống người thật"""
        try:
            if amount is None:
                amount = random.randint(200, 500)
            
            if direction == 'down':
                scroll_amount = amount
            else:
                scroll_amount = -amount
            
            # Scroll mượt mà với nhiều bước nhỏ
            steps = random.randint(3, 6)
            step_size = scroll_amount // steps
            
            for _ in range(steps):
                driver.execute_script(f"window.scrollBy(0, {step_size});")
                HumanBehavior.random_delay(0.1, 0.2)
            
            # Pause sau khi scroll
            HumanBehavior.random_delay(0.5, 1.0)
        except Exception as e:
            print(f"[HumanBehavior] Lỗi scroll: {e}")
    
    @staticmethod
    def random_pause(min_seconds=1.0, max_seconds=3.0):
        """Pause ngẫu nhiên (giống người đang suy nghĩ/đọc)"""
        pause_time = random.uniform(min_seconds, max_seconds)
        time.sleep(pause_time)
        return pause_time
    
    @staticmethod
    def simulate_reading(driver, duration_min=2.0, duration_max=5.0):
        """Mô phỏng người đang đọc trang"""
        duration = random.uniform(duration_min, duration_max)
        
        # Có thể scroll nhẹ trong lúc đọc
        scroll_chance = random.random()
        if scroll_chance > 0.5:
            HumanBehavior.human_scroll(driver, 'down', random.randint(100, 300))
        
        time.sleep(duration)
    
    @staticmethod
    def wait_for_page_load(driver, timeout=30):
        """Đợi trang load với behavior giống người"""
        try:
            # Đợi document ready
            WebDriverWait(driver, timeout).until(
                lambda d: d.execute_script("return document.readyState") == "complete"
            )
            
            # Pause ngẫu nhiên sau khi load (giống người đang xem)
            HumanBehavior.random_delay(1.0, 2.5)
            
            # Có thể scroll nhẹ để "xem" trang
            if random.random() > 0.3:
                HumanBehavior.human_scroll(driver, 'down', random.randint(50, 150))
            
            return True
        except Exception as e:
            print(f"[HumanBehavior] Timeout đợi trang load: {e}")
            return False

