// API server cho Vercel
// Lưu ý: Trong production, nên sử dụng Vercel Postgres hoặc Supabase thay vì in-memory storage

// In-memory storage (tạm thời, sẽ mất khi server restart)
// Trong production, thay bằng database cloud
let accountsData = {};
let logsData = [];

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { method, query, body } = req;

  try {
    const endpoint = query.endpoint || body?.endpoint;

    switch (method) {
      case 'GET':
        if (endpoint === 'accounts') {
          return await getAccounts(req, res);
        } else if (endpoint === 'status') {
          return await getStatus(req, res, query);
        } else if (endpoint === 'logs') {
          return await getLogs(req, res, query);
        } else if (endpoint === 'stats') {
          return await getStats(req, res);
        }
        break;
      
      case 'POST':
        if (endpoint === 'update' || !endpoint) {
          return await updateStatus(req, res, body);
        }
        break;
    }

    res.status(404).json({ error: 'Endpoint not found' });
  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: error.message });
  }
}

async function getAccounts(req, res) {
  const accounts = Object.values(accountsData);
  res.status(200).json({ 
    success: true,
    accounts: accounts,
    count: accounts.length 
  });
}

async function getStatus(req, res, query) {
  const { email } = query;
  
  if (email) {
    const account = accountsData[email];
    if (account) {
      return res.status(200).json({ 
        success: true,
        status: account 
      });
    } else {
      return res.status(404).json({ 
        success: false,
        error: 'Account not found' 
      });
    }
  } else {
    // Trả về tất cả status
    const accounts = Object.values(accountsData);
    return res.status(200).json({ 
      success: true,
      accounts: accounts,
      lastUpdate: new Date().toISOString()
    });
  }
}

async function getLogs(req, res, query) {
  const { email, limit = 50 } = query;
  
  let logs = logsData;
  if (email) {
    logs = logs.filter(log => log.email === email);
  }
  
  logs = logs.slice(0, parseInt(limit));
  res.status(200).json({ 
    success: true,
    logs: logs 
  });
}

async function getStats(req, res) {
  const accounts = Object.values(accountsData);
  
  const stats = {
    total: accounts.length,
    active: accounts.filter(a => a.status === 'active').length,
    loggedOut: accounts.filter(a => a.status === 'logged_out').length,
    loginFailed: accounts.filter(a => a.status === 'login_failed').length,
    wrongAccount: accounts.filter(a => a.status === 'wrong_account').length,
    errors: accounts.filter(a => a.status === 'error').length,
    lastUpdate: new Date().toISOString()
  };
  
  res.status(200).json({ 
    success: true,
    stats: stats 
  });
}

async function updateStatus(req, res, body) {
  const { email, status, lastCheck, lastLogin, lastCare, timestamp } = body;
  
  if (!email) {
    return res.status(400).json({ 
      success: false,
      error: 'Email is required' 
    });
  }
  
  // Cập nhật hoặc tạo mới account
  if (!accountsData[email]) {
    accountsData[email] = {
      email: email,
      status: 'unknown',
      lastCheck: null,
      lastLogin: null,
      lastCare: null,
      createdAt: new Date().toISOString()
    };
  }
  
  accountsData[email].status = status || accountsData[email].status;
  accountsData[email].lastCheck = lastCheck || accountsData[email].lastCheck;
  accountsData[email].lastLogin = lastLogin || accountsData[email].lastLogin;
  accountsData[email].lastCare = lastCare || accountsData[email].lastCare;
  accountsData[email].updatedAt = timestamp || new Date().toISOString();
  
  // Thêm log
  logsData.unshift({
    email: email,
    event: 'status_update',
    status: status,
    timestamp: timestamp || new Date().toISOString()
  });
  
  // Giới hạn logs (giữ 1000 logs gần nhất)
  if (logsData.length > 1000) {
    logsData = logsData.slice(0, 1000);
  }
  
  res.status(200).json({ 
    success: true,
    message: 'Status updated',
    account: accountsData[email]
  });
}

