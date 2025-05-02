import WebSocket, { WebSocketServer } from 'ws';
import express from 'express';
import http from 'http';
import { Deepgram } from '@deepgram/sdk';

const PORT = process.env.PORT || 10000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || 'YOUR_DEEPGRAM_API_KEY';

wss.on('connection', async (ws) => {
  console.log('📞 SignalWire client connected');

  const deepgram = new Deepgram(DEEPGRAM_API_KEY);
  const dgSocket = deepgram.transcription.live({ punctuate: true });

  let transcriptBuffer = '';

  dgSocket.on('open', () => {
    console.log('🧠 Deepgram connection opened');
  });

  dgSocket.on('transcriptReceived', (data) => {
    const transcript = JSON.parse(data);
    const text = transcript.channel?.alternatives[0]?.transcript;
    if (text && text.length > 0) {
      console.log('📝 Transcript:', text);
      transcriptBuffer += ' ' + text.toLowerCase();

      // Simple intent detection (first utterance only)
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
        transcriptBuffer += ' __intent_recognized__'; // prevent reprocessing
      }
    }
  });

  dgSocket.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  dgSocket.on('close', () => {
    console.log('🧠 Deepgram connection closed');
  });

  ws.on('message', (msg) => {
    try {
      const parsed = JSON.parse(msg);
      if (parsed.event === 'media' && parsed.media.payload) {
        const audio = Buffer.from(parsed.media.payload, 'base64');
        dgSocket.send(audio);
      }
    } catch (err) {
      console.error('⚠️ Message parsing error:', err);
    }
  });

  ws.on('close', () => {
    console.log('❎ SignalWire client disconnected');
    dgSocket.finish();
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});