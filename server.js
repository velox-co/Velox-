import express from 'express';
import path from 'path';
import fs from 'fs';
import { exec } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ limit: '25mb', extended: true }));

// API Endpoint to Upload and Convert EPS / Image Logo
app.post('/api/upload-logo', (req, res) => {
  try {
    const { fileData, fileName } = req.body;
    if (!fileData) {
      return res.status(400).json({ error: 'No file data provided' });
    }

    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const imagesDir = path.join(__dirname, 'images');

    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }

    const ext = (fileName || 'logo.eps').split('.').pop().toLowerCase();
    const epsPath = path.join(imagesDir, 'logo.eps');
    const pngPath = path.join(imagesDir, 'logo.png');
    const svgPath = path.join(imagesDir, 'logo.svg');

    if (ext === 'eps') {
      fs.writeFileSync(epsPath, buffer);
      
      // Convert EPS to transparent PNG using Ghostscript and ImageMagick trim
      const cmd = `gs -dNOPAUSE -dBATCH -sDEVICE=pngalpha -r300 -sOutputFile="${pngPath}" "${epsPath}" && convert "${pngPath}" -trim +repage "${pngPath}"`;
      
      exec(cmd, (error) => {
        if (error) {
          console.warn('EPS conversion error, fallback to SVG/direct:', error);
        }
        // Generate SVG wrapper around the rasterized PNG for crisp vector scaling
        try {
          if (fs.existsSync(pngPath)) {
            const pngBuf = fs.readFileSync(pngPath);
            const pngB64 = pngBuf.toString('base64');
            const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%"><image href="data:image/png;base64,${pngB64}" width="200" height="200" /></svg>`;
            fs.writeFileSync(svgPath, svgContent);
          }
        } catch (e) {
          console.warn('SVG wrap error:', e);
        }

        const timestamp = Date.now();
        return res.json({
          success: true,
          message: 'EPS logo uploaded and processed successfully!',
          logoUrl: `/images/logo.png?v=${timestamp}`,
          svgUrl: `/images/logo.svg?v=${timestamp}`
        });
      });
    } else {
      // Direct image upload (PNG, SVG, JPG)
      const targetPath = ext === 'svg' ? svgPath : pngPath;
      fs.writeFileSync(targetPath, buffer);
      
      const timestamp = Date.now();
      return res.json({
        success: true,
        message: 'Logo uploaded and updated successfully!',
        logoUrl: `/images/${path.basename(targetPath)}?v=${timestamp}`
      });
    }
  } catch (err) {
    console.error('Upload endpoint error:', err);
    res.status(500).json({ error: 'Failed to save logo file: ' + err.message });
  }
});

// Serve static files from the root directory
app.use(express.static(__dirname));

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`VELOX server running on http://0.0.0.0:${PORT}`);
});

