const form = document.getElementById('upscaleForm');
const imageInput = document.getElementById('imageInput');
const fileLabel = document.getElementById('fileLabel');
const progressWrap = document.getElementById('progressWrap');
const progressBar = document.getElementById('progressBar');
const statusText = document.getElementById('statusText');
const resultCard = document.getElementById('resultCard');
const resultImage = document.getElementById('resultImage');
const downloadBtn = document.getElementById('downloadBtn');
const copyBtn = document.getElementById('copyBtn');

let currentResultUrl = '';

imageInput.addEventListener('change', () => {
  const file = imageInput.files?.[0];
  fileLabel.textContent = file ? `${file.name} (${Math.round(file.size / 1024)} KB)` : 'Tap untuk upload image';
});

const setLoading = (loading) => {
  progressWrap.classList.toggle('hidden', !loading);
  if (!loading) progressBar.style.width = '0%';
};

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const file = imageInput.files?.[0];
  if (!file) return;

  statusText.textContent = 'Processing image...';
  setLoading(true);

  let progress = 0;
  const timer = setInterval(() => {
    progress = Math.min(progress + 10, 90);
    progressBar.style.width = `${progress}%`;
  }, 250);

  const formData = new FormData(form);
  try {
    const res = await fetch('/api/upscale', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (!res.ok) throw new Error(data.error || 'Upscale failed');

    progressBar.style.width = '100%';
    currentResultUrl = data.dataUrl;
    resultImage.src = currentResultUrl;
    downloadBtn.href = currentResultUrl;
    downloadBtn.download = data.fileName || 'spark-upscaled.jpg';
    resultCard.classList.remove('hidden');
    statusText.textContent = 'Done! Result siap di-download.';
  } catch (err) {
    statusText.textContent = `Error: ${err.message}`;
  } finally {
    clearInterval(timer);
    setTimeout(() => setLoading(false), 450);
  }
});

copyBtn.addEventListener('click', async () => {
  if (!currentResultUrl) return;
  await navigator.clipboard.writeText(currentResultUrl);
  copyBtn.textContent = 'Copied!';
  setTimeout(() => { copyBtn.textContent = 'Copy Result URL'; }, 1200);
});
