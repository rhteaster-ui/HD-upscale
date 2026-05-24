import fs from 'node:fs/promises';
import formidable from 'formidable';
import sharp from 'sharp';

export const config = {
  api: {
    bodyParser: false,
    responseLimit: '20mb'
  }
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

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

const clampSize = (n) => Math.max(512, Math.min(n, 8192));

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { fields, files } = await parseForm(req);
    const file = files.image?.[0] || files.image;

    if (!file) {
      res.status(400).json({ error: 'Image file is required' });
      return;
    }

    const qualityLabel = String(fields.quality || '4K');
    const faceEnhance = String(fields.faceEnhance || 'false') === 'true';

    const qualityMap = {
      '4K': 3840,
      '6K': 5760,
      '8K': 7680
    };

    const targetLongEdge = qualityMap[qualityLabel] ?? qualityMap['4K'];
    const input = await fs.readFile(file.filepath);

    const img = sharp(input).rotate();
    const metadata = await img.metadata();
    const width = metadata.width || 1024;
    const height = metadata.height || 1024;
    const landscape = width >= height;

    const resizeOptions = landscape
      ? { width: clampSize(targetLongEdge) }
      : { height: clampSize(targetLongEdge) };

    let pipeline = img.resize({
      ...resizeOptions,
      fit: 'inside',
      withoutEnlargement: false,
      kernel: sharp.kernel.lanczos3
    });

    if (faceEnhance) {
      pipeline = pipeline
        .modulate({ brightness: 1.03, saturation: 1.05 })
        .sharpen({ sigma: 1.25, m1: 1, m2: 2 });
    } else {
      pipeline = pipeline.sharpen({ sigma: 1.1 });
    }

    const outputBuffer = await pipeline.jpeg({ quality: 92, mozjpeg: true }).toBuffer();

    res.status(200).json({
      mimeType: 'image/jpeg',
      fileName: `spark-upscaled-${qualityLabel.toLowerCase()}.jpg`,
      dataUrl: `data:image/jpeg;base64,${outputBuffer.toString('base64')}`
    });
  } catch (error) {
    const msg = error?.message || 'Failed to process image';
    res.status(500).json({ error: msg });
  }
}
