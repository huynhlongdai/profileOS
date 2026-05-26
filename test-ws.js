const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3212/?profileId=123&debuggerPort=9222');

ws.on('open', () => {
    console.log('Connected to WS');
    setTimeout(() => ws.close(), 1000);
});
ws.on('message', (data) => console.log('Message:', data.toString()));
ws.on('error', (err) => console.error('WS Error:', err.message));
ws.on('close', () => console.log('WS Closed'));
