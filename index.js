const express = require('express');
const gTTS = require('gtts');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const app = express();
app.use(express.json());

const AUTH_TOKEN = process.env.TTS_AUTH_TOKEN || 'nova-tts-2026';

// Voice profiles — mirrored from Discord bot, redqueen = Nova's voice
const voiceProfiles = {
  nova: {
    pitchShift: 0.64,
    tempo: 0.99,
    lang: 'en-uk',
    description: "Nova's signature voice — deep, commanding, and regal."
  },
  french: { pitchShift: 1.0, tempo: 0.99, lang: 'fr' },
  spanish: { pitchShift: 1.0, tempo: 1.1, lang: 'es-us' },
  german: { pitchShift: 1.0, tempo: 1.1, lang: 'de' },
  japanese: { pitchShift: 1.0, tempo: 1.1, lang: 'ja' },
  italian: { pitchShift: 1.0, tempo: 0.92, lang: 'it' },
  australian: { pitchShift: 1.0, tempo: 1.1, lang: 'en-au' },
  arabic: { pitchShift: 1.0, tempo: 1.0, lang: 'ar' },
};

const emojiRegex = /(<a?:\w+:\d+>)|([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/g;

app.post('/tts', async (req, res) => {
  const { text, lang, profile = 'nova', token } = req.body;

  if (token !== AUTH_TOKEN) return res.status(401).json({ error: 'Unauthorized' });
  if (!text) return res.status(400).json({ error: 'No text provided' });

  const voiceProfile = voiceProfiles[profile] || voiceProfiles['nova'];
  const ttsLang = lang || voiceProfile.lang || 'en-uk';
  const { pitchShift, tempo } = voiceProfile;

  const cleanText = text.slice(0, 300).replace(emojiRegex, '').trim();
  const id = Date.now();
  const rawPath = `/tmp/tts-raw-${id}.mp3`;
  const finalPath = `/tmp/tts-final-${id}.mp3`;

  const gtts = new gTTS(cleanText, ttsLang);

  gtts.save(rawPath, (err) => {
    if (err) {
      console.error('TTS failed:', err);
      return res.status(500).json({ error: 'TTS generation failed' });
    }

    // Build FFmpeg command — same logic as Discord bot
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
      // Cleanup raw file
      try { fs.unlinkSync(rawPath); } catch (_) {}

      if (err) {
        console.error('FFmpeg failed:', err);
        return res.status(500).json({ error: 'Audio processing failed' });
      }

      const data = fs.readFileSync(finalPath);
      const base64 = data.toString('base64');
      try { fs.unlinkSync(finalPath); } catch (_) {}

      res.json({ audio: base64, mimeType: 'audio/mpeg' });
    });
  });
});

app.get('/health', (_, res) => res.json({ status: 'ok', profiles: Object.keys(voiceProfiles) }));

app.listen(process.env.PORT || 3000, () => console.log('Nova TTS running'));
