export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  return lastDot === -1 ? '' : filename.slice(lastDot + 1);
}

export function getFileName(filepath: string): string {
  return filepath.split('/').pop() ?? filepath;
}

export function joinPath(...segments: string[]): string {
  return segments.join('/').replace(/\/+/g, '/');
}
