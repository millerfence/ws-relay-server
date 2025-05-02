
import express from 'express';
import { WebSocketServer } from 'ws';
import { Deepgram } from '@deepgram/sdk';

const app = express();
const port = 10000;
const server = app.listen(port, () => {
  console.log(`✅ Server running on port ${port}`);
});

const wss = new WebSocketServer({ server });

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

wss.on('connection', (ws) => {
  console.log('📞 SignalWire client connected');

  const dgSocket = deepgram.transcription.live({
    punctuate: true,
    language: 'en-US',
  });

  dgSocket.on('open', () => {
    console.log('🧠 Deepgram connection opened');
  });

  dgSocket.on('transcriptReceived', (data) => {
    const transcript = JSON.parse(data);
    if (transcript.channel && transcript.channel.alternatives.length > 0) {
      const text = transcript.channel.alternatives[0].transcript;
      if (text) console.log(`📝 Transcript: ${text}`);
    }
  });

  dgSocket.on('error', (error) => {
    console.error('💥 Deepgram error:', error);
  });

  dgSocket.on('close', () => {
    console.log('🧠 Deepgram connection closed');
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === 'start') {
        console.log('🔔 Start stream event received');
      } else if (msg.event === 'media') {
        const audio = Buffer.from(msg.media.payload, 'base64');
        dgSocket.send(audio);
      }
    } catch (error) {
      console.error('❌ Failed to process message:', error);
    }
  });

  ws.on('close', () => {
    console.log('❎ SignalWire client disconnected');
    dgSocket.finish();
  });
});
