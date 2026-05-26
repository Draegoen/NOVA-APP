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
  nova:       { fish: true,  lang: 'en',    tld: 'co.uk', pitchShift: 1.0,  tempo: 1.0  },
  redqueen:   { fish: false, lang: 'en',    tld: 'co.uk', pitchShift: 0.61, tempo: 0.9  },
  english:    { fish: false, lang: 'en',    tld: 'us',    pitchShift: 1.0,  tempo: 1.0  },
  french:     { fish: false, lang: 'fr',    tld: 'fr',    pitchShift: 1.0,  tempo: 0.99 },
  spanish:    { fish: false, lang: 'es',    tld: 'us',    pitchShift: 1.0,  tempo: 1.1  },
  german:     { fish: false, lang: 'de',    tld: 'com',   pitchShift: 1.0,  tempo: 1.1  },
  japanese:   { fish: false, lang: 'ja',    tld: 'com',   pitchShift: 1.0,  tempo: 1.1  },
  italian:    { fish: false, lang: 'it',    tld: 'com',   pitchShift: 1.0,  tempo: 0.92 },
  arabic:     { fish: false, lang: 'ar',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  chinese:    { fish: false, lang: 'zh-CN', tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  finnish:    { fish: false, lang: 'fi',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  hindi:      { fish: false, lang: 'hi',    tld: 'co.in', pitchShift: 1.0,  tempo: 1.0  },
  indonesian: { fish: false, lang: 'id',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  korean:     { fish: false, lang: 'ko',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  latin:      { fish: false, lang: 'la',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  portuguese: { fish: false, lang: 'pt',    tld: 'pt',    pitchShift: 1.0,  tempo: 1.0  },
  romanian:   { fish: false, lang: 'ro',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  russian:    { fish: false, lang: 'ru',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  swedish:    { fish: false, lang: 'sv',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  turkish:    { fish: false, lang: 'tr',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  translator: { fish: false, lang: 'en',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  dutch:      { fish: false, lang: 'nl',    tld: 'nl',    pitchShift: 1.0,  tempo: 1.0  },
  norwegian:  { fish: false, lang: 'no',    tld: 'no',    pitchShift: 1.0,  tempo: 1.0  },
  danish:     { fish: false, lang: 'da',    tld: 'dk',    pitchShift: 1.0,  tempo: 1.0  },
  greek:      { fish: false, lang: 'el',    tld: 'gr',    pitchShift: 1.0,  tempo: 1.0  },
  polish:     { fish: false, lang: 'pl',    tld: 'pl',    pitchShift: 1.0,  tempo: 1.0  },
  vietnamese: { fish: false, lang: 'vi',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  thai:       { fish: false, lang: 'th',    tld: 'co.th', pitchShift: 1.0,  tempo: 1.0  },
  czech:      { fish: false, lang: 'cs',    tld: 'cz',    pitchShift: 1.0,  tempo: 1.0  },
  hungarian:  { fish: false, lang: 'hu',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  croatian:   { fish: false, lang: 'hr',    tld: 'hr',    pitchShift: 1.0,  tempo: 1.0  },
  catalan:    { fish: false, lang: 'ca',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  icelandic:  { fish: false, lang: 'is',    tld: 'is',    pitchShift: 1.0,  tempo: 1.0  },
  latvian:    { fish: false, lang: 'lv',    tld: 'lv',    pitchShift: 1.0,  tempo: 1.0  },
  albanian:   { fish: false, lang: 'sq',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  serbian:    { fish: false, lang: 'sr',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
  slovak:     { fish: false, lang: 'sk',    tld: 'sk',    pitchShift: 1.0,  tempo: 1.0  },
  welsh:      { fish: false, lang: 'cy',    tld: 'co.uk', pitchShift: 1.0,  tempo: 1.0  },
  tamil:      { fish: false, lang: 'ta',    tld: 'co.in', pitchShift: 1.0,  tempo: 1.0  },
  swahili:    { fish: false, lang: 'sw',    tld: 'com',   pitchShift: 1.0,  tempo: 1.0  },
};

// Centralized text cleaner — strips emojis, Discord formatting, extra whitespace
const emojiRegex = /(<a?:\w+:\d+>)|([\u2700-\u27BF]|[\uE000-\uF8FF]|[\uD83C-\uDBFF\uDC00-\uDFFF])/g;

// More comprehensive emoji and special character cleaner
function cleanText(text, maxLength = 300) {
  return text
    .slice(0, maxLength)
    // Discord custom emoji
    .replace(/<a?:\w+:\d+>/g, '')
    // ZWJ sequences (like 🦸‍♂️) — must come before other emoji replacements
    .replace(/[\u{1F000}-\u{1FFFF}](\u200D[\u{1F000}-\u{1FFFF}][\uFE0F]?)*/gu, '')
    // Standard emoji ranges
    .replace(/[\u{2600}-\u{27BF}]/gu, '')
    .replace(/[\u{1F300}-\u{1F9FF}]/gu, '')
    .replace(/[\u{1FA00}-\u{1FA9F}]/gu, '')
    // Variation selectors (️ modifier)
    .replace(/[\uFE00-\uFE0F]/g, '')
    // Zero width joiners and non-breaking spaces
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Private use area
    .replace(/[\uE000-\uF8FF]/g, '')
    // Clean up leftover punctuation artifacts and extra spaces
    .replace(/([!?—,.])\s*([!?—,.])+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fishTTS(text) {
  const response = await fetch('https://api.fish.audio/v1/tts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${FISH_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
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

function gttsTTS(text, lang, tld, pitchShift, tempo) {
  return new Promise((resolve, reject) => {
    const id = Date.now();
    const rawPath = `/tmp/tts-raw-${id}.mp3`;
    const finalPath = `/tmp/tts-final-${id}.mp3`;

    const gtts = new gTTS(text, lang, false, tld);
    gtts.save(rawPath, (err) => {
      if (err) return reject(err);

      let ffmpegCmd;
      if (pitchShift !== 1.0 && tempo !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "asetrate=44100*${pitchShift},atempo=${tempo},loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 "${finalPath}"`;
      } else if (pitchShift !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "asetrate=44100*${pitchShift},loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 "${finalPath}"`;
      } else if (tempo !== 1.0) {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "atempo=${tempo},loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 "${finalPath}"`;
      } else {
        ffmpegCmd = `ffmpeg -y -i "${rawPath}" -filter:a "loudnorm=I=-16:TP=-1.5:LRA=11" -ar 44100 "${finalPath}"`;
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

  // Clean emojis and formatting centrally — applies to ALL profiles before processing
  const maxLen = profile === 'nova' ? 200 : 300;
  const cleaned = cleanText(text, maxLen);
  if (!cleaned) return res.status(400).json({ error: 'No speakable text after cleaning' });

  const vp = voiceProfiles[profile] || voiceProfiles['nova'];

  try {
    let base64;
    if (vp.fish) {
      base64 = await fishTTS(cleaned);
    } else {
      const ttsLang = vp.lang || 'en';
      const ttsTld = vp.tld || 'com';
      base64 = await gttsTTS(cleaned, ttsLang, ttsTld, vp.pitchShift, vp.tempo);
    }
    res.json({ audio: base64, mimeType: 'audio/mpeg' });
  } catch (err) {
    console.error('TTS error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (_, res) => res.json({ status: 'ok', profiles: Object.keys(voiceProfiles) }));

app.listen(process.env.PORT || 3000, () => console.log('Nova TTS running'));
