import { WebSocketServer } from 'ws';
import { createClient } from '@deepgram/sdk';
import axios from 'axios';
import * as dotenv from 'dotenv';
import http from 'http';

dotenv.config();

const DG = createClient(process.env.DEEPGRAM_API_KEY);
const PORT = process.env.PORT || 3000;
const sessions = {}; // In-memory short-term memory

const server = http.createServer(async (req, res) => {
  // ✅ GPT intake logic
  if (req.method === 'POST' && req.url === '/intake') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        const { callerId, transcript } = data;
        if (!callerId || !transcript) {
          res.writeHead(400).end(JSON.stringify({ error: 'Missing callerId or transcript' }));
          return;
        }

        if (!sessions[callerId]) {
          sessions[callerId] = { step: 'start', data: {} };
        }
        const session = sessions[callerId];
        let responseText = '';

        switch (session.step) {
          case 'start':
            session.data.category = transcript;
            session.step = 'name_first';
            responseText = "Thanks. What's your first name?";
            break;
          case 'name_first':
            session.data.firstName = transcript;
            session.step = 'name_last';
            responseText = "And your last name?";
            break;
          case 'name_last':
            session.data.lastName = transcript;
            session.step = 'phone';
            responseText = "Got it. What's your phone number?";
            break;
          case 'phone':
            session.data.phone = transcript;
            session.step = 'email';
            responseText = "Thanks. What's your email address?";
            break;
          case 'email':
            session.data.email = transcript;
            session.step = 'address';
            responseText = "Got it. What's the project address?";
            break;
          case 'address':
            session.data.address = transcript;
            session.step = 'project_type';
            responseText = "What kind of fence or deck project is this?";
            break;
          case 'project_type':
            session.data.projectType = transcript;
            session.step = 'description';
            responseText = "Tell me a bit more about the project.";
            break;
          case 'description':
            session.data.description = transcript;
            session.step = 'complete';
            console.log("✅ Final intake:", session.data);
            responseText = "Thanks! We've recorded your project info.";
            break;
          default:
            responseText = "Thanks again. We'll follow up soon!";
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: responseText }));
      } catch (e) {
        console.error('Failed to process /intake:', e);
        res.writeHead(500).end(JSON.stringify({ error: 'Server error' }));
      }
    });
  }

  // ✅ Twilio Webhook for TwiML Media Streams with explicit audio track
  else if (req.method === 'POST' && req.url === '/voice') {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Stream url="wss://ws-relay-server.onrender.com">
      <Parameter name="track" value="inbound_audio"/>
    </Stream>
  </Start>
  <Say>Hi, this is Miller Fence. One moment while we connect you to our AI assistant.</Say>
  <Pause length="1" />
  <Say>Please begin speaking after the beep.</Say>
  <Pause length="1" />
</Response>`;

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(twiml);
  }

  else {
    res.writeHead(404).end();
  }
});

const wss = new WebSocketServer({ server });

wss.on('connection', async (ws) => {
  console.log('🔌 Twilio client connected');

  const dgSocket = await DG.listen.live({
    model: 'nova-3',
    punctuate: true,
    interim_results: false,
    smart_format: true,
  });

  dgSocket.addListener('transcriptReceived', async (msg) => {
    const data = JSON.parse(msg);
    const transcript = data.channel?.alternatives?.[0]?.transcript || '';
    if (transcript) {
      console.log('📝 Transcript:', transcript);
      try {
        await axios.post('http://localhost:' + PORT + '/intake', {
          callerId: 'live-caller',
          transcript
        });
      } catch (err) {
        console.error('❌ Failed to call /intake route:', err.message);
      }
    }
  });

  dgSocket.addListener('error', e => console.error('❌ Deepgram error:', e));
  dgSocket.addListener('close', () => console.log('🔌 Deepgram connection closed'));

  ws.on('message', (data) => {
    if (dgSocket.getReadyState() === 1) {
      dgSocket.send(data);
    }
  });

  ws.on('close', () => {
    console.log('❎ Twilio client disconnected');
    dgSocket.finish();
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});