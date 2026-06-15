'use server';

import { readdir } from 'fs/promises';
import path from 'path';

export interface IconOption {
  name: string;
  path: string;
}

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

export async function listIcons(): Promise<IconOption[]> {
  const iconsDir = path.join(process.cwd(), 'public', 'icons');

  const entries = await readdir(iconsDir, { withFileTypes: true, recursive: true });

  const icons: IconOption[] = [];

  for (const entry of entries) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(ext)) continue;

    // entry.parentPath (Node ≥18.17) or entry.path (older Node) holds the directory of this entry.
    const parentPath: string =
      (entry as { parentPath?: string; path?: string }).parentPath ??
      (entry as { parentPath?: string; path?: string }).path ??
      iconsDir;

    const absoluteFile = path.join(parentPath, entry.name);
    // Relative to the icons root, using forward slashes.
    const relative = path
      .relative(iconsDir, absoluteFile)
      .split(path.sep)
      .join('/');

    icons.push({
      name: path.basename(entry.name, ext),
      path: `/icons/${relative}`,
    });
  }

  icons.sort((a, b) => a.name.localeCompare(b.name));

  return icons;
}
