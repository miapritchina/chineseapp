import type { FileNode } from '../types/editor';

export interface FileSystemProvider {
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  listDirectory(path: string): Promise<FileNode[]>;
  createFile(path: string): Promise<void>;
  deleteFile(path: string): Promise<void>;
  rename(oldPath: string, newPath: string): Promise<void>;
}
