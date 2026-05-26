import tkinter as tk
from tkinter import ttk, messagebox, scrolledtext
import threading
import schedule
import time
from datetime import datetime
from database import Database
from gmail_monitor import GmailMonitor
from gpmlogin_manager import GPMLoginManager
from config import CHECK_INTERVAL_MINUTES

class GmailManagerApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Quản lý Gmail với GPMLogin")
        self.root.geometry("1200x800")
        
        self.db = Database()
        self.monitor = GmailMonitor()
        self.gpm_manager = GPMLoginManager()
        self.monitoring = False
        
        self.create_widgets()
        self.load_accounts()
        
        # Lên lịch kiểm tra tự động
        schedule.every(CHECK_INTERVAL_MINUTES).minutes.do(self.auto_check)
        self.start_scheduler()
    
    def create_widgets(self):
        # Frame chính
        main_frame = ttk.Frame(self.root, padding="10")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        
        # Frame thêm tài khoản
        add_frame = ttk.LabelFrame(main_frame, text="Thêm tài khoản mới", padding="10")
        add_frame.grid(row=0, column=0, columnspan=2, sticky=(tk.W, tk.E), pady=5)
        
        ttk.Label(add_frame, text="Email:").grid(row=0, column=0, padx=5)
        self.email_entry = ttk.Entry(add_frame, width=30)
        self.email_entry.grid(row=0, column=1, padx=5)
        
        ttk.Label(add_frame, text="Password:").grid(row=0, column=2, padx=5)
        self.password_entry = ttk.Entry(add_frame, width=30, show="*")
        self.password_entry.grid(row=0, column=3, padx=5)
        
        ttk.Label(add_frame, text="GPMLogin Profile ID:").grid(row=1, column=0, padx=5, pady=5)
        self.profile_entry = ttk.Entry(add_frame, width=30)
        self.profile_entry.grid(row=1, column=1, padx=5, pady=5)
        
        ttk.Button(add_frame, text="Lấy danh sách Profiles", command=self.load_gpmlogin_profiles).grid(row=1, column=2, padx=5)
        
        ttk.Label(add_frame, text="Ghi chú:").grid(row=1, column=3, padx=5)
        self.notes_entry = ttk.Entry(add_frame, width=30)
        self.notes_entry.grid(row=1, column=4, padx=5)
        
        ttk.Button(add_frame, text="Thêm tài khoản", command=self.add_account).grid(row=2, column=0, columnspan=5, pady=10)
        
        # Frame danh sách tài khoản
        list_frame = ttk.LabelFrame(main_frame, text="Danh sách tài khoản", padding="10")
        list_frame.grid(row=1, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        # Treeview
        columns = ("ID", "Email", "Status", "Last Check", "Last Login", "Last Care", "Profile ID", "Notes")
        self.tree = ttk.Treeview(list_frame, columns=columns, show="headings", height=12)
        
        column_widths = {
            "ID": 50,
            "Email": 200,
            "Status": 100,
            "Last Check": 150,
            "Last Login": 150,
            "Last Care": 150,
            "Profile ID": 150,
            "Notes": 150
        }
        
        for col in columns:
            self.tree.heading(col, text=col)
            self.tree.column(col, width=column_widths.get(col, 100))
        
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.tree.configure(yscrollcommand=scrollbar.set)
        
        self.tree.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        
        # Frame nút điều khiển
        control_frame = ttk.Frame(main_frame)
        control_frame.grid(row=2, column=0, columnspan=2, pady=5)
        
        ttk.Button(control_frame, text="Kiểm tra tất cả", command=self.check_all).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Kiểm tra đã chọn", command=self.check_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Chăm sóc đã chọn", command=self.care_selected).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Xóa tài khoản", command=self.delete_account).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Xem logs", command=self.show_logs).pack(side=tk.LEFT, padx=5)
        ttk.Button(control_frame, text="Thống kê", command=self.show_statistics).pack(side=tk.LEFT, padx=5)
        
        # Frame log
        log_frame = ttk.LabelFrame(main_frame, text="Logs", padding="10")
        log_frame.grid(row=3, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5)
        
        self.log_text = scrolledtext.ScrolledText(log_frame, height=8, width=100)
        self.log_text.pack(fill=tk.BOTH, expand=True)
        
        # Cấu hình grid weights
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(0, weight=1)
        main_frame.rowconfigure(1, weight=1)
        list_frame.columnconfigure(0, weight=1)
        list_frame.rowconfigure(0, weight=1)
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
    
    def log(self, message):
        """Thêm log vào text widget"""
        self.log_text.insert(tk.END, f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {message}\n")
        self.log_text.see(tk.END)
        self.root.update()
    
    def load_gpmlogin_profiles(self):
        """Lấy danh sách profiles từ GPMLogin"""
        def load_profiles():
            self.log("Đang lấy danh sách GPMLogin profiles...")
            try:
                profiles = self.gpm_manager.get_profiles(per_page=100)
                if profiles:
                    # Hiển thị dialog để chọn profile
                    self.show_profile_selection(profiles)
                    self.log(f"Đã tải {len(profiles)} profiles")
                else:
                    messagebox.showwarning("Cảnh báo", "Không tìm thấy profiles hoặc không kết nối được GPMLogin API")
                    self.log("Không tìm thấy profiles")
            except Exception as e:
                messagebox.showerror("Lỗi", f"Lỗi kết nối GPMLogin: {e}")
                self.log(f"Lỗi: {e}")
        
        threading.Thread(target=load_profiles, daemon=True).start()
    
    def show_profile_selection(self, profiles):
        """Hiển thị dialog chọn profile"""
        dialog = tk.Toplevel(self.root)
        dialog.title("Chọn GPMLogin Profile")
        dialog.geometry("600x400")
        
        # Treeview cho profiles
        columns = ("ID", "Name", "Browser", "Group", "Created")
        tree = ttk.Treeview(dialog, columns=columns, show="headings", height=15)
        
        for col in columns:
            tree.heading(col, text=col)
            tree.column(col, width=120)
        
        for profile in profiles:
            tree.insert("", tk.END, values=(
                profile.get("id", ""),
                profile.get("name", ""),
                profile.get("browser_type", ""),
                profile.get("group_id", ""),
                profile.get("created_at", "")
            ))
        
        tree.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        def select_profile():
            selection = tree.selection()
            if selection:
                item = tree.item(selection[0])
                profile_id = item["values"][0]
                profile_name = item["values"][1]
                self.profile_entry.delete(0, tk.END)
                self.profile_entry.insert(0, profile_id)
                dialog.destroy()
        
        ttk.Button(dialog, text="Chọn", command=select_profile).pack(pady=5)
    
    def add_account(self):
        email = self.email_entry.get()
        password = self.password_entry.get()
        profile_id = self.profile_entry.get() or None
        notes = self.notes_entry.get()
        
        if not email:
            messagebox.showerror("Lỗi", "Vui lòng nhập email")
            return
        
        account_id = self.db.add_account(email, password, profile_id, None, notes)
        if account_id:
            messagebox.showinfo("Thành công", "Đã thêm tài khoản")
            self.email_entry.delete(0, tk.END)
            self.password_entry.delete(0, tk.END)
            self.profile_entry.delete(0, tk.END)
            self.notes_entry.delete(0, tk.END)
            self.load_accounts()
            self.log(f"Đã thêm tài khoản: {email}")
        else:
            messagebox.showerror("Lỗi", "Email đã tồn tại")
    
    def load_accounts(self):
        """Tải danh sách tài khoản"""
        for item in self.tree.get_children():
            self.tree.delete(item)
        
        accounts = self.db.get_all_accounts()
        for account in accounts:
            self.tree.insert("", tk.END, values=(
                account["id"],
                account["email"],
                account["status"] or "unknown",
                str(account["last_check"])[:19] if account["last_check"] else "Chưa kiểm tra",
                str(account["last_login"])[:19] if account["last_login"] else "Chưa đăng nhập",
                str(account["last_care"])[:19] if account["last_care"] else "Chưa chăm sóc",
                account["gpmlogin_profile_id"] or "-",
                account["notes"] or ""
            ), tags=(account["id"],))
    
    def check_all(self):
        """Kiểm tra tất cả tài khoản"""
        def run_check():
            self.log("Bắt đầu kiểm tra tất cả tài khoản...")
            self.monitor.check_all_accounts()
            self.log("Hoàn thành kiểm tra")
            self.load_accounts()
        
        threading.Thread(target=run_check, daemon=True).start()
    
    def check_selected(self):
        """Kiểm tra tài khoản đã chọn"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn tài khoản")
            return
        
        def run_check():
            for item in selection:
                account_id = int(self.tree.item(item, "tags")[0])
                account = self.db.get_account_by_id(account_id)
                if account:
                    self.log(f"Kiểm tra: {account['email']}")
                    self.monitor.check_account(account)
            self.load_accounts()
        
        threading.Thread(target=run_check, daemon=True).start()
    
    def care_selected(self):
        """Chăm sóc tài khoản đã chọn"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn tài khoản")
            return
        
        def run_care():
            from gmail_care import GmailCare
            care = GmailCare()
            
            for item in selection:
                account_id = int(self.tree.item(item, "tags")[0])
                account = self.db.get_account_by_id(account_id)
                if account:
                    profile_id = account.get("gpmlogin_profile_id")
                    if not profile_id:
                        self.log(f"Bỏ qua {account['email']}: Chưa có GPMLogin profile")
                        continue
                    
                    # Truyền account_data để inject cookies nếu có
                    driver = self.gpm_manager.connect_to_profile(profile_id, account_data=account)
                    if driver:
                        self.log(f"Chăm sóc: {account['email']}")
                        result = care.perform_daily_care(driver, account["email"])
                        if result["success"]:
                            self.db.update_last_care(account["email"])
                            self.log(f"  ✓ {', '.join(result['actions'])}")
                        else:
                            self.log(f"  ✗ Lỗi: {result.get('error')}")
            
            self.load_accounts()
        
        threading.Thread(target=run_care, daemon=True).start()
    
    def delete_account(self):
        """Xóa tài khoản"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn tài khoản")
            return
        
        if messagebox.askyesno("Xác nhận", "Bạn có chắc muốn xóa tài khoản này?"):
            for item in selection:
                account_id = int(self.tree.item(item, "tags")[0])
                if self.db.delete_account(account_id):
                    self.log(f"Đã xóa tài khoản ID: {account_id}")
            self.load_accounts()
    
    def show_logs(self):
        """Hiển thị logs"""
        selection = self.tree.selection()
        if not selection:
            messagebox.showwarning("Cảnh báo", "Vui lòng chọn tài khoản")
            return
        
        account_id = int(self.tree.item(selection[0], "tags")[0])
        logs = self.db.get_logs(account_id, limit=100)
        
        log_window = tk.Toplevel(self.root)
        log_window.title("Logs")
        log_window.geometry("900x500")
        
        log_text = scrolledtext.ScrolledText(log_window, width=100, height=25)
        log_text.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        for log in logs:
            timestamp = log["timestamp"]
            event_type = log["event_type"]
            message = log["message"]
            log_text.insert(tk.END, f"[{timestamp}] {event_type}: {message}\n")
    
    def show_statistics(self):
        """Hiển thị thống kê"""
        stats = self.monitor.get_statistics()
        
        stats_window = tk.Toplevel(self.root)
        stats_window.title("Thống kê")
        stats_window.geometry("400x300")
        
        stats_frame = ttk.Frame(stats_window, padding="20")
        stats_frame.pack(fill=tk.BOTH, expand=True)
        
        ttk.Label(stats_frame, text="Thống kê tài khoản", font=("Arial", 16, "bold")).pack(pady=10)
        
        ttk.Label(stats_frame, text=f"Tổng số: {stats['total']}").pack(pady=5)
        ttk.Label(stats_frame, text=f"Hoạt động: {stats['active']}", foreground="green").pack(pady=5)
        ttk.Label(stats_frame, text=f"Đã đăng xuất: {stats['logged_out']}", foreground="orange").pack(pady=5)
        ttk.Label(stats_frame, text=f"Lỗi đăng nhập: {stats['login_failed']}", foreground="red").pack(pady=5)
        ttk.Label(stats_frame, text=f"Sai tài khoản: {stats['wrong_account']}", foreground="orange").pack(pady=5)
        ttk.Label(stats_frame, text=f"Lỗi: {stats['error']}", foreground="red").pack(pady=5)
    
    def auto_check(self):
        """Kiểm tra tự động"""
        if not self.monitoring:
            return
        self.log("Kiểm tra tự động...")
        self.check_all()
    
    def start_scheduler(self):
        """Chạy scheduler trong thread riêng"""
        def run_scheduler():
            while True:
                schedule.run_pending()
                time.sleep(1)
        
        threading.Thread(target=run_scheduler, daemon=True).start()
        self.monitoring = True

if __name__ == "__main__":
    root = tk.Tk()
    app = GmailManagerApp(root)
    root.mainloop()

