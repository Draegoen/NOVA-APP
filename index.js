const express = require('express');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

// Simple auth token to prevent abuse
const AUTH_TOKEN = process.env.TTS_AUTH_TOKEN || 'nova-tts-secret';

app.post('/tts', async (req, res) => {
  const { text, lang = 'en', token } = req.body;

  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const clean = text.slice(0, 300).replace(/(<a?:\w+:\d+>)|([\u2700-\u27BF])/g, '').trim();
  const gttsLang = lang || 'en';
  const id = Date.now();
  const rawPath = path.join('/tmp', `tts-${id}.mp3`);

  const gtts = new gTTS(clean, gttsLang);

  gtts.save(rawPath, (err) => {
    if (err) return res.status(500).json({ error: 'TTS failed' });

    const data = fs.readFileSync(rawPath);
    const base64 = data.toString('base64');
    fs.unlinkSync(rawPath);
    res.json({ audio: base64, mimeType: 'audio/mpeg' });
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok' }));

app.listen(process.env.PORT || 3000, () => console.log('Nova TTS running'));