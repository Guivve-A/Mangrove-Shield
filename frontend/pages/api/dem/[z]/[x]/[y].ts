import type { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';

function resolveTilePath(z: string, x: string, y: string): string {
  const normalizedY = y.replace('.png', '');
  const candidate = path.join(process.cwd(), 'public', 'data', 'demo', 'dem', z, x, `${normalizedY}.png`);

  if (fs.existsSync(candidate)) {
    return candidate;
  }

  return path.join(process.cwd(), 'public', 'data', 'demo', 'dem', '0', '0', '0.png');
}

export default function handler(req: NextApiRequest, res: NextApiResponse): void {
  const { z = '0', x = '0', y = '0' } = req.query;

  const tilePath = resolveTilePath(String(z), String(x), String(y));

  try {
    const buffer = fs.readFileSync(tilePath);
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(buffer);
  } catch {
    res.status(404).json({ detail: 'DEM tile not found' });
  }
}
