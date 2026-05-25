import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb'
  }
};

const API = 'https://sparkpix.ai/api/free-hd-upscale';
const REFERER = 'https://sparkpix.ai/aitools/free-hd-upscaler';

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const CACHE_DIR = './cache/upscale'; // for deduplication

const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/134.0.6998.90 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.6998.135 Mobile Safari/537.36'
];

const getRandomUA = () => USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
};

// simple in-memory rate limit for our own API (optional)
const requestLog = new Map();
const COOLDOWN_MS = 2000; // 2 seconds between requests per IP
const MAX_PER_MINUTE = 3;

const checkRateLimit = (clientId) => {
  const now = Date.now();
  const state = requestLog.get(clientId) || { timestamps: [], lastRequestAt: 0 };
  const recent = state.timestamps.filter(ts => now - ts < 60000);
  if (state.lastRequestAt && now - state.lastRequestAt < COOLDOWN_MS) {
    return { allowed: false, error: `Please wait ${Math.ceil((COOLDOWN_MS - (now - state.lastRequestAt)) / 1000)} seconds` };
  }
  if (recent.length >= MAX_PER_MINUTE) {
    return { allowed: false, error: 'Too many requests, slow down' };
  }
  recent.push(now);
  requestLog.set(clientId, { timestamps: recent, lastRequestAt: now });
  return { allowed: true };
};

const parseForm = (req) => new Promise((resolve, reject) => {
  const form = formidable({
    maxFileSize: MAX_FILE_SIZE,
    multiples: false,
    filter: ({ mimetype }) => Boolean(mimetype?.startsWith('image/'))
  });
  form.parse(req, (err, fields, files) => {
    if (err) return reject(err);
    resolve({ fields, files });
  });
});

const pick = (value, fallback = '') => {
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
};

const pickFile = (files) => {
  const file = files.image || files.file || files.upload;
  return Array.isArray(file) ? file[0] : file;
};

const normalizeQuality = (value = '4K') => {
  const raw = String(value).toUpperCase().replace(/\s+/g, '');
  if (raw === '8K' || raw === '4' || raw === '4X') return { quality: '8K', scale: '4' };
  if (raw === '6K' || raw === '3' || raw === '3X') return { quality: '6K', scale: '3' };
  return { quality: '4K', scale: '2' };
};

const parseBool = (value) => {
  const raw = String(value ?? 'false').toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
};

const getFileHash = async (filePath) => {
  const buffer = await fs.readFile(filePath);
  return crypto.createHash('md5').update(buffer).digest('hex');
};

const ensureCacheDir = async () => {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (e) {}
};

const getCachedResult = async (hash, scale, faceEnhance) => {
  const cacheKey = `${hash}_s${scale}_f${faceEnhance}.json`;
  const cachePath = `${CACHE_DIR}/${cacheKey}`;
  try {
    const data = await fs.readFile(cachePath, 'utf8');
    return JSON.parse(data);
  } catch {
    return null;
  }
};

const saveCache = async (hash, scale, faceEnhance, result) => {
  await ensureCacheDir();
  const cacheKey = `${hash}_s${scale}_f${faceEnhance}.json`;
  const cachePath = `${CACHE_DIR}/${cacheKey}`;
  await fs.writeFile(cachePath, JSON.stringify(result));
};

// retry logic with exponential backoff
async function fetchWithRetry(url, options, retries = 3, baseDelay = 1000) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      const text = await res.text();
      let json = null;
      try { json = JSON.parse(text); } catch(e) {}
      // if daily limit reached, treat as unrecoverable without proxy
      if (res.status === 429 && json && json.code === 'DAILY_LIMIT_REACHED') {
        throw new Error(`DAILY_LIMIT: ${json.error || 'Limit 2/day'}`);
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${text.slice(0,200)}`);
      }
      return { res, text, json };
    } catch (err) {
      if (i === retries-1) throw err;
      const delay = baseDelay * Math.pow(2, i) + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));
    }
  }
}

async function upscaleWithSparkPix(file, fields) {
  const qualityInput = pick(fields.quality, pick(fields.resolution, '4K'));
  const { quality, scale } = normalizeQuality(qualityInput);
  const faceEnhance = parseBool(pick(fields.faceEnhance, pick(fields.face_enhance, 'false')));

  const buffer = await fs.readFile(file.filepath);
  const fileHash = await getFileHash(file.filepath);
  
  // Check cache first
  const cached = await getCachedResult(fileHash, scale, faceEnhance);
  if (cached) {
    return {
      quality,
      scale,
      faceEnhance,
      resultUrl: cached.resultUrl,
      processingTime: cached.processingTime || 0,
      cached: true
    };
  }

  const mime = file.mimetype || 'image/jpeg';
  const filename = file.originalFilename || `image.${mime.includes('png') ? 'png' : 'jpg'}`;

  const formData = new FormData();
  formData.append('file', new Blob([buffer], { type: mime }), filename);
  formData.append('scale', scale);
  formData.append('face_enhance', String(faceEnhance));

  const started = Date.now();

  const { json } = await fetchWithRetry(API, {
    method: 'POST',
    headers: {
      accept: '*/*',
      origin: 'https://sparkpix.ai',
      referer: REFERER,
      'user-agent': getRandomUA()
    },
    body: formData
  }, 3, 1500);

  if (!json?.success || !json?.resultUrl) {
    throw new Error('Invalid response from upscale API');
  }

  const result = {
    quality,
    scale,
    faceEnhance,
    resultUrl: json.resultUrl,
    processingTime: json.processingTime ?? Date.now() - started,
    cached: false
  };

  // Save cache asynchronously (don't block)
  saveCache(fileHash, scale, faceEnhance, result).catch(e => console.error('Cache save error:', e));

  return result;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const clientId = getClientIp(req);
  const rateLimit = checkRateLimit(clientId);
  if (!rateLimit.allowed) {
    res.status(429).json({ error: rateLimit.error });
    return;
  }

  try {
    const { fields, files } = await parseForm(req);
    const file = pickFile(files);
    if (!file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    const result = await upscaleWithSparkPix(file, fields);

    res.status(200).json({
      success: true,
      mimeType: 'image/png',
      fileName: `upscaled-${result.quality.toLowerCase()}.png`,
      dataUrl: result.resultUrl,
      resultUrl: result.resultUrl,
      processingTime: result.processingTime,
      quality: result.quality,
      scale: result.scale,
      faceEnhance: result.faceEnhance,
      cached: result.cached || false
    });
  } catch (error) {
    const msg = error.message || 'Failed to process image';
    // handle daily limit specifically
    if (msg.includes('DAILY_LIMIT')) {
      res.status(429).json({ success: false, error: msg, code: 'DAILY_LIMIT_REACHED' });
    } else {
      res.status(500).json({ success: false, error: msg });
    }
  }
}
