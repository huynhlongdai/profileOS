/**
 * GPMTool → Google Sheets Sync
 * Deploy as Web App: Execute as "Me", Who has access "Anyone"
 * 
 * Nhận POST request từ GPMTool local app, ghi dữ liệu Accounts + Profiles vào Sheet.
 */

// ==================== CẤU HÌNH ====================
// Đặt SECRET_TOKEN khớp với token bạn điền trong GPMTool Settings
var SECRET_TOKEN = 'gpmtoolAI2026';

// Tên các sheet tabs
var ACCOUNTS_SHEET_NAME = 'Accounts';
var PROFILES_SHEET_NAME = 'Profiles';

// ==================== HANDLER ====================

/**
 * Nhận POST request từ GPMTool
 */
function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    
    // Validate secret token
    if (SECRET_TOKEN && data.secretToken !== SECRET_TOKEN) {
      return ContentService
        .createTextOutput(JSON.stringify({ success: false, error: 'Invalid secret token' }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var timestamp = data.timestamp || new Date().toISOString();
    
    // Ghi Accounts
    if (data.accounts && Array.isArray(data.accounts)) {
      writeAccountsToSheet(ss, data.accounts, timestamp);
    }
    
    // Ghi Profiles
    if (data.profiles && Array.isArray(data.profiles)) {
      writeProfilesToSheet(ss, data.profiles, timestamp);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        written: {
          accounts: (data.accounts || []).length,
          profiles: (data.profiles || []).length,
          timestamp: timestamp
        }
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Ghi dữ liệu Accounts vào sheet tab
 */
function writeAccountsToSheet(ss, accounts, timestamp) {
  var sheet = getOrCreateSheet(ss, ACCOUNTS_SHEET_NAME);
  sheet.clearContents();
  
  // Header row 1: Sync info
  sheet.getRange(1, 1, 1, 10).merge();
  sheet.getRange(1, 1).setValue('🔄 GPMTool Accounts — Sync: ' + formatTimestamp(timestamp));
  sheet.getRange(1, 1).setBackground('#1a73e8').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  
  // Header row 2: Column names
  var headers = ['#', 'Label', 'Type', 'Identifier', 'Status', 'Notes', 'Profile', 'Proxy', 'Last Login', 'Updated At'];
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(2, 1, 1, headers.length);
  headerRange.setBackground('#e8f0fe').setFontWeight('bold').setHorizontalAlignment('center');
  
  if (accounts.length === 0) {
    sheet.getRange(3, 1).setValue('(Không có dữ liệu)');
    return;
  }
  
  // Data rows
  var rows = accounts.map(function(acc) {
    return [
      acc.index || '',
      acc.label || '',
      acc.accountType || '',
      acc.identifier || '',
      acc.status || '',
      acc.notes || '',
      acc.profileName || '',
      acc.proxyLabel || '',
      acc.lastLogin ? formatTimestamp(acc.lastLogin) : '',
      acc.updatedAt ? formatTimestamp(acc.updatedAt) : ''
    ];
  });
  
  sheet.getRange(3, 1, rows.length, headers.length).setValues(rows);
  
  // Format màu theo status (cột E = cột 5)
  for (var i = 0; i < rows.length; i++) {
    var statusCell = sheet.getRange(i + 3, 5);
    var rowRange = sheet.getRange(i + 3, 1, 1, headers.length);
    var status = rows[i][4];
    colorByStatus(statusCell, rowRange, status);
  }
  
  // Auto-resize columns
  for (var col = 1; col <= headers.length; col++) {
    sheet.autoResizeColumn(col);
  }
  
  // Freeze header rows
  sheet.setFrozenRows(2);
  
  // Add border
  sheet.getRange(2, 1, rows.length + 1, headers.length)
    .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
}

/**
 * Ghi dữ liệu Profiles vào sheet tab
 */
function writeProfilesToSheet(ss, profiles, timestamp) {
  var sheet = getOrCreateSheet(ss, PROFILES_SHEET_NAME);
  sheet.clearContents();
  
  // Header row 1: Sync info
  sheet.getRange(1, 1, 1, 8).merge();
  sheet.getRange(1, 1).setValue('🖥️ GPMTool Profiles — Sync: ' + formatTimestamp(timestamp));
  sheet.getRange(1, 1).setBackground('#0f9d58').setFontColor('#ffffff').setFontWeight('bold').setFontSize(11);
  
  // Header row 2
  var headers = ['#', 'Name', 'Status', 'Browser', 'Proxy', 'Group ID', 'Last Opened', 'Updated At'];
  sheet.getRange(2, 1, 1, headers.length).setValues([headers]);
  var headerRange = sheet.getRange(2, 1, 1, headers.length);
  headerRange.setBackground('#e6f4ea').setFontWeight('bold').setHorizontalAlignment('center');
  
  if (profiles.length === 0) {
    sheet.getRange(3, 1).setValue('(Không có dữ liệu)');
    return;
  }
  
  // Data rows
  var rows = profiles.map(function(prof) {
    return [
      prof.index || '',
      prof.name || '',
      prof.status || '',
      prof.browserProvider || '',
      prof.proxyLabel || '',
      prof.groupId || '',
      prof.lastOpened ? formatTimestamp(prof.lastOpened) : '',
      prof.updatedAt ? formatTimestamp(prof.updatedAt) : ''
    ];
  });
  
  sheet.getRange(3, 1, rows.length, headers.length).setValues(rows);
  
  // Format màu theo status (cột C = cột 3)
  for (var i = 0; i < rows.length; i++) {
    var statusCell = sheet.getRange(i + 3, 3);
    var rowRange = sheet.getRange(i + 3, 1, 1, headers.length);
    var status = rows[i][2];
    colorByProfileStatus(statusCell, rowRange, status);
  }
  
  // Auto-resize columns
  for (var col = 1; col <= headers.length; col++) {
    sheet.autoResizeColumn(col);
  }
  
  sheet.setFrozenRows(2);
  
  sheet.getRange(2, 1, rows.length + 1, headers.length)
    .setBorder(true, true, true, true, true, true, '#dadce0', SpreadsheetApp.BorderStyle.SOLID);
}

// ==================== HELPERS ====================

/**
 * Lấy hoặc tạo sheet tab theo tên
 */
function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

/**
 * Format ISO timestamp thành dạng đọc được (Vietnam timezone UTC+7)
 */
function formatTimestamp(isoString) {
  if (!isoString) return '';
  try {
    var date = new Date(isoString);
    // Chuyển sang UTC+7
    var offset = 7 * 60 * 60 * 1000;
    var vnDate = new Date(date.getTime() + offset);
    var Y = vnDate.getUTCFullYear();
    var M = String(vnDate.getUTCMonth() + 1).padStart(2, '0');
    var D = String(vnDate.getUTCDate()).padStart(2, '0');
    var h = String(vnDate.getUTCHours()).padStart(2, '0');
    var m = String(vnDate.getUTCMinutes()).padStart(2, '0');
    return D + '/' + M + '/' + Y + ' ' + h + ':' + m;
  } catch(e) {
    return isoString;
  }
}

/**
 * Tô màu ô status và dòng tương ứng (Account)
 * active=xanh, logged_out=xám, error=đỏ, banned=đỏ đậm, proxy_error=cam
 */
function colorByStatus(statusCell, rowRange, status) {
  var cellBg, rowBg, textColor;
  switch ((status || '').toLowerCase()) {
    case 'active':
      cellBg = '#34a853'; rowBg = '#f0faf3'; textColor = '#ffffff'; break;
    case 'logged_out':
      cellBg = '#9aa0a6'; rowBg = '#f8f9fa'; textColor = '#ffffff'; break;
    case 'error':
      cellBg = '#ea4335'; rowBg = '#fce8e6'; textColor = '#ffffff'; break;
    case 'banned':
      cellBg = '#c62828'; rowBg = '#fde0dc'; textColor = '#ffffff'; break;
    case 'proxy_error':
      cellBg = '#ff6d00'; rowBg = '#fff3e0'; textColor = '#ffffff'; break;
    default:
      cellBg = '#e0e0e0'; rowBg = '#ffffff'; textColor = '#333333';
  }
  statusCell.setBackground(cellBg).setFontColor(textColor).setFontWeight('bold').setHorizontalAlignment('center');
  rowRange.setBackground(rowBg);
}

/**
 * Tô màu ô status và dòng tương ứng (Profile)
 * idle=xám, starting=vàng, running=xanh, stopping=cam, error=đỏ
 */
function colorByProfileStatus(statusCell, rowRange, status) {
  var cellBg, rowBg, textColor;
  switch ((status || '').toLowerCase()) {
    case 'running':
      cellBg = '#34a853'; rowBg = '#f0faf3'; textColor = '#ffffff'; break;
    case 'idle':
      cellBg = '#9aa0a6'; rowBg = '#f8f9fa'; textColor = '#ffffff'; break;
    case 'starting':
      cellBg = '#fbbc04'; rowBg = '#fef9e5'; textColor = '#333333'; break;
    case 'stopping':
      cellBg = '#ff6d00'; rowBg = '#fff3e0'; textColor = '#ffffff'; break;
    case 'error':
      cellBg = '#ea4335'; rowBg = '#fce8e6'; textColor = '#ffffff'; break;
    default:
      cellBg = '#e0e0e0'; rowBg = '#ffffff'; textColor = '#333333';
  }
  statusCell.setBackground(cellBg).setFontColor(textColor).setFontWeight('bold').setHorizontalAlignment('center');
  rowRange.setBackground(rowBg);
}
