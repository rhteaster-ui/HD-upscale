import fs from 'node:fs/promises';
import formidable from 'formidable';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb'
  }
};

const REFERER = 'https://sparkpix.ai/aitools/free-hd-upscaler';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const activeProxies = [
  "65.111.4.58:3129", "209.50.172.180:3129", "45.3.48.226:3129", "216.26.244.132:3129",
  "45.3.46.54:3129", "104.207.54.7:3129", "209.50.170.100:3129", "216.26.250.230:3129",
  "209.50.185.23:3129", "104.207.52.69:3129", "104.207.47.160:3129", "104.207.38.44:3129",
  "65.111.11.69:3129", "65.111.11.51:3129", "104.207.47.187:3129", "104.207.47.72:3129",
  "65.111.5.4:3129", "104.167.19.234:3129", "45.3.42.236:3129", "104.207.60.54:3129",
  "104.207.34.116:3129", "104.207.42.246:3129", "216.26.233.96:3129", "45.3.52.24:3129",
  "216.26.237.216:3129", "104.207.35.155:3129", "45.3.51.40:3129", "104.207.32.236:3129",
  "216.26.247.92:3129", "209.50.161.21:3129", "216.26.242.130:3129", "45.3.43.153:3129",
  "65.111.12.94:3129", "104.207.45.199:3129", "216.26.239.24:3129", "209.50.178.140:3129",
  "45.3.36.14:3129", "65.111.24.193:3129", "209.50.170.151:3129", "65.111.25.117:3129",
  "216.26.230.243:3129", "45.3.42.32:3129", "45.3.44.238:3129", "216.26.253.148:3129",
  "216.26.239.34:3129", "65.111.8.197:3129", "65.111.13.135:3129", "216.26.233.178:3129",
  "209.50.173.220:3129", "104.167.25.125:3129", "209.50.165.157:3129", "65.111.25.216:3129",
  "45.3.51.238:3129", "193.56.28.139:3129", "216.26.253.63:3129", "216.26.237.70:3129",
  "45.3.41.99:3129", "65.111.14.231:3129", "65.111.1.121:3129", "216.26.234.112:3129",
  "216.26.236.117:3129", "65.111.1.225:3129", "209.50.163.75:3129", "104.207.58.65:3129",
  "209.50.190.0:3129", "209.50.178.234:3129", "45.3.42.5:3129", "104.207.56.46:3129",
  "209.50.179.245:3129", "216.26.226.2:3129", "65.111.9.46:3129", "65.111.25.169:3129",
  "65.111.4.219:3129", "216.26.249.52:3129", "216.26.231.242:3129", "216.26.248.49:3129",
  "65.111.10.221:3129", "209.50.178.242:3129", "216.26.235.24:3129", "65.111.6.4:3129",
  "104.207.33.93:3129", "45.3.62.45:3129", "65.111.6.171:3129", "45.3.33.162:3129",
  "216.26.228.50:3129", "65.111.22.54:3129", "104.167.25.182:3129", "65.111.26.37:3129",
  "45.3.42.179:3129", "216.26.235.124:3129", "216.26.224.164:3129", "65.111.25.0:3129",
  "65.111.24.232:3129", "216.26.239.166:3129", "209.50.165.126:3129", "45.3.46.123:3129",
  "65.111.0.41:3129", "65.111.22.145:3129", "65.111.23.106:3129", "65.111.21.162:3129",
  "65.111.11.135:3129", "216.26.243.208:3129", "65.111.14.44:3129", "216.26.225.190:3129",
  "216.26.242.143:3129", "209.50.179.250:3129", "104.207.58.139:3129", "216.26.227.14:3129",
  "104.207.55.170:3129", "104.207.32.202:3129", "45.3.44.165:3129", "45.3.51.239:3129",
  "65.111.23.6:3129", "104.207.32.148:3129", "216.26.232.201:3129", "104.207.45.91:3129",
  "216.26.231.0:3129", "65.111.12.178:3129", "216.26.240.79:3129", "216.26.236.220:3129",
  "104.207.47.183:3129", "65.111.12.139:3129", "209.50.162.144:3129", "216.26.237.9:3129",
  "209.50.177.154:3129", "104.207.42.144:3129", "104.207.61.52:3129", "45.3.36.252:3129",
  "65.111.31.58:3129", "216.26.234.174:3129", "65.111.24.169:3129", "104.207.55.4:3129",
  "104.167.19.193:3129", "104.207.38.242:3129", "65.111.30.85:3129", "216.26.255.197:3129",
  "104.207.38.52:3129", "65.111.28.111:3129", "45.3.51.19:3129", "209.50.182.210:3129",
  "104.167.19.216:3129", "216.26.249.178:3129", "45.3.39.200:3129", "45.3.43.193:3129",
  "104.207.37.75:3129", "209.50.176.115:3129", "45.3.52.234:3129", "45.3.52.213:3129",
  "45.3.39.102:3129", "65.111.30.202:3129", "209.50.176.143:3129", "45.3.55.82:3129",
  "209.50.163.250:3129", "104.207.57.28:3129", "209.50.183.69:3129", "216.26.251.220:3129",
  "209.50.173.44:3129", "104.207.61.188:3129", "104.207.38.176:3129", "216.26.226.22:3129",
  "104.207.38.80:3129", "209.50.165.40:3129", "45.3.50.111:3129", "216.26.241.194:3129",
  "45.3.52.170:3129", "45.3.39.43:3129", "216.26.230.188:3129", "45.3.51.183:3129",
  "216.26.226.17:3129", "216.26.241.73:3129", "104.207.47.21:3129", "65.111.27.36:3129",
  "209.50.168.205:3129", "216.26.239.154:3129", "216.26.225.76:3129", "45.3.35.139:3129",
  "104.167.19.151:3129", "209.50.169.193:3129", "216.26.226.27:3129", "104.207.43.209:3129",
  "104.207.61.105:3129", "216.26.224.92:3129", "45.3.32.18:3129", "216.26.229.133:3129",
  "216.26.226.81:3129", "65.111.5.151:3129", "216.26.249.179:3129", "216.26.254.99:3129",
  "45.3.53.8:3129", "209.50.187.101:3129", "65.111.14.17:3129"
];

