import { WebSocketServer } from 'ws';
import { Deepgram } from '@deepgram/sdk';
import axios from 'axios';
import * as dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const DG = new Deepgram(process.env.DEEPGRAM_API_KEY);
const VERCEL_API_ENDPOINT = process.env.VERCEL_API_ENDPOINT;
const PORT = process.env.PORT || 3000;

const server = http.createServer();
const wss = new WebSocketServer({ server });

console.log('🚀 WebSocket Relay Server starting...');

wss.on('connection', async (ws) => {
  console.log('🔌 Twilio client connected');

  const deepgramSocket = await DG.transcription.live({
    model: 'nova-3',
    punctuate: true,
    interim_results: false,
    smart_format: true,
  });

  deepgramSocket.on('open', () => console.log('🔗 Connected to Deepgram'));
  deepgramSocket.on('error', (e) => console.error('❌ Deepgram error:', e));

  deepgramSocket.on('transcriptReceived', async (msg) => {
    const data = JSON.parse(msg);
    const transcript = data.channel?.alternatives[0]?.transcript || '';
    if (transcript) {
      console.log('📝 Transcript:', transcript);
      try {
        await axios.post(VERCEL_API_ENDPOINT, {
          callerId: 'live-caller',
          transcript
        });
      } catch (err) {
        console.error('❌ Failed to POST to Vercel:', err.message);
      }
    }
  });

  ws.on('message', (data) => {
    if (deepgramSocket.getReadyState() === 1) {
      deepgramSocket.send(data);
    }
  });

  ws.on('close', () => {
    console.log('❎ Twilio client disconnected');
    deepgramSocket.close();
  });
});

server.listen(PORT, () => {
  console.log(`✅ WebSocket server running on port ${PORT}`);
});