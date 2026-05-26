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

const API = 'https://sparkpix.ai/api/free-hd-upscale';
const REFERER = 'https://sparkpix.ai/aitools/free-hd-upscaler';

const MAX_FILE_SIZE = 10 * 1024 * 1024;

// 191 active proxies hasil testing (IP:port)
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
  const isHttps = API.startsWith('https');
  if (isHttps) {
    return new HttpsProxyAgent(proxyUrl);
  } else {
    return new HttpProxyAgent(proxyUrl);
  }
}

async function fetchWithProxy(url, options, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const proxy = getNextProxy();
    const proxyUrl = `http://${proxy}`;
    const agent = getProxyAgent(proxyUrl);
    try {
      const response = await fetch(url, {
        ...options,
        // @ts-ignore
        agent
      });
      if (response.status === 429 && response.headers.get('x-daily-limit')) {
        // daily limit untuk proxy ini, coba proxy lain
        continue;
      }
      return response;
    } catch (err) {
      if (attempt === retries) throw err;
      // coba proxy lain
    }
  }
  throw new Error('All proxies failed');
}

// Rest of the original code, but replace the fetch call inside upscaleWithSparkPix
// We'll modify upscaleWithSparkPix to use fetchWithProxy

// ... (copy paste fungsi lain: getClientIp, checkRateLimit, parseForm, pick, pickFile, normalizeQuality, parseBool)

// Saya tulis ulang hanya bagian yang diubah

async function upscaleWithSparkPix(file, fields) {
  const qualityInput = pick(fields.quality, pick(fields.resolution, '4K'));
  const { quality, scale } = normalizeQuality(qualityInput);
  const faceEnhance = parseBool(pick(fields.faceEnhance, pick(fields.face_enhance, 'false')));

  const buffer = await fs.readFile(file.filepath);
  const mime = file.mimetype || 'image/jpeg';
  const filename = file.originalFilename || `image.${mime.includes('png') ? 'png' : 'jpg'}`;

  const form = new FormData();
  form.append('file', new Blob([buffer], { type: mime }), filename);
  form.append('scale', scale);
  form.append('face_enhance', String(faceEnhance));

  const started = Date.now();

  const res = await fetchWithProxy(API, {
    method: 'POST',
    headers: {
      accept: '*/*',
      origin: 'https://sparkpix.ai',
      referer: REFERER,
      'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36'
    },
    body: form
  });

  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = null;
  }

  if (!res.ok || !json?.success || !json?.resultUrl) {
    throw new Error(JSON.stringify({
      status_code: res.status,
      response: json || text.slice(0, 500)
    }));
  }

  return {
    quality,
    scale,
    faceEnhance,
    resultUrl: json.resultUrl,
    processingTime: json.processingTime ?? Date.now() - started
  };
}

// Sisanya sama seperti handler original, tidak perlu diubah

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