let proxyIndex = 0;

function getNextProxy() {
  const proxy = activeProxies[proxyIndex % activeProxies.length];
  proxyIndex++;
  return proxy;
}

function getProxyAgent(proxyUrl) {
  return new HttpsProxyAgent(proxyUrl);
}

async function fetchWithProxy(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const proxy = getNextProxy();
    const proxyUrl = `http://${proxy}`;
    const agent = getProxyAgent(proxyUrl);
    try {
      const response = await fetch(url, {
        ...options,
        agent
      });
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
    }
  }
  throw new Error('All proxies failed');
}

async function fetchDirect(url, options) {
  return await fetch(url, options);
}

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
};

const requestLog = new Map();
const COOLDOWN_MS = 5000;
const MAX_PER_MINUTE = 2;
const MAX_PER_HOUR = 30;
const MAX_PER_DAY = 100;
const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

const checkRateLimit = (clientId) => {
  const now = Date.now();
  let state = requestLog.get(clientId);
  
  if (!state) {
    state = { 
      timestamps: [], 
      hourly: [],
      daily: [],
      lastRequestAt: 0 
    };
  }
  
  const todayRequests = state.daily.filter(ts => now - ts < DAY_MS);
  if (todayRequests.length >= MAX_PER_DAY) {
    const resetIn = Math.ceil((DAY_MS - (now - todayRequests[0])) / 1000);
    return { 
      allowed: false, 
      error: `Limit harian ${MAX_PER_DAY} request tercapai. Reset dalam ${resetIn} detik.` 
    };
  }
  
  const hourRequests = state.hourly.filter(ts => now - ts < HOUR_MS);
  if (hourRequests.length >= MAX_PER_HOUR) {
    const resetIn = Math.ceil((HOUR_MS - (now - hourRequests[0])) / 1000);
    return { 
      allowed: false, 
      error: `Limit per jam ${MAX_PER_HOUR} request tercapai. Coba lagi dalam ${resetIn} detik.` 
    };
  }
  
  const minuteRequests = state.timestamps.filter(ts => now - ts < 60000);
  if (minuteRequests.length >= MAX_PER_MINUTE) {
    const wait = Math.ceil(60 - (now - minuteRequests[0]) / 1000);
    return { 
      allowed: false, 
      error: `Santai dulu bang. Tunggu ${wait} detik sebelum request lagi.` 
    };
  }
  
  if (state.lastRequestAt && now - state.lastRequestAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - state.lastRequestAt)) / 1000);
    return { 
      allowed: false, 
      error: `Cooldown ${wait} detik. Santai dulu bang.` 
    };
  }
  
  state.timestamps.push(now);
  state.hourly.push(now);
  state.daily.push(now);
  state.lastRequestAt = now;
  
  state.timestamps = state.timestamps.filter(ts => now - ts < 60000);
  state.hourly = state.hourly.filter(ts => now - ts < HOUR_MS);
  state.daily = state.daily.filter(ts => now - ts < DAY_MS);
  
  requestLog.set(clientId, state);
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

