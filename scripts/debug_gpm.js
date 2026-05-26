async function debugGpmGlobal() {
  const ports = [9495, 19995];
  const paths = [
    '/api/v3/profiles',
    '/api/v2/profiles',
    '/api/v1/profiles',
    '/api/profiles',
    '/profiles',
    '/'
  ];

  console.log('--- DEBUG GPMLOGIN API (Using Fetch) ---');
  
  for (const port of ports) {
    for (const path of paths) {
      const url = `http://127.0.0.1:${port}${path}`;
      console.log(`Testing ${url}...`);
      try {
        const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
        console.log(`✅ RESPONSE RECEIVED: ${url}`);
        console.log(`Status: ${response.status} ${response.statusText}`);
        
        const contentType = response.headers.get('content-type') || 'unknown';
        console.log(`Content-Type: ${contentType}`);
        
        const text = await response.text();
        console.log(`Data (first 250 chars): ${text.substring(0, 250)}`);
        
        if (contentType.includes('application/json')) {
            try {
                const json = JSON.parse(text);
                console.log(`✅ Valid JSON detected.`);
            } catch (e) {
                console.log(`❌ JSON Parse Error: ${e.message}`);
            }
        }
        console.log('---------------------------');
      } catch (error) {
        console.log(`❌ FAILED: ${url} - ${error.message}`);
      }
    }
  }
}

debugGpmGlobal();
