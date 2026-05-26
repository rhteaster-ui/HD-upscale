import fs from 'node:fs/promises';
import formidable from 'formidable';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb'
  }
};

const REFERER = 'https://sparkpix.ai/aitools/free-hd-upscaler';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const BASE = 'https://sparkpix.ai';
const UPLOAD_URL_API = 'https://sparkpix.ai/api/upload-url';
const UPSCALE_API = 'https://sparkpix.ai/api/free-hd-upscale';
const DOWNLOAD_API = 'https://sparkpix.ai/api/download-image';

const requestLog = new Map();

const COOLDOWN_MS = 90 * 1000;
const MAX_PER_HOUR = 5;
const HOURLY_WINDOW_MS = 60 * 60 * 1000;

const COMMON_HEADERS = {
  accept: '*/*',
  origin: BASE,
  referer: REFERER,
  'user-agent':
    'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Mobile Safari/537.36',
  'sec-ch-ua': '"Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"',
  'sec-ch-ua-mobile': '?1',
  'sec-ch-ua-platform': '"Android"',
  'accept-language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
};

const getClientIp = (req) => {
  const forwarded = req.headers['x-forwarded-for'];

  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown';
};

const checkRateLimit = (clientId) => {
  const now = Date.now();
  const state = requestLog.get(clientId) || {
    timestamps: [],
    lastRequestAt: 0
  };

  const recent = state.timestamps.filter((ts) => now - ts < HOURLY_WINDOW_MS);

  if (state.lastRequestAt && now - state.lastRequestAt < COOLDOWN_MS) {
    const wait = Math.ceil((COOLDOWN_MS - (now - state.lastRequestAt)) / 1000);

    return {
      allowed: false,
      error: `Cooldown aktif. Coba lagi dalam ${wait} detik.`
    };
  }

  if (recent.length >= MAX_PER_HOUR) {
    const retryAfter = Math.ceil((HOURLY_WINDOW_MS - (now - recent[0])) / 1000);

    return {
      allowed: false,
      error: `Batas ${MAX_PER_HOUR}x upscale per jam tercapai. Coba lagi dalam ${retryAfter} detik.`
    };
  }

  recent.push(now);
  requestLog.set(clientId, {
    timestamps: recent,
    lastRequestAt: now
  });

  return { allowed: true };
};

const parseForm = (req) =>
  new Promise((resolve, reject) => {
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

  if (raw === '8K' || raw === '4' || raw === '4X') {
    return {
      quality: '8K',
      scale: 4
    };
  }

  if (raw === '6K' || raw === '3' || raw === '3X') {
    return {
      quality: '6K',
      scale: 3
    };
  }

  return {
    quality: '4K',
    scale: 2
  };
};

const parseBool = (value) => {
  const raw = String(value ?? 'false').toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on';
};

const readJsonSafe = async (res) => {
  const text = await res.text();

  try {
    return {
      json: JSON.parse(text),
      text
    };
  } catch {
    return {
      json: null,
      text
    };
  }
};

async function getUploadUrl(fileBuffer, filename, mimeType) {
  const res = await fetch(UPLOAD_URL_API, {
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

  const { json, text } = await readJsonSafe(res);

  if (!res.ok || !json?.success || !json?.uploadUrl || !json?.publicUrl) {
    throw new Error(
      JSON.stringify({
        step: 'upload-url',
        status: res.status,
        response: json || text.slice(0, 500)
      })
    );
  }

  return {
    uploadUrl: json.uploadUrl,
    publicUrl: json.publicUrl,
    key: json.key || null,
    contentType: json.contentType || mimeType
  };
}

async function uploadToCDN(uploadUrl, fileBuffer, mimeType) {
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: {
      'content-type': mimeType,
      'content-length': String(fileBuffer.length)
    },
    body: fileBuffer
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');

    throw new Error(
      JSON.stringify({
        step: 'cdn-upload',
        status: res.status,
        response: text.slice(0, 500)
      })
    );
  }

  return true;
}

async function upscaleWithPublicUrl(publicUrl, scale, faceEnhance) {
  const res = await fetch(UPSCALE_API, {
    method: 'POST',
    headers: {
      ...COMMON_HEADERS,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      imageUrl: publicUrl,
      scale,
      face_enhance: faceEnhance
    })
  });

  const { json, text } = await readJsonSafe(res);

  if (!res.ok || !json?.success || !json?.resultUrl) {
    throw new Error(
      JSON.stringify({
        step: 'free-hd-upscale',
        status: res.status,
        response: json || text.slice(0, 500)
      })
    );
  }

  return json;
}

async function upscaleWithSparkPix(file, fields) {
  const qualityInput = pick(fields.quality, pick(fields.resolution, '4K'));
  const { quality, scale } = normalizeQuality(qualityInput);

  const faceEnhance = parseBool(
    pick(fields.faceEnhance, pick(fields.face_enhance, 'false'))
  );

  const buffer = await fs.readFile(file.filepath);
  const mime = file.mimetype || 'image/jpeg';
  const filename =
    file.originalFilename || `image.${mime.includes('png') ? 'png' : 'jpg'}`;

  const started = Date.now();

  const upload = await getUploadUrl(buffer, filename, mime);
  await uploadToCDN(upload.uploadUrl, buffer, mime);

  const result = await upscaleWithPublicUrl(upload.publicUrl, scale, faceEnhance);

  return {
    quality,
    scale,
    faceEnhance,
    inputUrl: upload.publicUrl,
    resultUrl: result.resultUrl,
    processingTime: result.processingTime ?? Date.now() - started
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
    return;
  }

  const clientId = getClientIp(req);
  const rateLimit = checkRateLimit(clientId);

  if (!rateLimit.allowed) {
    res.status(429).json({
      success: false,
      error: rateLimit.error
    });
    return;
  }

  try {
    const { fields, files } = await parseForm(req);
    const file = pickFile(files);

    if (!file) {
      res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
      return;
    }

    const result = await upscaleWithSparkPix(file, fields);

    res.status(200).json({
      success: true,
      mimeType: 'image/png',
      fileName: `spark-upscaled-${result.quality.toLowerCase()}.png`,
      dataUrl: result.resultUrl,
      resultUrl: result.resultUrl,
      downloadUrl: `${DOWNLOAD_API}?url=${encodeURIComponent(result.resultUrl)}`,
      inputUrl: result.inputUrl,
      processingTime: result.processingTime,
      quality: result.quality,
      scale: result.scale,
      faceEnhance: result.faceEnhance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'A server error occurred while processing the image.',
      detail: String(error?.message || error).slice(0, 1000)
    });
  }
}