const COMMON_HEADERS = {
  'accept': '*/*',
  'origin': 'https://sparkpix.ai',
  'referer': REFERER,
  'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
  'accept-encoding': 'gzip, deflate, br',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

async function getUploadUrl(fileBuffer, filename, mimeType, useProxy = true) {
  const fetchFunc = useProxy ? fetchWithProxy : fetchDirect;
  
  const res = await fetchFunc('https://sparkpix.ai/api/upload-url', {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      contentType: mimeType,
      size: fileBuffer.length,
      fileName: filename
    })
  });
  
  const data = await res.json();
  if (!data.success) throw new Error('Failed to get upload URL');
  return { uploadUrl: data.uploadUrl, publicUrl: data.publicUrl };
}

async function uploadToCDN(uploadUrl, fileBuffer, mimeType, useProxy = true) {
  const fetchFunc = useProxy ? fetchWithProxy : fetchDirect;
  
  await fetchFunc(uploadUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': mimeType,
      'Content-Length': fileBuffer.length.toString()
    },
    body: fileBuffer
  });
}

async function upscaleWithPublicUrl(publicUrl, scale, faceEnhance, useProxy = true) {
  const fetchFunc = useProxy ? fetchWithProxy : fetchDirect;
  
  const res = await fetchFunc('https://sparkpix.ai/api/free-hd-upscale', {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      imageUrl: publicUrl,
      scale: scale,
      face_enhance: faceEnhance
    })
  });
  
  const data = await res.json();
  if (!data.success || !data.resultUrl) throw new Error('Upscale failed');
  return data;
}

async function upscaleWithSparkPix(file, fields) {
  const qualityInput = pick(fields.quality, pick(fields.resolution, '4K'));
  const { quality, scale } = normalizeQuality(qualityInput);
  const faceEnhance = parseBool(pick(fields.faceEnhance, pick(fields.face_enhance, 'false')));
  
  const buffer = await fs.readFile(file.filepath);
  const mime = file.mimetype || 'image/jpeg';
  const filename = file.originalFilename || `image.${mime.includes('png') ? 'png' : 'jpg'}`;
  
  const started = Date.now();
  
  try {
    const { uploadUrl, publicUrl } = await getUploadUrl(buffer, filename, mime, true);
    await uploadToCDN(uploadUrl, buffer, mime, true);
    const result = await upscaleWithPublicUrl(publicUrl, parseInt(scale), faceEnhance, true);
    
    return {
      quality,
      scale,
      faceEnhance,
      resultUrl: result.resultUrl,
      processingTime: result.processingTime ?? Date.now() - started
    };
  } catch (error) {
    console.error('Upscale error:', error);
    throw error;
  }
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
      fileName: `spark-upscaled-${result.quality.toLowerCase()}.png`,
      dataUrl: result.resultUrl,
      resultUrl: result.resultUrl,
      processingTime: result.processingTime,
      quality: result.quality,
      scale: result.scale,
      faceEnhance: result.faceEnhance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error?.message || 'Failed to process image'
    });
  }
}
