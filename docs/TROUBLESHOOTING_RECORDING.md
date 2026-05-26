# Troubleshooting Recording Issues

## Common Errors and Solutions

### 1. ECONNREFUSED Error - Cannot connect to GPMLogin

**Error Message:**
```
Error: connect ECONNREFUSED 127.0.0.1:19995
```

**Cause:**
GPMLogin service is not running or not accessible at the configured port.

**Solutions:**

1. **Check if GPMLogin is running**
   - Open GPMLogin application
   - Ensure it's fully started (check system tray)

2. **Verify API Port**
   - Default port: 19995
   - Check GPMLogin settings → API Port
   - Verify `GPMLOGIN_API_URL` environment variable matches

3. **Check Firewall**
   - Ensure firewall is not blocking port 19995
   - Allow GPMLogin through Windows Firewall

4. **Restart GPMLogin**
   - Close GPMLogin completely
   - Restart GPMLogin application
   - Wait for it to fully initialize

### 2. Profile Not Starting

**Error Message:**
```
Error starting GPMLogin profile
```

**Solutions:**

1. **Check Profile Status**
   - Verify profile exists in GPMLogin
   - Check if profile is already running
   - Ensure profile is not corrupted

2. **Try Starting Profile Manually**
   - Open GPMLogin
   - Start the profile manually
   - Verify it starts successfully

## Quick Fixes

### Fix 1: Restart Everything
1. Stop all profiles
2. Close GPMLogin
3. Restart GPMLogin
4. Wait for initialization
5. Try recording again

### Fix 2: Check GPMLogin Connection
1. Open GPMLogin application
2. Go to Settings → API Settings
3. Verify API Port is 19995 (or your configured port)
4. Ensure API is enabled
