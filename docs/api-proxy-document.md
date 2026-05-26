API references

API - Status proxy: GET /status?proxy={ip:port}
Desc: Check status the specified proxy (by proxy) is live or not
Example: http://192.168.1.41/status?proxy=proxy.hoanong.com:4001
Response:
- status = True/False (True if OK/False is error)
- msg = MODEM_NOT_FOUND : modem is not found
       = MODEM_RESETTING : modem is resetting
       = MODEM_READY : modem/proxy is ready to use
       = COLLISION_IP : proxy has collision public ip
       = MODEM_DISCONNECTED : modem is disconnected
Resulf example: 
{
  "status": true,
  "public_ip": "171.254.79.238",
  "public_ip_v6": "2402:800:63ad:fc3:3c8a:f53b:441c:1533",
  "last_public_ip": null,
  "msg": "MODEM_READY"
}

API - Renew/change/rotate public IP of specified proxy: GET /reset?proxy={ip:port}
Example: http://192.168.1.41/reset?proxy=proxy.hoanong.com:4001