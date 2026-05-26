const API_BASE = '/api';

// Global state
let accounts = [];
let selectedAccounts = new Set();
let currentTaskId = null;
let gpmManagerActiveProfiles = [];
let allProfiles = []; // Lưu tất cả profiles để filter

// Mobile Menu Toggle
function toggleMobileMenu() {
    const headerActions = document.getElementById('headerActions');
    if (headerActions) {
        headerActions.classList.toggle('mobile-active');
    }
}

// Close mobile menu when clicking outside
document.addEventListener('click', function(event) {
    const headerActions = document.getElementById('headerActions');
    const menuToggle = document.querySelector('.mobile-menu-toggle');
    if (headerActions && menuToggle && 
        !headerActions.contains(event.target) && 
        !menuToggle.contains(event.target) &&
        window.innerWidth <= 768) {
        headerActions.classList.remove('mobile-active');
    }
});

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    refreshData();
    setInterval(refreshData, 30000); // Auto refresh every 30 seconds
    
    // Close mobile menu on window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            const headerActions = document.getElementById('headerActions');
            if (headerActions) {
                headerActions.classList.remove('mobile-active');
            }
        }
    });
});

// API Functions
async function apiCall(endpoint, method = 'GET', data = null) {
    try {
        const options = {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };
        
        if (data) {
            options.body = JSON.stringify(data);
        }
        
        const response = await fetch(`${API_BASE}${endpoint}`, options);
        const result = await response.json();
        
        // Chỉ throw error nếu có error và không phải là response hợp lệ từ proxy check
        // (proxy check có thể trả về success=true nhưng status=false)
        if (!response.ok || (result.error && !result.success && !result.hasOwnProperty('status'))) {
            throw new Error(result.error || `HTTP ${response.status}`);
        }
        
        return result;
    } catch (error) {
        console.error('API Error:', error);
        // Không show notification ở đây vì các function gọi sẽ tự xử lý
        throw error;
    }
}

// Refresh Data
async function refreshData() {
    try {
        // Load stats
        const statsResult = await apiCall('/stats');
        updateStats(statsResult.stats);
        
        // Load accounts
        const accountsResult = await apiCall('/accounts');
        accounts = accountsResult.accounts;
        updateAccountsTable(accounts);
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = 
            `Cập nhật lần cuối: ${new Date().toLocaleString('vi-VN')}`;
    } catch (error) {
        console.error('Error refreshing data:', error);
    }
}

// Update Statistics
function updateStats(stats) {
    document.getElementById('statTotal').textContent = stats.total || 0;
    document.getElementById('statActive').textContent = stats.active || 0;
    document.getElementById('statLoggedOut').textContent = stats.loggedOut || 0;
    document.getElementById('statErrors').textContent = 
        (stats.errors || 0) + (stats.loginFailed || 0) + (stats.wrongAccount || 0);
}

// Update Accounts Table
function updateAccountsTable(accountsData) {
    const tbody = document.getElementById('accountsTableBody');
    const tableContainer = tbody?.closest('.table-container');
    
    if (!accountsData || accountsData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="10" class="loading">Chưa có tài khoản nào</td></tr>';
        // Clear mobile view
        const mobileView = tableContainer?.querySelector('.table-mobile-view');
        if (mobileView) {
            mobileView.innerHTML = '<div class="loading">Chưa có tài khoản nào</div>';
        }
        return;
    }
    
    // Desktop table view
    tbody.innerHTML = accountsData.map(account => {
        const isSelected = selectedAccounts.has(account.id);
        return `
            <tr>
                <td>
                    <input type="checkbox" 
                           ${isSelected ? 'checked' : ''} 
                           onchange="toggleAccountSelection(${account.id})">
                </td>
                <td>${account.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span>${account.email || '-'}</span>
                        <button class="btn-icon" onclick="copyToClipboard('${(account.email || '').replace(/'/g, "\\'")}', 'Email')" title="Copy email">
                            📋
                        </button>
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${getStatusClass(account.status)}">
                        ${getStatusText(account.status)}
                    </span>
                </td>
                <td>${account.gpmlogin_profile_id || '-'}</td>
                <td>
                    ${account.proxy_info ? `<span title="${account.proxy_info}">${account.proxy_info.length > 30 ? account.proxy_info.substring(0, 30) + '...' : account.proxy_info}</span>` : '-'}
                </td>
                <td>${formatDate(account.last_check)}</td>
                <td>${formatDate(account.last_login)}</td>
                <td>${formatDate(account.last_care)}</td>
                <td>
                    <div class="action-buttons">
                        <button class="action-btn btn-warning" onclick="editAccount(${account.id})" title="Chỉnh sửa">
                            ✏️
                        </button>
                        <button class="action-btn btn-primary" onclick="checkAccount(${account.id})" title="Kiểm tra">
                            🔍
                        </button>
                        <button class="action-btn btn-info" onclick="careAccount(${account.id})" title="Chăm sóc">
                            💚
                        </button>
                        <button class="action-btn btn-secondary" onclick="viewLogs(${account.id})" title="Xem logs">
                            📋
                        </button>
                        <button class="action-btn btn-danger" onclick="deleteAccount(${account.id})" title="Xóa">
                            🗑️
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Mobile card view
    if (tableContainer) {
        let mobileView = tableContainer.querySelector('.table-mobile-view');
        if (!mobileView) {
            mobileView = document.createElement('div');
            mobileView.className = 'table-mobile-view';
            tableContainer.appendChild(mobileView);
        }
        
        mobileView.innerHTML = accountsData.map(account => {
            const isSelected = selectedAccounts.has(account.id);
            return `
                <div class="table-mobile-card">
                    <div class="table-mobile-card-header">
                        <div class="table-mobile-card-title">${account.email || 'N/A'}</div>
                        <input type="checkbox" 
                               ${isSelected ? 'checked' : ''} 
                               onchange="toggleAccountSelection(${account.id})">
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">ID:</span>
                        <span class="table-mobile-card-value">${account.id}</span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Trạng thái:</span>
                        <span class="table-mobile-card-value">
                            <span class="status-badge status-${getStatusClass(account.status)}">
                                ${getStatusText(account.status)}
                            </span>
                        </span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Profile ID:</span>
                        <span class="table-mobile-card-value">${account.gpmlogin_profile_id || '-'}</span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Proxy:</span>
                        <span class="table-mobile-card-value">${account.proxy_info || '-'}</span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Kiểm tra cuối:</span>
                        <span class="table-mobile-card-value">${formatDate(account.last_check)}</span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Đăng nhập cuối:</span>
                        <span class="table-mobile-card-value">${formatDate(account.last_login)}</span>
                    </div>
                    <div class="table-mobile-card-row">
                        <span class="table-mobile-card-label">Chăm sóc cuối:</span>
                        <span class="table-mobile-card-value">${formatDate(account.last_care)}</span>
                    </div>
                    <div class="table-mobile-card-actions">
                        <button class="btn btn-sm btn-warning" onclick="editAccount(${account.id})">✏️ Sửa</button>
                        <button class="btn btn-sm btn-primary" onclick="checkAccount(${account.id})">🔍 Kiểm tra</button>
                        <button class="btn btn-sm btn-info" onclick="careAccount(${account.id})">💚 Chăm sóc</button>
                        <button class="btn btn-sm btn-secondary" onclick="viewLogs(${account.id})">📋 Logs</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteAccount(${account.id})">🗑️ Xóa</button>
                    </div>
                </div>
            `;
        }).join('');
    }
}

// Account Selection
function toggleAccountSelection(accountId) {
    if (selectedAccounts.has(accountId)) {
        selectedAccounts.delete(accountId);
    } else {
        selectedAccounts.add(accountId);
    }
    updateSelectAllCheckbox();
}

function toggleSelectAll() {
    const selectAll = document.getElementById('selectAll').checked;
    selectedAccounts.clear();
    
    if (selectAll) {
        accounts.forEach(account => selectedAccounts.add(account.id));
    }
    
    updateAccountsTable(accounts);
}

function updateSelectAllCheckbox() {
    const selectAll = document.getElementById('selectAll');
    selectAll.checked = selectedAccounts.size === accounts.length && accounts.length > 0;
}

// Account Actions
async function checkAccount(accountId) {
    try {
        showNotification('Đang kiểm tra tài khoản...', 'info');
        await apiCall(`/accounts/${accountId}/check`, 'POST');
        showNotification('Đã bắt đầu kiểm tra', 'success');
        setTimeout(refreshData, 2000);
    } catch (error) {
        showNotification('Lỗi kiểm tra: ' + error.message, 'error');
    }
}

async function checkAllAccounts() {
    if (!confirm('Bạn có chắc muốn kiểm tra tất cả tài khoản?')) {
        return;
    }
    
    try {
        showNotification('Đang kiểm tra tất cả tài khoản...', 'info');
        await apiCall('/accounts/check-all', 'POST');
        showNotification('Đã bắt đầu kiểm tra tất cả', 'success');
        setTimeout(refreshData, 2000);
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

async function careAccount(accountId) {
    try {
        showNotification('Đang chăm sóc tài khoản...', 'info');
        await apiCall(`/accounts/${accountId}/care`, 'POST');
        showNotification('Đã bắt đầu chăm sóc', 'success');
        setTimeout(refreshData, 3000);
    } catch (error) {
        showNotification('Lỗi chăm sóc: ' + error.message, 'error');
    }
}

async function careSelectedAccounts() {
    if (selectedAccounts.size === 0) {
        showNotification('Vui lòng chọn ít nhất một tài khoản', 'warning');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn chăm sóc ${selectedAccounts.size} tài khoản đã chọn?`)) {
        return;
    }
    
    const maxThreads = parseInt(document.getElementById('maxThreads').value) || 3;
    
    try {
        showNotification(`Đang chăm sóc ${selectedAccounts.size} tài khoản (${maxThreads} luồng)...`, 'info');
        
        // Gửi request với số luồng
        const selected = Array.from(selectedAccounts);
        const result = await apiCall('/accounts/care-selected', 'POST', {
            account_ids: selected,
            max_threads: maxThreads
        });
        
        // Lưu task_id để có thể dừng
        if (result.task_id) {
            currentTaskId = result.task_id;
            document.getElementById('stopTaskBtn').style.display = 'inline-block';
        }
        
        showNotification('Đã bắt đầu chăm sóc tất cả', 'success');
        setTimeout(refreshData, 3000);
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

async function stopCurrentTask() {
    if (!currentTaskId) {
        showNotification('Không có task nào đang chạy', 'warning');
        return;
    }
    
    if (!confirm('Bạn có chắc muốn dừng task đang chạy?')) {
        return;
    }
    
    try {
        await apiCall(`/tasks/stop/${currentTaskId}`, 'POST');
        showNotification('Đã dừng task', 'success');
        currentTaskId = null;
        document.getElementById('stopTaskBtn').style.display = 'none';
        setTimeout(refreshData, 2000);
    } catch (error) {
        showNotification('Lỗi dừng task: ' + error.message, 'error');
    }
}

async function deleteAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!confirm(`Bạn có chắc muốn xóa tài khoản ${account.email}?\n\nLưu ý: Profile GPMLogin sẽ được chuyển vào thùng rác, không bị xóa ngay.`)) {
        return;
    }
    
    try {
        const result = await apiCall(`/accounts/${accountId}`, 'DELETE');
        showNotification('Đã xóa tài khoản. Profile đã chuyển vào thùng rác.', 'success');
        selectedAccounts.delete(accountId);
        refreshData();
    } catch (error) {
        showNotification('Lỗi xóa: ' + error.message, 'error');
    }
}

