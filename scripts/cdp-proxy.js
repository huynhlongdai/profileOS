const http = require('http');
const httpProxy = require('http-proxy');

// Create a proxy server with custom application logic
const proxy = httpProxy.createProxyServer({
    ws: true,
    ignorePath: true
});

proxy.on('error', function (err, req, res) {
    console.error('Proxy error:', err.message);
    if (res && res.writeHead) {
        res.writeHead(500, {
            'Content-Type': 'text/plain'
        });
        res.end('Proxy error: ' + err.message);
    }
});

proxy.on('proxyRes', function (proxyRes, req, res) {
    // Intercept JSON responses to rewrite 127.0.0.1 to our IP
    if (req.url.includes('/json')) {
        let body = [];
        proxyRes.on('data', function (chunk) {
            body.push(chunk);
        });
        proxyRes.on('end', function () {
            try {
                let jsonString = Buffer.concat(body).toString();
                // Replace 127.0.0.1 with the host that requested this
                const host = req.headers.host;
                if (host) {
                    jsonString = jsonString.replace(/127\.0\.0\.1/g, host.split(':')[0]);
                    jsonString = jsonString.replace(/localhost/g, host.split(':')[0]);
                }
                res.end(jsonString);
            } catch (e) {
                res.end(Buffer.concat(body));
            }
        });
    }
});

const server = http.createServer(function (req, res) {
    // Expected URL format: /proxy/12345/json/version
    const match = req.url.match(/^\/proxy\/(\d+)(.*)/);
    if (match) {
        const targetPort = match[1];
        const targetPath = match[2] || '/';
        req.url = targetPath; // Update URL for the target

        // If it's a JSON endpoint, we intercept it
        if (targetPath.includes('/json')) {
            // We must handle the response ourselves to rewrite the body
            proxy.web(req, res, {
                target: `http://127.0.0.1:${targetPort}`,
                selfHandleResponse: true
            });
        } else {
            proxy.web(req, res, {
                target: `http://127.0.0.1:${targetPort}`
            });
        }
    } else {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('GPMTool CDP Proxy Server is running. Format: /proxy/PORT/json');
    }
});

server.on('upgrade', function (req, socket, head) {
    // Expected URL format: /proxy/12345/devtools/browser/xyz
    const match = req.url.match(/^\/proxy\/(\d+)(.*)/);
    if (match) {
        const targetPort = match[1];
        req.url = match[2] || '/'; // Update URL for the target
        proxy.ws(req, socket, head, {
            target: `ws://127.0.0.1:${targetPort}`
        });
    } else {
        socket.destroy();
    }
});

const PORT = 19996;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`=========================================`);
    console.log(` CDP Proxy Server is listening on port ${PORT}`);
    console.log(` Allow this port in Windows Firewall`);
    console.log(`=========================================`);
});
