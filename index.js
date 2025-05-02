import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  console.log('📞 SignalWire client connected');

  ws.on('message', (message) => {
    // Message from SignalWire media stream (base64-encoded audio)
    console.log('🔊 Received message:', message.toString().substring(0, 60) + '...');
  });

  ws.on('close', () => {
    console.log('❎ SignalWire client disconnected');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});