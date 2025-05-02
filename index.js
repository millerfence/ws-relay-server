import express from 'express';
import { WebSocketServer } from 'ws';
import { createClient } from '@deepgram/sdk';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 10000;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  console.log('📞 SignalWire client connected');

  const live = deepgram.listen.live({ language: 'en-US', punctuate: true });

  live.on('open', () => {
    console.log('🧠 Deepgram connection opened');
  });

  live.on('transcriptReceived', (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript && transcript.length > 0) {
      console.log('📝 Transcript:', transcript);
    }
  });

  live.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  live.on('close', () => {
    console.log('🧠 Deepgram connection closed');
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === 'media') {
        const audio = Buffer.from(msg.media.payload, 'base64');
        live.send(audio);
      }
    } catch (err) {
      console.error('Invalid message format', err);
    }
  });

  ws.on('close', () => {
    live.finish();
    console.log('❎ SignalWire client disconnected');
  });
});