async function viewLogs(accountId) {
    try {
        const result = await apiCall(`/logs/${accountId}?limit=100`);
        showLogsModal(result.logs);
    } catch (error) {
        showNotification('Lỗi tải logs: ' + error.message, 'error');
    }
}

// Add Account Modal
function showAddAccountModal() {
    document.getElementById('addAccountModal').style.display = 'block';
}

// Show Add Account Modal từ Profile Manager (giữ modal profile mở)
function showAddAccountModalFromProfileManager() {
    const addAccountModal = document.getElementById('addAccountModal');
    const profileManagerModal = document.getElementById('profileManagerModal');
    
    // Đảm bảo modal thêm tài khoản có z-index cao hơn modal quản lý profile
    if (addAccountModal) {
        addAccountModal.style.display = 'block';
        addAccountModal.classList.add('modal-overlay-high');
    }
}

function closeAddAccountModal() {
    const addAccountModal = document.getElementById('addAccountModal');
    if (addAccountModal) {
        addAccountModal.style.display = 'none';
        addAccountModal.classList.remove('modal-overlay-high');
    }
    document.getElementById('addAccountForm').reset();
}

async function addAccount(event) {
    event.preventDefault();
    
    const email = document.getElementById('accountEmail').value;
    const password = document.getElementById('accountPassword').value;
    const profileId = document.getElementById('accountProfileId').value;
    const proxy = document.getElementById('accountProxy').value;
    const proxyApiUrl = document.getElementById('accountProxyApiUrl')?.value || '';
    const autoChangeProxy = document.getElementById('autoChangeProxy')?.checked || false;
    const autoCreateProfile = document.getElementById('autoCreateProfile').checked;
    const autoAssignProxy = document.getElementById('autoAssignProxy').checked;
    const notes = document.getElementById('accountNotes').value;
    
    try {
        showNotification('Đang thêm tài khoản và tạo profile...', 'info');
        const result = await apiCall('/accounts', 'POST', {
            email: email,
            password: password,
            gpmlogin_profile_id: profileId || null,
            proxy: proxy || null,
            proxy_api_url: proxyApiUrl || null,
            auto_change_proxy: autoChangeProxy,
            auto_create_profile: autoCreateProfile,
            auto_assign_proxy: autoAssignProxy,
            notes: notes
        });
        
        if (result.success) {
            let message = 'Đã thêm tài khoản thành công';
            if (result.profile_id) {
                message += `\nProfile ID: ${result.profile_id}`;
            }
            if (result.proxy) {
                message += `\nProxy: ${result.proxy}`;
            }
            showNotification(message, 'success');
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
        
        closeAddAccountModal();
        refreshData();
    } catch (error) {
        showNotification('Lỗi thêm tài khoản: ' + error.message, 'error');
    }
}

function toggleAutoCreate() {
    const autoCreate = document.getElementById('autoCreateProfile').checked;
    document.getElementById('profileSection').style.display = autoCreate ? 'none' : 'block';
}

function toggleAutoProxy() {
    const autoProxy = document.getElementById('autoAssignProxy').checked;
    document.getElementById('proxySection').style.display = autoProxy ? 'none' : 'block';
}

async function loadProxies() {
    document.getElementById('profilesModal').style.display = 'block';
    document.querySelector('#profilesModal .modal-header h2').textContent = 'Chọn Proxy';
    const tbody = document.getElementById('profilesTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Đang tải...</td></tr>';
    
    try {
        const result = await apiCall('/proxies');
        const proxies = result.proxies;
        
        if (proxies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Không có proxy nào. Thêm proxy vào file proxies.txt hoặc qua API.</td></tr>';
            return;
        }
        
        // Update table headers for proxies
        const thead = document.querySelector('#profilesTable thead tr');
        thead.innerHTML = '<th>Proxy</th><th>Type</th><th>Host:Port</th><th>Thao tác</th>';
        
        tbody.innerHTML = proxies.map((proxy, index) => `
            <tr>
                <td>${proxy.raw || '-'}</td>
                <td>${proxy.type || 'http'}</td>
                <td>${proxy.host || '-'}:${proxy.port || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectProxy('${proxy.raw || ''}')">
                        Chọn
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading" style="color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

function selectProxy(proxyString) {
    document.getElementById('accountProxy').value = proxyString;
    closeProfilesModal();
}

// GPMLogin Profiles Modal
async function loadGPMLoginProfiles() {
    document.getElementById('profilesModal').style.display = 'block';
    const tbody = document.getElementById('profilesTableBody');
    tbody.innerHTML = '<tr><td colspan="4" class="loading">Đang tải...</td></tr>';
    
    try {
        const result = await apiCall('/gpmlogin/profiles');
        const profiles = result.profiles;
        
        if (profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Không tìm thấy profiles</td></tr>';
            return;
        }
        
        tbody.innerHTML = profiles.map(profile => `
            <tr>
                <td>${profile.id || '-'}</td>
                <td>${profile.name || '-'}</td>
                <td>${profile.browser_type || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectProfile('${profile.id}', '${profile.name || ''}')">
                        Chọn
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" class="loading" style="color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

function selectProfile(profileId, profileName) {
    document.getElementById('accountProfileId').value = profileId;
    closeProfilesModal();
}

function closeProfilesModal() {
    const modal = document.getElementById('profilesModal');
    modal.style.display = 'none';
    // Xóa class modal-overlay-high khi đóng
    modal.classList.remove('modal-overlay-high');
}

// Logs Modal
function showLogsModal(logs) {
    const container = document.getElementById('logsContainer');
    
    if (!logs || logs.length === 0) {
        container.innerHTML = '<div class="loading">Chưa có logs</div>';
    } else {
        container.innerHTML = logs.map(log => {
            const logClass = getLogClass(log.event_type);
            return `
                <div class="log-entry ${logClass}">
                    <strong>[${formatDateTime(log.timestamp)}]</strong> 
                    ${log.event_type}: ${log.message}
                </div>
            `;
        }).join('');
    }
    
    document.getElementById('logsModal').style.display = 'block';
}

function closeLogsModal() {
    document.getElementById('logsModal').style.display = 'none';
}

// Utility Functions
function getStatusClass(status) {
    const statusMap = {
        'active': 'active',
        'logged_out': 'logged-out',
        'login_failed': 'login-failed',
        'wrong_account': 'wrong-account',
        'error': 'error'
    };
    return statusMap[status] || 'unknown';
}

function getStatusText(status) {
    const statusMap = {
        'active': 'Hoạt động',
        'logged_out': 'Đã đăng xuất',
        'login_failed': 'Lỗi đăng nhập',
        'wrong_account': 'Sai tài khoản',
        'error': 'Lỗi',
        'unknown': 'Chưa xác định'
    };
    return statusMap[status] || status;
}

function formatDate(dateStr) {
    if (!dateStr) return 'Chưa có';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN');
    } catch {
        return dateStr;
    }
}

function formatDateTime(dateStr) {
    if (!dateStr) return '';
    try {
        const date = new Date(dateStr);
        return date.toLocaleString('vi-VN');
    } catch {
        return dateStr;
    }
}

function getLogClass(eventType) {
    if (eventType.includes('error') || eventType.includes('failed')) return 'error';
    if (eventType.includes('success')) return 'success';
    if (eventType.includes('warning')) return 'warning';
    return '';
}

// Notification
function showNotification(message, type = 'info') {
    // Simple notification - can be enhanced with a proper notification library
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#10b981' : '#667eea'};
        color: white;
        border-radius: 5px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        z-index: 10000;
        animation: slideIn 0.3s;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Proxy Manager
let proxies = [];

function showProxyManager() {
    document.getElementById('proxyManagerModal').style.display = 'block';
    loadProxiesList();
}

function closeProxyManager() {
    document.getElementById('proxyManagerModal').style.display = 'none';
}

async function loadProxiesList() {
    const tbody = document.getElementById('proxiesTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="6" class="loading">Đang tải...</td></tr>';
    
    try {
        const result = await apiCall('/proxies');
        proxies = result.proxies || [];
        
        const countEl = document.getElementById('proxyCount');
        if (countEl) countEl.textContent = proxies.length;
        
        if (proxies.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="loading">Chưa có proxy nào. Thêm proxy vào file proxies.txt hoặc thêm qua form trên.</td></tr>';
            return;
        }
        
        tbody.innerHTML = proxies.map((proxy, index) => {
            const isUsed = proxy.is_used || false;
            const proxyId = proxy.id || index + 1;
            // Sử dụng proxy.raw thay vì tạo từ host:port để đảm bảo format đúng
            const proxyString = proxy.raw || `${proxy.host || ''}:${proxy.port || ''}`;
            const proxyStatusId = `proxy-status-${proxyId}`;
            const proxyIpId = `proxy-ip-${proxyId}`;
            const hostPort = `${proxy.host || ''}:${proxy.port || ''}`;
            
            // Escape HTML entities cho data attributes
            const escapedProxyString = (proxyString || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            const escapedProxyApiUrl = ((proxy.proxy_api_url || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;'));
            
            return `
                <tr>
                    <td>${proxyId}</td>
                    <td>${proxy.raw || '-'}</td>
                    <td>${proxy.type || 'http'}</td>
                    <td>${hostPort}</td>
                    <td>
                        <span class="status-badge ${isUsed ? 'status-error' : 'status-active'}">
                            ${isUsed ? 'Đã sử dụng' : 'Chưa sử dụng'}
                        </span>
                    </td>
                    <td id="${proxyStatusId}">
                        ${proxy.saved_status ? 
                            (proxy.saved_status === 'active' || proxy.saved_status === 'true' || proxy.saved_status === true ? 
                                '<span class="status-badge status-active">✅ Hoạt động</span>' : 
                                '<span class="status-badge status-error">❌ Không hoạt động</span>') : 
                            '<span class="status-badge status-inactive">Chưa kiểm tra</span>'}
                    </td>
                    <td id="${proxyIpId}">
                        ${proxy.saved_public_ip || proxy.saved_public_ip_v6 ? 
                            (proxy.saved_public_ip && proxy.saved_public_ip_v6 ? 
                                `<span style="color: #333; font-weight: 500;" title="IPv4: ${proxy.saved_public_ip}\nIPv6: ${proxy.saved_public_ip_v6}">${proxy.saved_public_ip} / ${proxy.saved_public_ip_v6}</span>` :
                                `<span style="color: #333; font-weight: 500;" title="${proxy.saved_public_ip ? 'IPv4: ' + proxy.saved_public_ip : 'IPv6: ' + proxy.saved_public_ip_v6}">${proxy.saved_public_ip || proxy.saved_public_ip_v6}</span>`) :
                            '<span style="color: #666;">-</span>'}
                    </td>
                    <td>
                        <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                            <button class="btn btn-sm btn-info btn-check-proxy" 
                                    data-proxy-id="${proxyId}" 
                                    data-proxy-string="${escapedProxyString}" 
                                    data-proxy-api-url="${escapedProxyApiUrl}" 
                                    title="Kiểm tra proxy">
                                🔍 Check
                            </button>
                            <button class="btn btn-sm btn-warning btn-reset-proxy" 
                                    data-proxy-id="${proxyId}" 
                                    data-proxy-string="${escapedProxyString}" 
                                    data-proxy-api-url="${escapedProxyApiUrl}" 
                                    title="Change proxy IP">
                                🔄 Change IP
                            </button>
                            <button class="btn btn-sm btn-primary" onclick="editProxy(${proxyId})" title="Chỉnh sửa proxy">
                                ✏️ Sửa
                            </button>
                            <button class="btn btn-sm btn-danger" onclick="deleteProxy(${proxyId}, '${(proxy.raw || '').replace(/'/g, "\\'")}')" ${isUsed ? 'disabled title="Proxy đang được sử dụng"' : ''}>
                                🗑️ Xóa
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        // Attach event listeners cho các nút Check và Change IP
        attachProxyButtonListeners();
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="6" class="loading" style="color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

// Attach event listeners cho các nút Check và Change IP
function attachProxyButtonListeners() {
    // Remove existing listeners để tránh duplicate
    document.querySelectorAll('.btn-check-proxy').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    document.querySelectorAll('.btn-reset-proxy').forEach(btn => {
        btn.replaceWith(btn.cloneNode(true));
    });
    
    // Attach listeners cho Check buttons
    document.querySelectorAll('.btn-check-proxy').forEach(btn => {
        btn.addEventListener('click', function() {
            const proxyId = parseInt(this.getAttribute('data-proxy-id'));
            // Decode HTML entities
            let proxyString = this.getAttribute('data-proxy-string') || '';
            proxyString = proxyString.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            let proxyApiUrl = this.getAttribute('data-proxy-api-url') || '';
            proxyApiUrl = proxyApiUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            console.log('[AttachListeners] Check button clicked:', { proxyId, proxyString, proxyApiUrl });
            checkProxyStatus(proxyId, proxyString, proxyApiUrl);
        });
    });
    
    // Attach listeners cho Change IP buttons
    document.querySelectorAll('.btn-reset-proxy').forEach(btn => {
        btn.addEventListener('click', function() {
            const proxyId = parseInt(this.getAttribute('data-proxy-id'));
            // Decode HTML entities
            let proxyString = this.getAttribute('data-proxy-string') || '';
            proxyString = proxyString.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            let proxyApiUrl = this.getAttribute('data-proxy-api-url') || '';
            proxyApiUrl = proxyApiUrl.replace(/&quot;/g, '"').replace(/&#39;/g, "'");
            console.log('[AttachListeners] Reset button clicked:', { proxyId, proxyString, proxyApiUrl });
            resetProxyIP(proxyId, proxyString, proxyApiUrl);
        });
    });
}

// Add Proxy Modal Functions
function showAddProxyModal() {
    const modal = document.getElementById('addProxyModal');
    modal.style.display = 'block';
    // Đảm bảo modal này có z-index cao hơn modal "Quản lý Proxy"
    modal.classList.add('modal-overlay-high');
    document.getElementById('addProxyList').value = '';
}

function closeAddProxyModal() {
    const modal = document.getElementById('addProxyModal');
    modal.style.display = 'none';
    modal.classList.remove('modal-overlay-high');
    document.getElementById('addProxyForm').reset();
}

async function addProxies(event) {
    event.preventDefault();
    
    const proxyListText = document.getElementById('addProxyList').value.trim();
    
    if (!proxyListText) {
        showNotification('Vui lòng nhập danh sách proxy', 'warning');
        return;
    }
    
    // Parse danh sách proxy - mỗi dòng là một proxy
    const proxyLines = proxyListText.split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#') && line.length > 0);
    
    if (proxyLines.length === 0) {
        showNotification('Không tìm thấy proxy hợp lệ trong danh sách', 'warning');
        return;
    }
    
    try {
        showNotification(`Đang thêm ${proxyLines.length} proxy...`, 'info');
        
        let successCount = 0;
        let errorCount = 0;
        const errors = [];
        
        // Thêm từng proxy (không có proxy_api_url khi thêm)
        for (const proxyString of proxyLines) {
            try {
                const result = await apiCall('/proxies', 'POST', {
                    proxy: proxyString
                });
                
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                    errors.push(`${proxyString}: ${result.error || 'Unknown error'}`);
                }
            } catch (error) {
                errorCount++;
                errors.push(`${proxyString}: ${error.message}`);
            }
        }
        
        // Hiển thị kết quả
        if (successCount > 0) {
            let message = `Đã thêm thành công ${successCount} proxy`;
            if (errorCount > 0) {
                message += `, ${errorCount} proxy lỗi`;
            }
            showNotification(message, errorCount > 0 ? 'warning' : 'success');
            
            if (errors.length > 0) {
                console.error('[AddProxies] Errors:', errors);
            }
        } else {
            showNotification('Không thể thêm proxy nào. Vui lòng kiểm tra lại danh sách.', 'error');
        }
        
        closeAddProxyModal();
        // Invalidate cache và reload
        cachedProxyList = null;
        proxyListCacheTime = null;
        loadProxiesList();
    } catch (error) {
        showNotification('Lỗi thêm proxy: ' + error.message, 'error');
    }
}

async function deleteProxy(proxyId, proxyString) {
    if (!confirm(`Bạn có chắc muốn xóa proxy: ${proxyString}?`)) {
        return;
    }
    
    try {
        const result = await apiCall(`/proxies/${proxyId}`, 'DELETE');
        if (result.success) {
            showNotification('Đã xóa proxy thành công', 'success');
            // Invalidate cache và reload
            cachedProxyList = null;
            proxyListCacheTime = null;
            loadProxiesList();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi xóa proxy: ' + error.message, 'error');
    }
}

async function refreshProxies() {
    loadProxiesList();
}

// Helper function để tìm proxy_id từ proxy string
async function findProxyIdByString(proxyString) {
    try {
        // Tìm trong danh sách proxy đã load
        if (proxies && proxies.length > 0) {
            // Parse proxy string để so sánh
            const proxyParts = proxyString.split(':');
            const proxyHost = proxyParts[0];
            const proxyPort = proxyParts[1];
            
            for (const proxy of proxies) {
                // So sánh với raw hoặc host:port
                if (proxy.raw === proxyString || 
                    (proxy.host === proxyHost && String(proxy.port) === proxyPort) ||
                    proxy.raw === `${proxyHost}:${proxyPort}`) {
                    return proxy.id;
                }
            }
        }
        
        // Nếu không tìm thấy, thử tìm trong database qua API
        try {
            const allProxies = await apiCall('/proxies');
            if (allProxies.success && allProxies.proxies) {
                const proxyParts = proxyString.split(':');
                const proxyHost = proxyParts[0];
                const proxyPort = proxyParts[1];
                
                for (const proxy of allProxies.proxies) {
                    if (proxy.raw === proxyString || 
                        (proxy.host === proxyHost && String(proxy.port) === proxyPort) ||
                        proxy.raw === `${proxyHost}:${proxyPort}`) {
                        return proxy.id;
                    }
                }
            }
        } catch (error) {
            console.error('[FindProxyId] Lỗi khi tìm proxy trong database:', error);
        }
        
        return null;
    } catch (error) {
        console.error('[FindProxyId] Exception:', error);
        return null;
    }
}

// Helper function để lưu trạng thái proxy vào database
async function saveProxyStatusToDatabase(proxyId, statusData) {
    try {
        const updateData = {
            status: statusData.status,
            public_ip: statusData.public_ip || null,
            public_ip_v6: statusData.public_ip_v6 || null,
            message: statusData.message || null
        };
        
        console.log('[SaveProxyStatus] Lưu trạng thái proxy vào database:', { proxyId, updateData });
        const result = await apiCall(`/proxies/${proxyId}/status`, 'PUT', updateData);
        
        if (result.success) {
            console.log('[SaveProxyStatus] ✓ Đã lưu trạng thái proxy vào database');
            return result;
        } else {
            console.error('[SaveProxyStatus] ✗ Lỗi khi lưu:', result.error);
            return result;
        }
    } catch (error) {
        console.error('[SaveProxyStatus] Exception:', error);
        return { success: false, error: error.message };
    }
}

// Kiểm tra trạng thái proxy trong Proxy Manager
async function checkProxyStatus(proxyId, proxyString, proxyApiUrl = '') {
    console.log('[CheckProxyStatus] Called with:', { proxyId, proxyString, proxyApiUrl });
    try {
        const statusElId = `proxy-status-${proxyId}`;
        const ipElId = `proxy-ip-${proxyId}`;
        
        // Hàm helper để tìm element trong bảng
        const findElementsInTable = () => {
            const table = document.getElementById('proxiesTable');
            if (!table) {
                console.error('[CheckProxy] Table not found: proxiesTable');
                return { statusEl: null, ipEl: null };
            }
            
            const rows = table.querySelectorAll('tbody tr');
            let statusEl = null;
            let ipEl = null;
            
            for (const row of rows) {
                const firstCell = row.querySelector('td:first-child');
                if (firstCell && firstCell.textContent.trim() == String(proxyId)) {
                    const cells = row.querySelectorAll('td');
                    if (cells.length >= 8) {
                        // Cột 6 là trạng thái proxy (index 5) - có ID
                        // Cột 7 là IP proxy (index 6) - có ID
                        statusEl = cells[5];
                        ipEl = cells[6];
                        console.log('[CheckProxy] Found elements in table row:', statusEl, ipEl);
                        break;
                    }
                }
            }
            
            return { statusEl, ipEl };
        };
        
        // Tìm element bằng ID trước
        let statusEl = document.getElementById(statusElId);
        let ipEl = document.getElementById(ipElId);
        
        console.log('[CheckProxy] Looking for elements by ID:', statusElId, ipElId);
        console.log('[CheckProxy] Found by ID - statusEl:', statusEl, 'ipEl:', ipEl);
        
        // Nếu không tìm thấy bằng ID, tìm trong bảng
        if (!statusEl || !ipEl) {
            console.log('[CheckProxy] Elements not found by ID, searching in table...');
            const found = findElementsInTable();
            if (found.statusEl) statusEl = found.statusEl;
            if (found.ipEl) ipEl = found.ipEl;
        }
        
        if (!statusEl || !ipEl) {
            console.error('[CheckProxy] Cannot find elements! StatusEl:', statusEl, 'IpEl:', ipEl);
            showNotification('Không tìm thấy phần tử trong bảng. Vui lòng làm mới danh sách proxy.', 'error');
            return;
        }
        
        // Cập nhật UI trạng thái "Đang kiểm tra"
        statusEl.innerHTML = '<span class="status-badge status-inactive">Đang kiểm tra...</span>';
        ipEl.innerHTML = '<span style="color: #666;">Đang kiểm tra...</span>';
        
        showNotification('Đang kiểm tra proxy...', 'info');
        
        // Chỉ gửi proxy_api_url nếu có giá trị, không gửi empty string
        const requestData = {
            proxy: proxyString
        };
        if (proxyApiUrl && proxyApiUrl.trim()) {
            requestData.proxy_api_url = proxyApiUrl.trim();
        }
        
        console.log('[CheckProxy] Request data:', requestData);
        const result = await apiCall('/proxy/check', 'POST', requestData);
        
        console.log('[CheckProxy] Full result:', JSON.stringify(result, null, 2));
        
        // Tìm lại element sau khi có kết quả (đảm bảo element vẫn tồn tại)
        statusEl = document.getElementById(statusElId);
        ipEl = document.getElementById(ipElId);
        
        if (!statusEl || !ipEl) {
            const found = findElementsInTable();
            if (found.statusEl) statusEl = found.statusEl;
            if (found.ipEl) ipEl = found.ipEl;
        }
        
        if (!statusEl || !ipEl) {
            console.error('[CheckProxy] Cannot find elements after API call!');
            showNotification('Lỗi: Không thể cập nhật UI. Vui lòng làm mới danh sách proxy.', 'error');
            return;
        }
        
        if (result.success) {
            const status = result.status ? '✅ Hoạt động' : '❌ Không hoạt động';
            const message = result.message || result.msg || 'UNKNOWN';
            const statusMessages = {
                'MODEM_READY': 'Proxy sẵn sàng sử dụng',
                'MODEM_NOT_FOUND': 'Không tìm thấy modem',
                'MODEM_RESETTING': 'Modem đang reset',
                'MODEM_DISCONNECTED': 'Modem đã ngắt kết nối',
                'COLLISION_IP': 'Proxy có IP trùng lặp',
                'TIMEOUT': 'Timeout khi kiểm tra',
                'CONNECTION_ERROR': 'Lỗi kết nối đến API server'
            };
            
            const messageText = statusMessages[message] || message;
            const badgeClass = result.status ? 'status-active' : 'status-error';
            
            // Cập nhật trạng thái proxy
            if (statusEl) {
                const statusHtml = `<span class="status-badge ${badgeClass}" title="${messageText}">${status}</span>`;
                statusEl.innerHTML = statusHtml;
                console.log('[CheckProxy] ✓ Updated status element:', statusHtml);
            } else {
                console.error('[CheckProxy] ✗ Cannot update status - element not found:', statusElId);
                showNotification('Lỗi: Không thể cập nhật trạng thái proxy', 'error');
            }
            
            // Logic IP: Lấy public_ip (IPv4) và public_ip_v6 từ API status
            // Hiển thị: IPv4 nếu có, nếu có cả IPv6 thì hiển thị cả hai
            let displayIp = null;
            let ipTooltip = '';
            
            if (result.public_ip) {
                // Có IPv4
                if (result.public_ip_v6) {
                    // Có cả IPv4 và IPv6
                    displayIp = `${result.public_ip} / ${result.public_ip_v6}`;
                    ipTooltip = `IPv4: ${result.public_ip}\nIPv6: ${result.public_ip_v6}`;
                } else {
                    // Chỉ có IPv4
                    displayIp = result.public_ip;
                    ipTooltip = `IPv4: ${result.public_ip}`;
                }
            } else if (result.public_ip_v6) {
                // Chỉ có IPv6
                displayIp = result.public_ip_v6;
                ipTooltip = `IPv6: ${result.public_ip_v6}`;
            } else if (result.proxy_ip) {
                // Không có public IP, hiển thị proxy host
                displayIp = result.proxy_ip;
                ipTooltip = `Proxy: ${result.proxy_ip}`;
            }
            
            console.log('[CheckProxy] Display IP:', displayIp, 'IPv4:', result.public_ip, 'IPv6:', result.public_ip_v6, 'proxy_ip:', result.proxy_ip);
            
            if (ipEl) {
                if (displayIp && displayIp.trim() && displayIp !== '-') {
                    const ipHtml = `<span style="color: #333; font-weight: 500; cursor: help;" title="${ipTooltip.replace(/"/g, '&quot;')}">${displayIp}</span>`;
                    ipEl.innerHTML = ipHtml;
                    console.log('[CheckProxy] ✓ Updated IP element:', ipHtml);
                } else {
                    ipEl.innerHTML = '<span style="color: #666;">-</span>';
                    console.log('[CheckProxy] No IP to display, showing "-"');
                }
            } else {
                console.error('[CheckProxy] ✗ IP element not found:', ipElId);
                showNotification('Lỗi: Không thể cập nhật IP proxy', 'error');
            }
            
            // Lưu trạng thái và IP vào database
            if (proxyId) {
                try {
                    const saveResult = await saveProxyStatusToDatabase(proxyId, {
                        status: result.status,
                        public_ip: result.public_ip,
                        public_ip_v6: result.public_ip_v6,
                        message: result.message || result.msg
                    });
                    
                    if (saveResult && saveResult.success) {
                        console.log('[CheckProxy] ✓ Đã lưu trạng thái và IP vào database');
                        // Invalidate cache và reload lại danh sách proxy để hiển thị dữ liệu đã lưu
                        cachedProxyList = null;
                        proxyListCacheTime = null;
                        setTimeout(() => {
                            loadProxiesList();
                        }, 500);
                    }
                } catch (error) {
                    console.error('[CheckProxy] Lỗi khi lưu vào database:', error);
                }
            }
            
            // Thêm IP vào thông báo nếu có
            let notificationMessage = `${status}\n${messageText}`;
            if (result.display_ip || result.public_ip || result.proxy_ip) {
                const ipDisplay = result.display_ip || (result.public_ip ? `Public IP: ${result.public_ip}` : `Proxy: ${result.proxy_ip}`);
                notificationMessage += `\n${ipDisplay}`;
            }
            
            showNotification(notificationMessage, result.status ? 'success' : 'warning');
            
            // Tự động lưu trạng thái và IP vào database
            try {
                const saveResult = await apiCall(`/proxies/${proxyId}/status`, 'PUT', {
                    status: result.status,
                    public_ip: result.public_ip || null,
                    public_ip_v6: result.public_ip_v6 || null,
                    message: result.message || result.msg || null
                });
                if (saveResult.success) {
                    console.log('[CheckProxy] ✓ Đã lưu trạng thái và IP vào database');
                } else {
                    console.error('[CheckProxy] ✗ Lỗi lưu vào database:', saveResult.error);
                }
            } catch (error) {
                console.error('[CheckProxy] ✗ Exception khi lưu vào database:', error);
            }
        } else {
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-badge status-error">Lỗi kiểm tra</span>';
                console.log('[CheckProxy] Updated status to error');
            } else {
                console.error('[CheckProxy] Cannot update status to error - element not found');
            }
            if (ipEl) {
                ipEl.innerHTML = '<span style="color: #666;">-</span>';
                console.log('[CheckProxy] Updated IP to "-"');
            } else {
                console.error('[CheckProxy] Cannot update IP to "-" - element not found');
            }
            showNotification('Lỗi kiểm tra proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('[CheckProxy] Exception:', error);
        const statusEl = document.getElementById(`proxy-status-${proxyId}`);
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-error">Lỗi</span>';
        }
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

// Reset/Change proxy IP trong Proxy Manager
// Logic: Gọi API reset, đợi 5-10s, rồi gọi lại API status để cập nhật trạng thái và IP
async function resetProxyIP(proxyId, proxyString, proxyApiUrl = '') {
    console.log('[ResetProxyIP] Called with:', { proxyId, proxyString, proxyApiUrl });
    if (!confirm('Bạn có chắc muốn reset IP của proxy này?')) {
        return;
    }
    
    try {
        const statusEl = document.getElementById(`proxy-status-${proxyId}`);
        const ipEl = document.getElementById(`proxy-ip-${proxyId}`);
        
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-inactive">Đang reset...</span>';
        }
        if (ipEl) {
            ipEl.innerHTML = '<span style="color: #666;">Đang reset...</span>';
        }
        
        showNotification('Đang reset proxy IP...', 'info');
        
        // Kiểm tra xem proxyApiUrl có phải là URL đầy đủ không (chứa /reset?proxy=)
        let isFullUrl = false;
        let baseUrlForStatus = '';
        
        if (proxyApiUrl && proxyApiUrl.trim()) {
            const url = proxyApiUrl.trim();
            // Nếu URL chứa /reset?proxy= thì đây là URL đầy đủ để change IP
            if (url.includes('/reset?proxy=') || url.includes('/reset?proxy=')) {
                isFullUrl = true;
                console.log('[ResetProxy] Phát hiện URL Change IP đầy đủ:', url);
                
                // Parse base URL từ URL đầy đủ để dùng cho check status sau này
                try {
                    const urlObj = new URL(url);
                    baseUrlForStatus = `${urlObj.protocol}//${urlObj.host}`;
                } catch (e) {
                    // Nếu không parse được, thử extract base URL thủ công
                    const match = url.match(/^(https?:\/\/[^\/]+)/);
                    if (match) {
                        baseUrlForStatus = match[1];
                    }
                }
            }
        }
        
        let result;
        if (isFullUrl) {
            // Gọi trực tiếp URL đầy đủ để change IP
            console.log('[ResetProxy] Gọi trực tiếp URL Change IP:', proxyApiUrl);
            try {
                const response = await fetch(proxyApiUrl, { method: 'GET' });
                const data = await response.json();
                result = {
                    success: response.ok,
                    message: data.message || 'Reset initiated',
                    error: response.ok ? null : (data.error || 'Unknown error')
                };
            } catch (error) {
                result = {
                    success: false,
                    error: error.message
                };
            }
        } else {
            // Dùng logic cũ với proxy_api_url (base URL)
            const requestData = {
                proxy: proxyString
            };
            if (proxyApiUrl && proxyApiUrl.trim()) {
                requestData.proxy_api_url = proxyApiUrl.trim();
            }
            
            console.log('[ResetProxy] Request data:', requestData);
            result = await apiCall('/proxy/reset', 'POST', requestData);
        }
        
        console.log('[ResetProxy] Result:', result);
        
        if (result.success) {
            showNotification('Đã reset proxy IP thành công. Đang đợi 5-10 giây để kiểm tra lại...', 'success');
            
            // Logic change IP: Đợi 5-10 giây (random 5-10s) sau khi reset, rồi gọi lại API status
            const waitTime = Math.floor(Math.random() * 5000) + 5000; // Random 5-10 giây (5000-10000ms)
            console.log(`[ResetProxy] Đợi ${waitTime/1000} giây trước khi check lại status...`);
            
            setTimeout(async () => {
                console.log('[ResetProxy] Checking status after reset...');
                // Nếu có baseUrlForStatus từ URL đầy đủ, dùng nó để check status
                // Nếu không, dùng proxyApiUrl (có thể là base URL hoặc empty)
                const statusApiUrl = baseUrlForStatus || proxyApiUrl;
                // Gọi checkProxyStatus - nó sẽ tự động lưu vào database và reload danh sách
                await checkProxyStatus(proxyId, proxyString, statusApiUrl);
            }, waitTime);
        } else {
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-badge status-error">Lỗi reset</span>';
            }
            showNotification('Lỗi reset proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('[ResetProxy] Exception:', error);
        const statusEl = document.getElementById(`proxy-status-${proxyId}`);
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-error">Lỗi</span>';
        }
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

// Chỉnh sửa proxy
async function editProxy(proxyId) {
    try {
        const result = await apiCall(`/proxies/${proxyId}`);
        const proxy = result.proxy;
        
        if (!proxy) {
            showNotification('Không tìm thấy proxy', 'error');
            return;
        }
        
        // Điền thông tin vào form chỉnh sửa
        document.getElementById('editProxyId').value = proxy.id;
        document.getElementById('editProxyInput').value = proxy.raw_proxy || '';
        document.getElementById('editProxyApiUrl').value = proxy.proxy_api_url || '';
        
        // Hiển thị modal chỉnh sửa
        document.getElementById('editProxyModal').style.display = 'block';
    } catch (error) {
        showNotification('Lỗi tải thông tin proxy: ' + error.message, 'error');
    }
}

function closeEditProxyModal() {
    document.getElementById('editProxyModal').style.display = 'none';
    document.getElementById('editProxyForm').reset();
}

async function updateProxy(event) {
    event.preventDefault();
    
    const proxyId = document.getElementById('editProxyId').value;
    const proxyString = document.getElementById('editProxyInput').value.trim();
    const proxyApiUrl = document.getElementById('editProxyApiUrl').value.trim() || '';
    
    if (!proxyString) {
        showNotification('Vui lòng nhập proxy', 'warning');
        return;
    }
    
    try {
        showNotification('Đang cập nhật proxy...', 'info');
        const result = await apiCall(`/proxies/${proxyId}`, 'PUT', {
            proxy: proxyString,
            proxy_api_url: proxyApiUrl || null
        });
        
        if (result.success) {
            showNotification('Cập nhật proxy thành công', 'success');
            closeEditProxyModal();
            // Invalidate cache và reload
            cachedProxyList = null;
            proxyListCacheTime = null;
            loadProxiesList();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật proxy: ' + error.message, 'error');
    }
}

// Profile Manager
function showProfileManager() {
    document.getElementById('profileManagerModal').style.display = 'block';
    loadProfilesManager();
}

function closeProfileManager() {
    document.getElementById('profileManagerModal').style.display = 'none';
}

async function loadProfilesManager() {
    const tbody = document.getElementById('profilesManagerTableBody');
    if (!tbody) return;
    
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Đang tải...</td></tr>';
    
    try {
        // Lấy danh sách profiles đang mở
        try {
            const activeResult = await apiCall('/gpmlogin/profiles/active');
            if (activeResult.success) {
                gpmManagerActiveProfiles = activeResult.profile_ids || [];
            }
        } catch (e) {
            console.error('Error getting active profiles:', e);
            gpmManagerActiveProfiles = [];
        }
        
        const result = await apiCall('/gpmlogin/profiles');
        const profiles = result.profiles || [];
        
        // Nếu có đồng bộ, reload accounts để cập nhật proxy_info
        if (result.synced) {
            try {
                const accountsResult = await apiCall('/accounts');
                accounts = accountsResult.accounts;
                // Cập nhật bảng accounts nếu đang hiển thị
                if (document.getElementById('accountsTable')) {
                    updateAccountsTable(accounts);
                }
            } catch (e) {
                console.error('Error reloading accounts after sync:', e);
            }
        }
        
        // Lưu tất cả profiles để filter
        allProfiles = profiles;
        
        // Render profiles (sẽ được filter trong filterProfiles)
        await renderProfilesTable(profiles);
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="9" class="loading" style="color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

// Store selected profiles và cached proxy list
let selectedProfiles = new Set();
let cachedProxyListForProfile = null;

async function renderProfilesTable(profiles) {
    const tbody = document.getElementById('profilesManagerTableBody');
    if (!tbody) return;
    
    const countEl = document.getElementById('profileCount');
    if (countEl) countEl.textContent = profiles.length;
    
    if (profiles.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" class="loading">Không tìm thấy profiles nào</td></tr>';
        return;
    }
    
    // Load proxy list nếu chưa có cache
    if (!cachedProxyListForProfile) {
        try {
            const proxyResult = await apiCall('/proxies?simple=true');
            cachedProxyListForProfile = proxyResult.proxies || [];
        } catch (e) {
            console.error('Error loading proxy list:', e);
            cachedProxyListForProfile = [];
        }
    }
    
    // Load account data để lấy auto_change_proxy
    const accountsMap = {};
    try {
        const accountsResult = await apiCall('/accounts');
        (accountsResult.accounts || []).forEach(acc => {
            if (acc.gpmlogin_profile_id) {
                accountsMap[acc.gpmlogin_profile_id] = acc;
            }
        });
    } catch (e) {
        console.error('Error loading accounts:', e);
    }
    
    tbody.innerHTML = profiles.map(profile => {
        const isActive = profile.id && gpmManagerActiveProfiles && gpmManagerActiveProfiles.includes(profile.id);
        const account = accountsMap[profile.id] || {};
        const autoChangeProxy = account.auto_change_proxy === true || account.auto_change_proxy === 1 || account.auto_change_proxy === '1';
        
        // Ưu tiên proxy_info từ database (nguồn chính xác nhất)
        // Chỉ dùng profile.raw_proxy làm fallback nếu không có proxy_info trong database
        let currentProxy = account.proxy_info || '';
        
        // Nếu không có proxy_info trong database, mới lấy từ profile.raw_proxy
        if (!currentProxy && profile.raw_proxy) {
            const rawProxy = profile.raw_proxy.trim();
            // Kiểm tra format GPMLogin: "HTTP proxy| IP:Port" hoặc "Socks5| socks5://IP:Port"
            if (rawProxy.includes('|')) {
                // Extract phần sau dấu |
                const parts = rawProxy.split('|');
                if (parts.length > 1) {
                    let extractedProxy = parts[1].trim();
                    // Loại bỏ protocol nếu có (socks5://)
                    extractedProxy = extractedProxy.replace(/^socks5:\/\//i, '');
                    currentProxy = extractedProxy;
                } else {
                    currentProxy = rawProxy;
                }
            } else {
                // Nếu không có format đặc biệt, dùng trực tiếp
                currentProxy = rawProxy;
            }
        }
        
        const isSelected = selectedProfiles.has(profile.id);
        
        // Tạo options cho proxy dropdown
        let proxyOptions = '<option value="__none__">-- Không có proxy --</option>';
        if (cachedProxyListForProfile && cachedProxyListForProfile.length > 0) {
            proxyOptions += '<optgroup label="Danh sách proxy:">';
            cachedProxyListForProfile.forEach(proxy => {
                const proxyString = proxy.raw || `${proxy.host || ''}:${proxy.port || ''}`;
                const isSelectedProxy = proxyString === currentProxy;
                proxyOptions += `<option value="${(proxyString || '').replace(/"/g, '&quot;')}" ${isSelectedProxy ? 'selected' : ''}>${proxyString}</option>`;
            });
            proxyOptions += '</optgroup>';
        }
        proxyOptions += '<option value="__custom__">➕ Nhập proxy mới</option>';
        
        return `
            <tr data-profile-id="${profile.id || ''}">
                <td style="text-align: center;">
                    <input type="checkbox" class="profile-checkbox" data-profile-id="${profile.id || ''}" 
                           ${isSelected ? 'checked' : ''} onchange="toggleProfileSelection('${profile.id || ''}')">
                </td>
                <td>${profile.id || '-'}</td>
                <td>${profile.name || '-'}</td>
                <td>${profile.browser_type || '-'}</td>
                <td>
                    <div style="position: relative;">
                        <select class="form-control" style="width: 100%; padding: 4px; font-size: 12px;" 
                                data-profile-id="${profile.id || ''}" 
                                id="profileProxySelect_${profile.id || ''}"
                                onchange="handleProfileProxySelectChange('${profile.id || ''}', this.value)">
                            ${proxyOptions}
                        </select>
                        <input type="text" class="form-control" style="width: 100%; padding: 4px; font-size: 12px; margin-top: 5px; display: none;" 
                               id="profileProxyCustom_${profile.id || ''}" 
                               placeholder="ip:port hoặc ip:port:user:pass"
                               onblur="updateProfileProxyFromCustom('${profile.id || ''}', this.value)"
                               onkeypress="if(event.key==='Enter') this.blur()">
                    </div>
                </td>
                <td style="text-align: center;">
                    <input type="checkbox" ${autoChangeProxy ? 'checked' : ''} 
                           data-profile-id="${profile.id || ''}"
                           onchange="updateProfileAutoChangeProxy('${profile.id || ''}', this.checked)"
                           title="Tự động change proxy IP khi mở profile">
                </td>
                <td>${formatDate(profile.created_at)}</td>
                <td>
                    <span class="status-badge ${isActive ? 'status-active' : 'status-inactive'}">
                        ${isActive ? '🟢 Đang mở' : '⚪ Đã đóng'}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 5px; flex-wrap: wrap;">
                        ${isActive ? 
                            `<button class="btn btn-sm btn-warning" onclick="closeGPMLoginProfile('${profile.id || ''}')" title="Đóng profile">
                                ⏹️ Đóng
                            </button>` :
                            `<button class="btn btn-sm btn-primary" onclick="openGPMLoginProfile('${profile.id || ''}')" title="Mở profile">
                                ▶️ Mở
                            </button>`
                        }
                        <button class="btn btn-sm btn-success" onclick="showManualLogin('${profile.id || ''}')" title="Đăng nhập thủ công">
                            🔐 Đăng nhập
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteGPMLoginProfile('${profile.id || ''}', '${(profile.name || '').replace(/'/g, "\\'")}')" title="Xóa profile">
                            🗑️ Xóa
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
    
    // Update selected count
    updateSelectedProfilesCount();
}

async function deleteGPMLoginProfile(profileId, profileName) {
    if (!confirm(`⚠️ CẢNH BÁO: Bạn có chắc muốn XÓA VĨNH VIỄN profile "${profileName}"?\n\nHành động này không thể hoàn tác!`)) {
        return;
    }
    
    if (!confirm(`Xác nhận lần cuối: Xóa profile "${profileName}" (ID: ${profileId})?`)) {
        return;
    }
    
    try {
        showNotification('Đang xóa profile...', 'info');
        const result = await apiCall(`/gpmlogin/profiles/${profileId}`, 'DELETE');
        
        if (result.success) {
            showNotification('Đã xóa profile vĩnh viễn', 'success');
            loadProfilesManager();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi xóa profile: ' + error.message, 'error');
    }
}

async function refreshProfiles() {
    // Clear cache khi refresh
    cachedProxyListForProfile = null;
    allProfiles = null; // Clear cached profiles để force reload
    // Lấy danh sách profiles đang mở
    try {
        const activeResult = await apiCall('/gpmlogin/profiles/active');
        if (activeResult.success) {
            gpmManagerActiveProfiles = activeResult.profile_ids || [];
        }
    } catch (e) {
        console.error('Error getting active profiles:', e);
    }
    loadProfilesManager();
}

// Profile selection functions
function toggleProfileSelection(profileId) {
    if (selectedProfiles.has(profileId)) {
        selectedProfiles.delete(profileId);
    } else {
        selectedProfiles.add(profileId);
    }
    updateSelectedProfilesCount();
    updateSelectAllProfilesCheckbox();
}

function toggleSelectAllProfiles() {
    const selectAll = document.getElementById('selectAllProfiles');
    const checkboxes = document.querySelectorAll('.profile-checkbox');
    
    checkboxes.forEach(checkbox => {
        const profileId = checkbox.getAttribute('data-profile-id');
        if (selectAll.checked) {
            selectedProfiles.add(profileId);
            checkbox.checked = true;
        } else {
            selectedProfiles.delete(profileId);
            checkbox.checked = false;
        }
    });
    updateSelectedProfilesCount();
}

function updateSelectAllProfilesCheckbox() {
    const selectAll = document.getElementById('selectAllProfiles');
    const checkboxes = document.querySelectorAll('.profile-checkbox');
    if (checkboxes.length === 0) return;
    
    const allSelected = Array.from(checkboxes).every(cb => cb.checked);
    selectAll.checked = allSelected;
}

function updateSelectedProfilesCount() {
    const count = selectedProfiles.size;
    const countEl = document.getElementById('selectedProfilesCount');
    const btn = document.getElementById('openSelectedProfilesBtn');
    
    if (countEl) countEl.textContent = count;
    if (btn) {
        btn.style.display = count > 0 ? 'inline-block' : 'none';
    }
}

async function openSelectedProfiles() {
    const profileIds = Array.from(selectedProfiles);
    if (profileIds.length === 0) {
        showNotification('Vui lòng chọn ít nhất một profile', 'warning');
        return;
    }
    
    if (!confirm(`Bạn có chắc muốn mở ${profileIds.length} profile đã chọn?`)) {
        return;
    }
    
    try {
        showNotification(`Đang mở ${profileIds.length} profile...`, 'info');
        let successCount = 0;
        let errorCount = 0;
        
        for (const profileId of profileIds) {
            try {
                const result = await apiCall(`/gpmlogin/profiles/${profileId}/start`, 'POST');
                if (result.success) {
                    successCount++;
                } else {
                    errorCount++;
                }
                // Đợi một chút giữa các lần mở để tránh quá tải
                await new Promise(resolve => setTimeout(resolve, 500));
            } catch (error) {
                errorCount++;
                console.error(`Error opening profile ${profileId}:`, error);
            }
        }
        
        if (successCount > 0) {
            showNotification(`Đã mở thành công ${successCount}/${profileIds.length} profile`, 'success');
        }
        if (errorCount > 0) {
            showNotification(`Có ${errorCount} profile không thể mở`, 'warning');
        }
        
        // Clear selection và refresh
        selectedProfiles.clear();
        refreshProfiles();
    } catch (error) {
        showNotification('Lỗi mở profiles: ' + error.message, 'error');
    }
}

// Handle proxy select change
// Handle proxy select change
function handleProfileProxySelectChange(profileId, proxyValue) {
    const customInput = document.getElementById(`profileProxyCustom_${profileId}`);
    const select = document.getElementById(`profileProxySelect_${profileId}`);
    
    if (proxyValue === '__custom__') {
        // Hiển thị input để nhập proxy mới
        if (customInput) {
            customInput.style.display = 'block';
            customInput.value = '';
            customInput.focus();
        }
        // Reset dropdown về giá trị cũ (tìm option có selected trước đó)
        // Không reset, để user thấy đã chọn "__custom__"
    } else {
        // Ẩn custom input
        if (customInput) {
            customInput.style.display = 'none';
            customInput.value = '';
        }
        // Cập nhật proxy ngay
        updateProfileProxyInline(profileId, proxyValue);
    }
}

// Update proxy from custom input
async function updateProfileProxyFromCustom(profileId, proxyValue) {
    const customInput = document.getElementById(`profileProxyCustom_${profileId}`);
    const select = document.getElementById(`profileProxySelect_${profileId}`);
    
    if (!proxyValue || !proxyValue.trim()) {
        // Nếu rỗng, ẩn input và reset dropdown
        if (customInput) customInput.style.display = 'none';
        if (select) select.value = '__none__';
        return;
    }
    
    // Cập nhật proxy
    await updateProfileProxyInline(profileId, proxyValue.trim());
    
    // Ẩn input và cập nhật dropdown
    if (customInput) {
        customInput.style.display = 'none';
        // Thêm option mới vào dropdown nếu chưa có
        const optionExists = Array.from(select.options).some(opt => opt.value === proxyValue.trim());
        if (!optionExists && select) {
            const newOption = document.createElement('option');
            newOption.value = proxyValue.trim().replace(/"/g, '&quot;');
            newOption.textContent = proxyValue.trim();
            select.insertBefore(newOption, select.lastElementChild); // Insert trước option "__custom__"
            select.value = newOption.value;
        }
    }
}

// Update proxy inline (không cần modal)
async function updateProfileProxyInline(profileId, proxyValue) {
    if (!profileId) return;
    
    let newProxy = null;
    
    // Xử lý các giá trị đặc biệt
    if (proxyValue === '__none__') {
        newProxy = null;
    } else if (proxyValue && proxyValue.trim()) {
        newProxy = proxyValue.trim();
    }
    
    // Chỉ cập nhật nếu có giá trị hợp lệ
    if (newProxy !== undefined) {
        try {
            const result = await apiCall(`/gpmlogin/profiles/${profileId}/proxy`, 'PUT', {
                proxy: newProxy
            });
            
            if (result.success) {
                showNotification('Đã cập nhật proxy thành công', 'success');
                // Clear cache và refresh để cập nhật UI
                allProfiles = null; // Force reload profiles từ API
                cachedProxyListForProfile = null; // Clear proxy cache
                // Reload accounts để đồng bộ proxy_info từ database
                try {
                    await refreshData(); // Reload accounts từ database
                } catch (e) {
                    console.error('Error refreshing accounts:', e);
                }
                // Đợi lâu hơn để GPMLogin API cập nhật xong (có thể cần 2-3 giây)
                setTimeout(() => {
                    loadProfilesManager(); // Gọi trực tiếp loadProfilesManager để force reload từ API
                }, 2000); // Tăng lên 2 giây để đảm bảo GPMLogin API đã cập nhật
            } else {
                showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
            }
        } catch (error) {
            showNotification('Lỗi cập nhật proxy: ' + error.message, 'error');
        }
    }
}

// Update auto_change_proxy cho account
async function updateProfileAutoChangeProxy(profileId, enabled) {
    if (!profileId) return;
    
    try {
        // Tìm account có profile_id này
        const accountsResult = await apiCall('/accounts');
        const account = (accountsResult.accounts || []).find(acc => acc.gpmlogin_profile_id === profileId);
        
        if (!account) {
            showNotification('Không tìm thấy tài khoản cho profile này', 'warning');
            return;
        }
        
        const result = await apiCall(`/accounts/${account.id}`, 'PUT', {
            auto_change_proxy: enabled
        });
        
        if (result.success) {
            showNotification(`Đã ${enabled ? 'bật' : 'tắt'} tự động change proxy IP`, 'success');
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật: ' + error.message, 'error');
    }
}

async function openGPMLoginProfile(profileId) {
    if (!confirm('Bạn có chắc muốn mở profile này?')) {
        return;
    }
    
    try {
        showNotification('Đang mở profile...', 'info');
        const result = await apiCall(`/gpmlogin/profiles/${profileId}/start`, 'POST');
        if (result.success) {
            showNotification('Đã mở profile thành công', 'success');
            refreshProfiles();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi mở profile: ' + error.message, 'error');
    }
}

async function closeGPMLoginProfile(profileId) {
    if (!confirm('Bạn có chắc muốn đóng profile này?')) {
        return;
    }
    
    try {
        showNotification('Đang đóng profile...', 'info');
        const result = await apiCall(`/gpmlogin/profiles/${profileId}/stop`, 'POST');
        if (result.success) {
            showNotification('Đã đóng profile thành công', 'success');
            refreshProfiles();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi đóng profile: ' + error.message, 'error');
    }
}

async function filterProfiles() {
    const searchText = document.getElementById('profileSearchInput')?.value.toLowerCase() || '';
    const statusFilter = document.getElementById('profileStatusFilter')?.value || '';
    const browserFilter = document.getElementById('profileBrowserFilter')?.value || '';
    const proxyFilter = document.getElementById('profileProxyFilter')?.value || '';
    
    if (!allProfiles || allProfiles.length === 0) {
        return;
    }
    
    let filtered = allProfiles.filter(profile => {
        // Tìm kiếm theo text
        if (searchText) {
            const searchableText = `${profile.id || ''} ${profile.name || ''}`.toLowerCase();
            if (!searchableText.includes(searchText)) {
                return false;
            }
        }
        
        // Lọc theo trạng thái
        if (statusFilter) {
            const isActive = profile.id && gpmManagerActiveProfiles && gpmManagerActiveProfiles.includes(profile.id);
            if (statusFilter === 'active' && !isActive) return false;
            if (statusFilter === 'inactive' && isActive) return false;
        }
        
        // Lọc theo browser
        if (browserFilter) {
            const browserType = (profile.browser_type || '').toLowerCase();
            if (!browserType.includes(browserFilter.toLowerCase())) {
                return false;
            }
        }
        
        // Lọc theo proxy
        if (proxyFilter) {
            const hasProxy = profile.raw_proxy ? true : false;
            if (proxyFilter === 'yes' && !hasProxy) return false;
            if (proxyFilter === 'no' && hasProxy) return false;
        }
        
        return true;
    });
    
    await renderProfilesTable(filtered);
}

async function resetProfileFilters() {
    const searchInput = document.getElementById('profileSearchInput');
    const statusFilter = document.getElementById('profileStatusFilter');
    const browserFilter = document.getElementById('profileBrowserFilter');
    const proxyFilter = document.getElementById('profileProxyFilter');
    
    if (searchInput) searchInput.value = '';
    if (statusFilter) statusFilter.value = '';
    if (browserFilter) browserFilter.value = '';
    if (proxyFilter) proxyFilter.value = '';
    
    await renderProfilesTable(allProfiles);
}

// Manual Login
function showManualLogin(profileId) {
    document.getElementById('manualLoginProfileId').value = profileId;
    
    // Tìm account tương ứng với profile_id
    const account = accounts.find(a => a.gpmlogin_profile_id === profileId);
    if (account) {
        document.getElementById('manualLoginEmail').value = account.email || '';
        document.getElementById('manualLoginPassword').value = account.password || '';
    } else {
        document.getElementById('manualLoginEmail').value = '';
        document.getElementById('manualLoginPassword').value = '';
    }
    
    document.getElementById('manualLoginModal').style.display = 'block';
}

function closeManualLoginModal() {
    document.getElementById('manualLoginModal').style.display = 'none';
    document.getElementById('manualLoginForm').reset();
}

async function submitManualLogin(event) {
    event.preventDefault();
    
    const profileId = document.getElementById('manualLoginProfileId').value;
    const email = document.getElementById('manualLoginEmail').value;
    const password = document.getElementById('manualLoginPassword').value;
    const humanLike = document.getElementById('manualLoginHumanLike').checked;
    
    if (!email || !password) {
        showNotification('Vui lòng nhập đầy đủ email và password', 'warning');
        return;
    }
    
    try {
        showNotification('Đang đăng nhập...', 'info');
        const result = await apiCall('/gpmlogin/profiles/login', 'POST', {
            profile_id: profileId,
            email: email,
            password: password,
            human_like: humanLike
        });
        
        if (result.success) {
            showNotification('Đăng nhập thành công!', 'success');
            closeManualLoginModal();
        } else if (result.wrong_password) {
            // Mật khẩu sai
            showNotification('✗ Mật khẩu sai. Vui lòng kiểm tra lại. Profile đã được đóng.', 'error');
            closeManualLoginModal();
        } else if (result.needs_2fa) {
            // Cần xử lý 2FA
            showNotification('⚠ Phát hiện yêu cầu xác thực 2FA/challenge. Browser đang mở để bạn xử lý thủ công. Sau khi hoàn tất, vui lòng kiểm tra lại.', 'warning');
            // Không đóng modal để người dùng biết đang chờ
            // Có thể thêm button "Đã xử lý xong" để kiểm tra lại
        } else if (result.needs_manual) {
            // Cần xử lý thủ công (ví dụ: không tìm thấy password input)
            showNotification('⚠ ' + (result.message || 'Cần xử lý thủ công. Browser đang mở để bạn có thể tiếp tục đăng nhập. Sau khi hoàn tất, vui lòng kiểm tra lại.'), 'warning');
            // Không đóng modal để người dùng biết đang chờ
        } else {
            showNotification('Lỗi đăng nhập: ' + (result.error || result.message || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

// Trash Manager
function showTrashManager() {
    document.getElementById('trashManagerModal').style.display = 'block';
    loadTrash();
}

function closeTrashManager() {
    document.getElementById('trashManagerModal').style.display = 'none';
}

async function loadTrash() {
    const tbody = document.getElementById('trashTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '<tr><td colspan="5" class="loading">Đang tải...</td></tr>';
    
    try {
        const result = await apiCall('/deleted-profiles');
        const profiles = result.profiles || [];
        
        const countEl = document.getElementById('trashCount');
        if (countEl) countEl.textContent = profiles.length;
        
        if (profiles.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="loading">Thùng rác trống</td></tr>';
            return;
        }
        
        tbody.innerHTML = profiles.map(profile => `
            <tr>
                <td>${profile.profile_id || '-'}</td>
                <td>${profile.profile_name || '-'}</td>
                <td>${profile.email || '-'}</td>
                <td>${formatDate(profile.deleted_at)}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="restoreProfile('${profile.profile_id || ''}')" title="Khôi phục">
                        ♻️ Khôi phục
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="permanentlyDeleteProfile('${profile.profile_id || ''}', '${(profile.profile_name || '').replace(/'/g, "\\'")}')" title="Xóa vĩnh viễn">
                        🗑️ Xóa vĩnh viễn
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="5" class="loading" style="color:red;">Lỗi: ${error.message}</td></tr>`;
    }
}

async function restoreProfile(profileId) {
    if (!confirm(`Khôi phục profile ID: ${profileId}?`)) {
        return;
    }
    
    try {
        showNotification('Đang khôi phục profile...', 'info');
        const result = await apiCall(`/deleted-profiles/${profileId}/restore`, 'POST');
        
        if (result.success) {
            showNotification('Đã khôi phục profile', 'success');
            loadTrash();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi khôi phục: ' + error.message, 'error');
    }
}

async function permanentlyDeleteProfile(profileId, profileName) {
    if (!confirm(`⚠️ CẢNH BÁO: Xóa vĩnh viễn profile "${profileName}"?\n\nHành động này sẽ xóa profile khỏi GPMLogin và không thể hoàn tác!`)) {
        return;
    }
    
    if (!confirm(`Xác nhận lần cuối: Xóa vĩnh viễn profile "${profileName}"?`)) {
        return;
    }
    
    try {
        showNotification('Đang xóa vĩnh viễn profile...', 'info');
        const result = await apiCall(`/deleted-profiles/${profileId}/permanent`, 'DELETE');
        
        if (result.success) {
            showNotification('Đã xóa vĩnh viễn profile', 'success');
            loadTrash();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi xóa vĩnh viễn: ' + error.message, 'error');
    }
}

async function refreshTrash() {
    loadTrash();
}

// Cache danh sách proxy để tránh load lại mỗi lần mở modal
let cachedProxyList = null;
let proxyListCacheTime = null;
const PROXY_CACHE_DURATION = 60000; // Cache 60 giây

// Load danh sách proxy vào dropdown cho account edit
async function loadProxyListForAccount(currentProxy = null, forceRefresh = false) {
    const proxySelect = document.getElementById('editAccountProxySelect');
    if (!proxySelect) return;
    
    try {
        // Hiển thị loading ngay lập tức
        proxySelect.innerHTML = '<option value="">Đang tải...</option>';
        
        // Kiểm tra cache
        const now = Date.now();
        let proxyList = null;
        
        if (!forceRefresh && cachedProxyList && proxyListCacheTime && (now - proxyListCacheTime) < PROXY_CACHE_DURATION) {
            // Sử dụng cache
            proxyList = cachedProxyList;
            console.log('[LoadProxyList] Sử dụng cache danh sách proxy');
        } else {
            // Load từ API với simple=true để lấy dữ liệu đơn giản (nhanh hơn)
            const result = await apiCall('/proxies?simple=true');
            proxyList = result.proxies || [];
            // Cập nhật cache
            cachedProxyList = proxyList;
            proxyListCacheTime = now;
            console.log('[LoadProxyList] Đã load và cache danh sách proxy');
        }
        
        // Tạo options
        let options = '<option value="__none__">-- Không có proxy --</option>';
        options += '<option value="__custom__">➕ Nhập proxy mới</option>';
        options += '<optgroup label="Danh sách proxy:">';
        
        proxyList.forEach(proxy => {
            const proxyString = proxy.raw || `${proxy.host || ''}:${proxy.port || ''}`;
            const isSelected = currentProxy && (proxyString === currentProxy || proxy.raw === currentProxy);
            options += `<option value="${(proxyString || '').replace(/"/g, '&quot;')}" ${isSelected ? 'selected' : ''}>${proxyString}${proxy.type ? ' (' + proxy.type + ')' : ''}</option>`;
        });
        
        options += '</optgroup>';
        proxySelect.innerHTML = options;
        
        // Thêm event listener cho select change
        proxySelect.onchange = function() {
            const value = this.value;
            const proxyCustom = document.getElementById('editAccountProxyCustom');
            const proxyInfoSection = document.getElementById('editAccountProxyInfoSection');
            
            if (value === '__custom__') {
                // Hiển thị input để nhập proxy mới
                if (proxyCustom) {
                    proxyCustom.style.display = 'block';
                    proxyCustom.focus();
                }
                if (proxyInfoSection) {
                    proxyInfoSection.style.display = 'none';
                }
            } else if (value === '__none__') {
                // Ẩn custom input và proxy info
                if (proxyCustom) {
                    proxyCustom.style.display = 'none';
                    proxyCustom.value = '';
                }
                if (proxyInfoSection) {
                    proxyInfoSection.style.display = 'none';
                }
                // Cập nhật proxy về null (xóa proxy)
                const accountId = document.getElementById('editAccountId').value;
                if (accountId) {
                    updateAccountProxyFromSelect(accountId, null);
                }
            } else if (value) {
                // Chọn proxy từ danh sách - tự động cập nhật
                if (proxyCustom) {
                    proxyCustom.style.display = 'none';
                    proxyCustom.value = '';
                }
                // Cập nhật proxy ngay lập tức
                const accountId = document.getElementById('editAccountId').value;
                if (accountId) {
                    updateAccountProxyFromSelect(accountId, value);
                }
            }
        };
        
        // Thêm event listener cho custom input
        const proxyCustom = document.getElementById('editAccountProxyCustom');
        if (proxyCustom) {
            proxyCustom.onblur = function() {
                const customValue = this.value.trim();
                if (customValue) {
                    // Cập nhật proxy khi blur (rời khỏi input)
                    const accountId = document.getElementById('editAccountId').value;
                    if (accountId) {
                        updateAccountProxyFromSelect(accountId, customValue);
                    }
                }
            };
            proxyCustom.onkeypress = function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur(); // Trigger onblur để cập nhật
                }
            };
        }
    } catch (error) {
        proxySelect.innerHTML = '<option value="">Lỗi tải danh sách proxy</option>';
        console.error('[LoadProxyList] Lỗi:', error);
    }
}

// Cập nhật proxy từ select (gọi API)
async function updateAccountProxyFromSelect(accountId, proxyString) {
    if (!accountId) return;
    
    try {
        showNotification('Đang cập nhật proxy...', 'info');
        
        const result = await apiCall(`/accounts/${accountId}/proxy`, 'PUT', {
            proxy: proxyString || null
        });
        
        if (result.success) {
            showNotification('Đã cập nhật proxy thành công', 'success');
            // Cập nhật currentEditAccountProxy
            currentEditAccountProxy = proxyString || null;
            // Refresh account data
            const account = accounts.find(a => a.id === parseInt(accountId));
            if (account) {
                account.proxy = proxyString || null;
                account.proxy_info = proxyString || null;
            }
            // Cập nhật UI
            const proxyInfoSection = document.getElementById('editAccountProxyInfoSection');
            if (proxyString) {
                if (proxyInfoSection) {
                    proxyInfoSection.style.display = 'block';
                    document.getElementById('editAccountProxyDisplay').textContent = proxyString;
                    // Reset status
                    document.getElementById('editAccountProxyStatusDisplay').innerHTML = 
                        '<span class="status-badge status-inactive">Chưa kiểm tra</span>';
                    document.getElementById('editAccountProxyIpDisplay').textContent = '-';
                }
            } else {
                if (proxyInfoSection) {
                    proxyInfoSection.style.display = 'none';
                }
            }
        } else {
            showNotification('Lỗi cập nhật proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật proxy: ' + error.message, 'error');
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const modals = ['addAccountModal', 'profilesModal', 'logsModal', 'proxyManagerModal', 'profileManagerModal', 'trashManagerModal', 'manualLoginModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    @keyframes slideOut {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Copy to Clipboard
function copyToClipboard(text, label = 'Text') {
    if (!text || text === '-') {
        showNotification('Không có nội dung để copy', 'warning');
        return;
    }
    
    navigator.clipboard.writeText(text).then(() => {
        showNotification(`${label} đã được copy vào clipboard`, 'success');
    }).catch(err => {
        // Fallback for older browsers
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showNotification(`${label} đã được copy vào clipboard`, 'success');
        } catch (err) {
            showNotification('Không thể copy. Vui lòng copy thủ công', 'error');
        }
        document.body.removeChild(textArea);
    });
}

// Toggle Password Visibility
function togglePasswordVisibility(inputId) {
    const input = document.getElementById(inputId);
    if (input.type === 'password') {
        input.type = 'text';
    } else {
        input.type = 'password';
    }
}

// Edit Account
// Store current account proxy info for check/change functions
let currentEditAccountProxy = null;
let currentEditAccountProxyApiUrl = null;

function editAccount(accountId) {
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
        showNotification('Không tìm thấy tài khoản', 'error');
        return;
    }
    
    // Store accountId globally để dùng trong updateAccountProxyFromSelect
    window.currentEditAccountId = account.id;
    
    document.getElementById('editAccountId').value = account.id;
    document.getElementById('editAccountEmail').value = account.email || '';
    document.getElementById('editAccountPassword').value = account.password || '';
    document.getElementById('editAccount2FA').value = account.two_factor_code || '';
    // Handle auto_change_proxy - có thể là 0/1 hoặc true/false
    const autoChangeProxyValue = account.auto_change_proxy;
    document.getElementById('editAccountAutoChangeProxy').checked = 
        autoChangeProxyValue === true || autoChangeProxyValue === 1 || autoChangeProxyValue === '1';
    document.getElementById('editAccountNotes').value = account.notes || '';
    
    // Store proxy info for check/change functions
    currentEditAccountProxy = account.proxy || account.proxy_info || null;
    currentEditAccountProxyApiUrl = account.proxy_api_url || null;
    
    // Load danh sách proxy vào dropdown
    loadProxyListForAccount(currentEditAccountProxy);
    
    // Show/hide proxy info section
    const proxyInfoSection = document.getElementById('editAccountProxyInfoSection');
    if (currentEditAccountProxy) {
        proxyInfoSection.style.display = 'block';
        document.getElementById('editAccountProxyDisplay').textContent = currentEditAccountProxy;
        // Reset status displays
        document.getElementById('editAccountProxyStatusDisplay').innerHTML = 
            '<span class="status-badge status-inactive">Chưa kiểm tra</span>';
        document.getElementById('editAccountProxyIpDisplay').textContent = '-';
    } else {
        proxyInfoSection.style.display = 'none';
    }
    
    document.getElementById('editAccountModal').style.display = 'block';
}

function closeEditAccountModal() {
    document.getElementById('editAccountModal').style.display = 'none';
    document.getElementById('editAccountForm').reset();
    // Clear proxy info
    currentEditAccountProxy = null;
    currentEditAccountProxyApiUrl = null;
    // Reset proxy select
    const proxySelect = document.getElementById('editAccountProxySelect');
    if (proxySelect) {
        proxySelect.innerHTML = '<option value="">Đang tải danh sách proxy...</option>';
    }
    const proxyCustom = document.getElementById('editAccountProxyCustom');
    if (proxyCustom) {
        proxyCustom.style.display = 'none';
        proxyCustom.value = '';
    }
}

async function updateAccount(event) {
    event.preventDefault();
    
    const accountId = document.getElementById('editAccountId').value;
    const data = {
        email: document.getElementById('editAccountEmail').value,
        password: document.getElementById('editAccountPassword').value,
        two_factor_code: document.getElementById('editAccount2FA').value,
        notes: document.getElementById('editAccountNotes').value
    };
    
    // Thêm auto_change_proxy - luôn gửi giá trị (true/false)
    const autoChangeProxyEl = document.getElementById('editAccountAutoChangeProxy');
    data.auto_change_proxy = autoChangeProxyEl ? autoChangeProxyEl.checked : false;
    
    try {
        showNotification('Đang cập nhật tài khoản...', 'info');
        const result = await apiCall(`/accounts/${accountId}`, 'PUT', data);
        if (result.success) {
            showNotification('Cập nhật tài khoản thành công', 'success');
            closeEditAccountModal();
            refreshData();
            
            // Reload Account Manager nếu đang mở
            if (typeof loadAccountManager === 'function' && 
                document.getElementById('accountManagerModal') && 
                document.getElementById('accountManagerModal').style.display === 'block') {
                loadAccountManager();
            }
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật: ' + error.message, 'error');
    }
}

// Check proxy for account being edited
async function checkAccountProxy() {
    if (!currentEditAccountProxy) {
        showNotification('Tài khoản này chưa có proxy', 'warning');
        return;
    }
    
    try {
        const statusEl = document.getElementById('editAccountProxyStatusDisplay');
        const ipEl = document.getElementById('editAccountProxyIpDisplay');
        
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-inactive">Đang kiểm tra...</span>';
        }
        
        showNotification('Đang kiểm tra proxy...', 'info');
        
        // Parse proxy string to get host:port
        let proxyString = currentEditAccountProxy;
        // If proxy is in format ip:port:user:pass, extract ip:port
        if (proxyString.includes(':')) {
            const parts = proxyString.split(':');
            if (parts.length >= 2) {
                proxyString = `${parts[0]}:${parts[1]}`;
            }
        }
        
        const requestData = {
            proxy: proxyString
        };
        // Luôn gửi proxy_api_url nếu có (từ account hoặc config)
        if (currentEditAccountProxyApiUrl && currentEditAccountProxyApiUrl.trim()) {
            requestData.proxy_api_url = currentEditAccountProxyApiUrl.trim();
        } else {
            // Nếu không có trong account, có thể dùng từ config (backend sẽ xử lý)
            console.log('[CheckAccountProxy] Không có proxy_api_url trong account, sẽ dùng từ config nếu có');
        }
        
        console.log('[CheckAccountProxy] Request data:', requestData);
        const result = await apiCall('/proxy/check', 'POST', requestData);
        
        if (result.success) {
            const status = result.status ? '✅ Hoạt động' : '❌ Không hoạt động';
            const message = result.message || result.msg || 'UNKNOWN';
            const statusMessages = {
                'MODEM_READY': 'Proxy sẵn sàng sử dụng',
                'MODEM_NOT_FOUND': 'Không tìm thấy modem',
                'MODEM_RESETTING': 'Modem đang reset',
                'MODEM_DISCONNECTED': 'Modem đã ngắt kết nối',
                'COLLISION_IP': 'Proxy có IP trùng lặp',
                'TIMEOUT': 'Timeout khi kiểm tra',
                'CONNECTION_ERROR': 'Lỗi kết nối đến API server'
            };
            
            const messageText = statusMessages[message] || message;
            const badgeClass = result.status ? 'status-active' : 'status-error';
            
            if (statusEl) {
                statusEl.innerHTML = `<span class="status-badge ${badgeClass}" title="${messageText}">${status}</span>`;
            }
            
            const displayIp = result.display_ip || result.public_ip || result.proxy_ip || '-';
            if (ipEl) {
                ipEl.textContent = displayIp;
                ipEl.style.color = '#333';
                ipEl.style.fontWeight = '500';
            }
            
            // Lưu trạng thái và IP vào database (tìm proxy_id từ proxy string)
            try {
                const proxyId = await findProxyIdByString(proxyString);
                if (proxyId) {
                    await saveProxyStatusToDatabase(proxyId, {
                        status: result.status,
                        public_ip: result.public_ip,
                        public_ip_v6: result.public_ip_v6,
                        message: result.message || result.msg
                    });
                }
            } catch (error) {
                console.error('[CheckAccountProxy] Lỗi khi lưu vào database:', error);
            }
            
            showNotification(`${status}\n${messageText}${displayIp !== '-' ? '\nIP: ' + displayIp : ''}`, result.status ? 'success' : 'warning');
        } else {
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-badge status-error">Lỗi kiểm tra</span>';
            }
            showNotification('Lỗi kiểm tra proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        const statusEl = document.getElementById('editAccountProxyStatusDisplay');
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-error">Lỗi</span>';
        }
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

// Change proxy IP for account being edited
async function changeAccountProxyIP() {
    if (!currentEditAccountProxy) {
        showNotification('Tài khoản này chưa có proxy', 'warning');
        return;
    }
    
    if (!confirm('Bạn có chắc muốn reset IP của proxy này?')) {
        return;
    }
    
    try {
        const statusEl = document.getElementById('editAccountProxyStatusDisplay');
        
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-inactive">Đang reset...</span>';
        }
        
        showNotification('Đang reset proxy IP...', 'info');
        
        // Parse proxy string to get host:port
        let proxyString = currentEditAccountProxy;
        if (proxyString.includes(':')) {
            const parts = proxyString.split(':');
            if (parts.length >= 2) {
                proxyString = `${parts[0]}:${parts[1]}`;
            }
        }
        
        // Backend sẽ tự động tìm proxy_api_url từ database dựa trên proxy string
        // Không cần gửi proxy_api_url từ account nữa
        const requestData = {
            proxy: proxyString
        };
        
        console.log('[ChangeAccountProxyIP] Request data:', requestData);
        const result = await apiCall('/proxy/reset', 'POST', requestData);
        
        if (result.success) {
            showNotification('Đã reset proxy IP thành công. Đang kiểm tra lại trạng thái...', 'success');
            
            // Check status after reset (sẽ tự động lưu vào database)
            setTimeout(() => {
                checkAccountProxy();
            }, 3000);
        } else {
            if (statusEl) {
                statusEl.innerHTML = '<span class="status-badge status-error">Lỗi reset</span>';
            }
            showNotification('Lỗi reset proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        const statusEl = document.getElementById('editAccountProxyStatusDisplay');
        if (statusEl) {
            statusEl.innerHTML = '<span class="status-badge status-error">Lỗi</span>';
        }
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

