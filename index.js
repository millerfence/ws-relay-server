import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import { createClient } from '@deepgram/sdk';

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || 'YOUR_DEEPGRAM_API_KEY';

wss.on('connection', async (ws) => {
  console.log('📞 SignalWire client connected');

  const deepgram = createClient(DEEPGRAM_API_KEY);
  const dgConnection = await deepgram.listen.live({ model: 'nova', smart_format: true });

  let transcriptBuffer = '';

  dgConnection.on('transcriptReceived', (data) => {
    const text = data.channel.alternatives[0]?.transcript;
    if (text && text.length > 0) {
      console.log('📝 Transcript:', text);
      transcriptBuffer += ' ' + text.toLowerCase();

      if (transcriptBuffer.length > 0 && !transcriptBuffer.includes('__intent_recognized__')) {
        let intent = 'other';
        if (transcriptBuffer.includes('quote') || transcriptBuffer.includes('new job')) {
          intent = 'new job';
        } else if (transcriptBuffer.includes('existing')) {
          intent = 'existing job';
        } else if (transcriptBuffer.includes('warranty')) {
          intent = 'warranty';
        }
        console.log(`🤖 Intent detected: ${intent}`);
        transcriptBuffer += ' __intent_recognized__';
      }
    }
  });

  dgConnection.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  dgConnection.on('close', () => {
    console.log('🧠 Deepgram connection closed');
  });

  ws.on('message', async (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.event === 'media' && parsed.media.payload) {
        const audio = Buffer.from(parsed.media.payload, 'base64');
        console.log(`🔊 Received audio chunk (seq ${parsed.sequenceNumber})`);
        await dgConnection.send(audio);
      }
    } catch (err) {
      console.error('⚠️ Message parsing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('❎ SignalWire client disconnected');
    dgConnection.finish();
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});