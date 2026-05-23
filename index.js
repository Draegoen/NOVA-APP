const express = require('express');
const gTTS = require('gtts');
const fs = require('fs');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

const AUTH_TOKEN = process.env.TTS_AUTH_TOKEN || 'nova-tts-2026';
const FISH_API_KEY = process.env.FISH_API_KEY;
const NOVA_VOICE_ID = '499da4063f3640729a23bdc545e24e3f';

const voiceProfiles = {
  nova:       { pitchShift: 1.0, tempo: 1.0, lang: 'en-uk', fish: true },
  french:     { pitchShift: 1.0, tempo: 0.99, lang: 'fr' },
  spanish:    { pitchShift: 1.0, tempo: 1.1,  lang: 'es-us' },
  german:     { pitchShift: 1.0, tempo: 1.1,  lang: 'de' },
  japanese:   { pitchShift: 1.0, tempo: 1.1,  lang: 'ja' },
  italian:    { pitchShift: 1.0, tempo: 0.92, lang: 'it' },
  australian: { pitchShift: 1.0, tempo: 1.1,  lang: 'en-au' },
  arabic:     { pitchShift: 1.0, tempo: 1.0,  lang: 'ar' },
};

const emojiRegex = /(<a?:\w+:\d+>)|([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/g;

async function fishTTS(text) {
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text: text.slice(0, 300),
      reference_id: NOVA_VOICE_ID,
      format: 'mp3',
      latency: 'normal',
      normalize: true,
    }),
  });

  if (!response.ok) throw new Error(await response.text());
  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer).toString('base64');
}

function gttsTTS(text, lang, pitchShift, tempo) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const rawPath = `/tmp/tts-raw-${id}.mp3`;
    const finalPath = `/tmp/tts-final-${id}.mp3`;
    const cleanText = text.slice(0, 300).replace(emojiRegex, '').trim();

    const gtts = new gTTS(cleanText, lang);
    gtts.save(rawPath, (err) => {
      if (err) return reject(err);

      let ffmpegCmd;
      if (pitchShift !== 1.0 && tempo !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "asetrate=44100*${pitchShift},atempo=${tempo}" "${finalPath}"`;
      } else if (pitchShift !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "asetrate=44100*${pitchShift}" "${finalPath}"`;
      } else if (tempo !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "atempo=${tempo}" "${finalPath}"`;
      } else {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" "${finalPath}"`;
      }

      exec(ffmpegCmd, (err) => {
        try { fs.unlinkSync(rawPath); } catch (_) {}
        if (err) return reject(err);
        const data = fs.readFileSync(finalPath);
        try { fs.unlinkSync(finalPath); } catch (_) {}
        resolve(data.toString('base64'));
      });
    });
  });
}

app.post('/tts', async (req, res) => {
  const { text, lang, profile = 'nova', token } = req.body;

  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const voiceProfile = voiceProfiles[profile] || voiceProfiles['nova'];

  try {
    let base64;

    if (voiceProfile.fish) {
      // Nova voice — use Fish.audio clone
      base64 = await fishTTS(text);
    } else {
      // All other profiles — use gTTS + FFmpeg
      const ttsLang = lang || voiceProfile.lang || 'en';
      base64 = await gttsTTS(text, ttsLang, voiceProfile.pitchShift, voiceProfile.tempo);
    }

    res.json({ audio: base64, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', profiles: Object.keys(voiceProfiles) }));

app.listen(process.env.PORT || 3000, () => console.log('Nova TTS running'));
