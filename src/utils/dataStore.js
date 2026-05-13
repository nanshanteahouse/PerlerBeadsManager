const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const BACKUP_DIR = path.join(DATA_DIR, '.backup');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function ensureDataDir() {
  ensureDir(DATA_DIR);
  ensureDir(BACKUP_DIR);
}

function readJSON(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

function writeJSON(fileName, data) {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, fileName);
  const tmpPath = filePath + '.tmp';

  const json = JSON.stringify(data, null, 2);

  // If the file already exists, back it up first
  if (fs.existsSync(filePath)) {
    backupFile(fileName);
  }

  // Atomic write: write to temp file, then rename
  fs.writeFileSync(tmpPath, json, 'utf-8');

  // Validate the temp file is valid JSON
  try {
    JSON.parse(fs.readFileSync(tmpPath, 'utf-8'));
  } catch (e) {
    fs.unlinkSync(tmpPath);
    throw new Error(`Failed to validate written JSON for ${fileName}: ${e.message}`);
  }

  fs.renameSync(tmpPath, filePath);
}

function backupFile(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return;

  ensureDir(BACKUP_DIR);

  const now = new Date().toISOString().replace(/[:.]/g, '-');
  const backupName = `${fileName}.${now}`;
  const backupPath = path.join(BACKUP_DIR, backupName);

  fs.copyFileSync(filePath, backupPath);

  // Keep only last 5 backups per file
  const backups = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith(fileName + '.'))
    .sort()
    .reverse();

  for (let i = 5; i < backups.length; i++) {
    fs.unlinkSync(path.join(BACKUP_DIR, backups[i]));
  }
}

function fileExists(fileName) {
  return fs.existsSync(path.join(DATA_DIR, fileName));
}

module.exports = {
  DATA_DIR,
  BACKUP_DIR,
  ensureDir,
  ensureDataDir,
  readJSON,
  writeJSON,
  backupFile,
  fileExists,
};
