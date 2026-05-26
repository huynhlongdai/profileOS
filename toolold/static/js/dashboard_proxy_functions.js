// Change Account Proxy Functions
function showChangeAccountProxyModal() {
    const modal = document.getElementById('changeAccountProxyModal');
    modal.style.display = 'block';
    // Thêm class modal-overlay-high để hiển thị trên modal chỉnh sửa
    modal.classList.add('modal-overlay-high');
    document.getElementById('changeAccountProxyInput').value = currentEditAccountProxy || '';
    loadProxiesForAccount();
}

function closeChangeAccountProxyModal() {
    const modal = document.getElementById('changeAccountProxyModal');
    modal.style.display = 'none';
    // Xóa class modal-overlay-high khi đóng
    modal.classList.remove('modal-overlay-high');
    document.getElementById('changeAccountProxyInput').value = '';
}

async function loadProxiesForAccount() {
    try {
        const result = await apiCall('/proxies');
        const proxyList = result.proxies || [];
        
        // Tạo modal để chọn proxy (tái sử dụng profilesModal)
        const modal = document.getElementById('profilesModal');
        const tbody = document.getElementById('profilesTableBody');
        const thead = document.getElementById('profilesTable')?.querySelector('thead tr');
        
        if (thead) {
            thead.innerHTML = '<th>Proxy</th><th>Type</th><th>Host:Port</th><th>Thao tác</th>';
        }
        
        if (proxyList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Không có proxy nào. Thêm proxy vào file proxies.txt hoặc qua API.</td></tr>';
            return;
        }
        
        tbody.innerHTML = proxyList.map((proxy, index) => `
            <tr>
                <td>${proxy.raw || '-'}</td>
                <td>${proxy.type || 'http'}</td>
                <td>${proxy.host || '-'}:${proxy.port || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectProxyForAccount('${(proxy.raw || '').replace(/'/g, "\\'")}')">
                        Chọn
                    </button>
                </td>
            </tr>
        `).join('');
        
        document.querySelector('#profilesModal .modal-header h2').textContent = 'Chọn Proxy';
        // Thêm class modal-overlay-high để hiển thị trên modal chọn proxy
        modal.classList.add('modal-overlay-high');
        modal.style.display = 'block';
    } catch (error) {
        showNotification('Lỗi tải danh sách proxy: ' + error.message, 'error');
    }
}

function selectProxyForAccount(proxyString) {
    document.getElementById('changeAccountProxyInput').value = proxyString;
    closeProfilesModal();
}

async function updateAccountProxy() {
    const accountId = document.getElementById('editAccountId').value;
    const newProxy = document.getElementById('changeAccountProxyInput').value.trim();
    
    if (!accountId) {
        showNotification('Không tìm thấy tài khoản', 'error');
        return;
    }
    
    try {
        showNotification('Đang cập nhật proxy...', 'info');
        const result = await apiCall(`/accounts/${accountId}/proxy`, 'PUT', {
            proxy: newProxy || null
        });
        
        if (result.success) {
            showNotification('Đã cập nhật proxy thành công', 'success');
            closeChangeAccountProxyModal();
            // Refresh account data
            refreshData();
            // Reload edit account modal
            editAccount(accountId);
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật proxy: ' + error.message, 'error');
    }
}

// Change Profile Proxy Functions
function showChangeProfileProxyModal(profileId, currentProxy = '') {
    const modal = document.getElementById('changeProfileProxyModal');
    modal.style.display = 'block';
    // Thêm class modal-overlay-high để hiển thị trên modal quản lý profiles
    modal.classList.add('modal-overlay-high');
    document.getElementById('changeProfileProxyProfileId').value = profileId;
    document.getElementById('changeProfileProxyInput').value = currentProxy || '';
    loadProxiesForProfile();
}

function closeChangeProfileProxyModal() {
    const modal = document.getElementById('changeProfileProxyModal');
    modal.style.display = 'none';
    // Xóa class modal-overlay-high khi đóng
    modal.classList.remove('modal-overlay-high');
    document.getElementById('changeProfileProxyInput').value = '';
    document.getElementById('changeProfileProxyProfileId').value = '';
}

async function loadProxiesForProfile() {
    try {
        const result = await apiCall('/proxies');
        const proxyList = result.proxies || [];
        
        // Tạo modal để chọn proxy (tái sử dụng profilesModal)
        const modal = document.getElementById('profilesModal');
        const tbody = document.getElementById('profilesTableBody');
        const thead = document.getElementById('profilesTable')?.querySelector('thead tr');
        
        if (thead) {
            thead.innerHTML = '<th>Proxy</th><th>Type</th><th>Host:Port</th><th>Thao tác</th>';
        }
        
        if (proxyList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="loading">Không có proxy nào. Thêm proxy vào file proxies.txt hoặc qua API.</td></tr>';
            return;
        }
        
        tbody.innerHTML = proxyList.map((proxy, index) => `
            <tr>
                <td>${proxy.raw || '-'}</td>
                <td>${proxy.type || 'http'}</td>
                <td>${proxy.host || '-'}:${proxy.port || '-'}</td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="selectProxyForProfile('${(proxy.raw || '').replace(/'/g, "\\'")}')">
                        Chọn
                    </button>
                </td>
            </tr>
        `).join('');
        
        document.querySelector('#profilesModal .modal-header h2').textContent = 'Chọn Proxy';
        // Thêm class modal-overlay-high để hiển thị trên modal chọn proxy
        modal.classList.add('modal-overlay-high');
        modal.style.display = 'block';
    } catch (error) {
        showNotification('Lỗi tải danh sách proxy: ' + error.message, 'error');
    }
}

function selectProxyForProfile(proxyString) {
    document.getElementById('changeProfileProxyInput').value = proxyString;
    closeProfilesModal();
}

async function updateProfileProxy() {
    const profileId = document.getElementById('changeProfileProxyProfileId').value;
    const newProxy = document.getElementById('changeProfileProxyInput').value.trim();
    
    if (!profileId) {
        showNotification('Không tìm thấy profile', 'error');
        return;
    }
    
    try {
        showNotification('Đang cập nhật proxy cho profile...', 'info');
        const result = await apiCall(`/gpmlogin/profiles/${profileId}/proxy`, 'PUT', {
            proxy: newProxy || null
        });
        
        if (result.success) {
            showNotification('Đã cập nhật proxy cho profile thành công', 'success');
            closeChangeProfileProxyModal();
            // Refresh profiles list
            refreshProfiles();
        } else {
            showNotification('Lỗi: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        showNotification('Lỗi cập nhật proxy: ' + error.message, 'error');
    }
}

