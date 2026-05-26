// Account Manager Functions
function showAccountManager() {
    document.getElementById('accountManagerModal').style.display = 'block';
    loadAccountManager();
}

function closeAccountManagerModal() {
    document.getElementById('accountManagerModal').style.display = 'none';
}

async function loadAccountManager() {
    try {
        const result = await apiCall('/accounts');
        const accountsData = result.accounts || [];
        
        const tbody = document.getElementById('accountManagerTableBody');
        if (accountsData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="loading">Chưa có tài khoản nào</td></tr>';
            return;
        }
        
        tbody.innerHTML = accountsData.map(account => `
            <tr>
                <td>${account.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span>${account.email || '-'}</span>
                        <button class="btn-icon" onclick="copyToClipboard('${(account.email || '').replace(/'/g, "\\'")}', 'Email')" title="Copy email">📋</button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span>${account.password ? '••••••••' : '-'}</span>
                        ${account.password ? `<button class="btn-icon" onclick="copyToClipboard('${(account.password || '').replace(/'/g, "\\'")}', 'Password')" title="Copy password">📋</button>` : ''}
                    </div>
                </td>
                <td>${account.gpmlogin_profile_id || '-'}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 5px;">
                        <span>${account.proxy_info || '-'}</span>
                        ${account.proxy_info ? `
                            <button class="btn-icon" onclick="checkProxyStatus(${account.id}, '${(account.proxy_info || '').replace(/'/g, "\\'")}', '${(account.proxy_api_url || '').replace(/'/g, "\\'")}')" title="Kiểm tra proxy">🔍</button>
                            <button class="btn-icon" onclick="resetProxyIP(${account.id}, '${(account.proxy_info || '').replace(/'/g, "\\'")}', '${(account.proxy_api_url || '').replace(/'/g, "\\'")}')" title="Change proxy IP">🔄</button>
                        ` : ''}
                    </div>
                </td>
                <td>
                    <span class="status-badge status-${getStatusClass(account.status)}">
                        ${getStatusText(account.status)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <button class="btn-icon" onclick="editAccountFromManager(${account.id})" title="Chỉnh sửa">✏️</button>
                        <button class="btn-icon" onclick="copyAccountCookies(${account.id})" title="Copy cookies">🍪</button>
                    </div>
                </td>
            </tr>
        `).join('');
    } catch (error) {
        showNotification('Lỗi tải dữ liệu: ' + error.message, 'error');
    }
}

function filterAccountManager() {
    const search = document.getElementById('accountManagerSearch').value.toLowerCase();
    const rows = document.querySelectorAll('#accountManagerTableBody tr');
    
    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(search) ? '' : 'none';
    });
}

async function exportAccounts(format) {
    try {
        if (format === 'csv') {
            window.location.href = `/api/accounts/export?format=csv`;
            showNotification('Đang tải file CSV...', 'info');
        } else {
            const result = await apiCall('/accounts/export?format=json');
            const dataStr = JSON.stringify(result.accounts, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `accounts_export_${new Date().toISOString().split('T')[0]}.json`;
            link.click();
            URL.revokeObjectURL(url);
            showNotification('Đã export JSON', 'success');
        }
    } catch (error) {
        showNotification('Lỗi export: ' + error.message, 'error');
    }
}

async function copyAllEmails() {
    try {
        const result = await apiCall('/accounts');
        const emails = result.accounts.map(a => a.email).filter(e => e).join('\n');
        await navigator.clipboard.writeText(emails);
        showNotification(`Đã copy ${result.accounts.length} email`, 'success');
    } catch (error) {
        showNotification('Lỗi copy: ' + error.message, 'error');
    }
}

async function copyAllPasswords() {
    try {
        const result = await apiCall('/accounts');
        const passwords = result.accounts.map(a => a.password || '').filter(p => p).join('\n');
        await navigator.clipboard.writeText(passwords);
        showNotification(`Đã copy ${result.accounts.filter(a => a.password).length} password`, 'success');
    } catch (error) {
        showNotification('Lỗi copy: ' + error.message, 'error');
    }
}

async function copyAllCookies() {
    try {
        const result = await apiCall('/accounts');
        const cookiesList = [];
        
        for (const account of result.accounts) {
            if (account.cookies) {
                try {
                    const cookiesResult = await apiCall(`/accounts/${account.id}/cookies`);
                    if (cookiesResult.cookies) {
                        cookiesList.push(`=== ${account.email} ===\n${JSON.stringify(cookiesResult.cookies, null, 2)}\n`);
                    }
                } catch (e) {
                    // Skip accounts without cookies
                }
            }
        }
        
        if (cookiesList.length > 0) {
            await navigator.clipboard.writeText(cookiesList.join('\n'));
            showNotification(`Đã copy cookies của ${cookiesList.length} tài khoản`, 'success');
        } else {
            showNotification('Không có cookies nào để copy', 'warning');
        }
    } catch (error) {
        showNotification('Lỗi copy: ' + error.message, 'error');
    }
}

async function copyAccountCookies(accountId) {
    try {
        const result = await apiCall(`/accounts/${accountId}/cookies`);
        if (result.cookies) {
            const cookiesStr = JSON.stringify(result.cookies, null, 2);
            await navigator.clipboard.writeText(cookiesStr);
            showNotification('Đã copy cookies', 'success');
        } else {
            showNotification('Tài khoản này chưa có cookies', 'warning');
        }
    } catch (error) {
        showNotification('Lỗi copy cookies: ' + error.message, 'error');
    }
}

// Chỉnh sửa tài khoản từ Account Manager
async function editAccountFromManager(accountId) {
    try {
        const result = await apiCall(`/accounts/${accountId}`);
        const account = result.account;
        
        if (!account) {
            showNotification('Không tìm thấy tài khoản', 'error');
            return;
        }
        
        // Điền thông tin vào form chỉnh sửa
        document.getElementById('editAccountId').value = account.id;
        document.getElementById('editAccountEmail').value = account.email || '';
        document.getElementById('editAccountPassword').value = account.password || '';
        document.getElementById('editAccount2FA').value = account.two_factor_code || '';
        document.getElementById('editAccountNotes').value = account.notes || '';
        
        // Hiển thị modal chỉnh sửa
        document.getElementById('editAccountModal').style.display = 'block';
    } catch (error) {
        showNotification('Lỗi tải thông tin tài khoản: ' + error.message, 'error');
    }
}

// Kiểm tra trạng thái proxy
async function checkProxyStatus(accountId, proxyInfo, proxyApiUrl) {
    try {
        showNotification('Đang kiểm tra proxy...', 'info');
        
        // Parse proxy để lấy host:port
        const proxyParts = proxyInfo.split(':');
        if (proxyParts.length < 2) {
            showNotification('Định dạng proxy không hợp lệ', 'error');
            return;
        }
        
        const proxyString = `${proxyParts[0]}:${proxyParts[1]}`;
        
        const result = await apiCall('/proxy/check', 'POST', {
            proxy: proxyString,
            proxy_api_url: proxyApiUrl || null
        });
        
        if (result.success) {
            const status = result.status ? '✅ Hoạt động' : '❌ Không hoạt động';
            const message = result.message || 'UNKNOWN';
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
            showNotification(`${status}\n${messageText}`, result.status ? 'success' : 'warning');
        } else {
            showNotification('Lỗi kiểm tra proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

// Reset/Change proxy IP
async function resetProxyIP(accountId, proxyInfo, proxyApiUrl) {
    if (!confirm('Bạn có chắc muốn reset IP của proxy này?')) {
        return;
    }
    
    try {
        showNotification('Đang reset proxy IP...', 'info');
        
        // Parse proxy để lấy host:port
        const proxyParts = proxyInfo.split(':');
        if (proxyParts.length < 2) {
            showNotification('Định dạng proxy không hợp lệ', 'error');
            return;
        }
        
        const proxyString = `${proxyParts[0]}:${proxyParts[1]}`;
        
        const result = await apiCall('/proxy/reset', 'POST', {
            proxy: proxyString,
            proxy_api_url: proxyApiUrl || null
        });
        
        if (result.success) {
            showNotification('Đã reset proxy IP thành công. Vui lòng đợi vài giây để proxy hoàn tất.', 'success');
        } else {
            showNotification('Lỗi reset proxy: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi: ' + error.message, 'error');
    }
}

