// Endpoint riêng cho status updates
// Có thể sử dụng endpoint này thay vì /api/index.js?endpoint=update

let accountsData = {};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'GET') {
    // Lấy status từ storage
    const accounts = Object.values(accountsData);
    res.status(200).json({
      success: true,
      accounts: accounts,
      lastUpdate: new Date().toISOString()
    });
  } else if (req.method === 'POST') {
    // Nhận update từ local app
    const { email, status, lastCheck, lastLogin, lastCare, timestamp } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false,
        error: 'Email is required' 
      });
    }
    
    // Lưu status
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
    
    res.status(200).json({ 
      success: true,
      message: 'Status saved',
      account: accountsData[email]
    });
  } else {
    res.status(405).json({ error: 'Method not allowed' });
  }
}

