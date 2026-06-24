const fs = require('fs');
const path = require('path');
const https = require('https');

const FILES = [
  'tiny_face_detector_model-weights_manifest.json',
  'tiny_face_detector_model-shard1',
  'face_landmark_68_model-weights_manifest.json',
  'face_landmark_68_model-shard1',
  'face_recognition_model-weights_manifest.json',
  'face_recognition_model-shard1'
];

const BASE_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
const TARGET_DIR = path.join(__dirname, '..', 'public', 'models');

if (!fs.existsSync(TARGET_DIR)) {
  fs.mkdirSync(TARGET_DIR, { recursive: true });
}

function downloadFile(filename) {
  return new Promise((resolve, reject) => {
    const fileUrl = `${BASE_URL}${filename}`;
    const destPath = path.join(TARGET_DIR, filename);
    const file = fs.createWriteStream(destPath);

    console.log(`Downloading: ${fileUrl} -> ${destPath}`);

    https.get(fileUrl, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${filename}: Status code ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log(`Successfully downloaded: ${filename}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

async function main() {
  console.log(`Starting model weights download into: ${TARGET_DIR}`);
  for (const file of FILES) {
    try {
      await downloadFile(file);
    } catch (err) {
      console.error(`Error downloading ${file}:`, err);
      process.exit(1);
    }
  }
  console.log('All model weights successfully downloaded!');
}

main();
