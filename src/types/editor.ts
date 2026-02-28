export interface EditorConfig {
  language: string;
  theme: string;
  fontSize: number;
  tabSize: number;
  wordWrap: 'on' | 'off' | 'wordWrapColumn';
  minimap: boolean;
  lineNumbers: 'on' | 'off' | 'relative';
}

export interface EditorTab {
  id: string;
  filename: string;
  filepath: string;
  content: string;
  language: string;
  isDirty: boolean;
}

export interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export type Platform = 'web' | 'desktop' | 'mobile';

export interface AppState {
  tabs: EditorTab[];
  activeTabId: string | null;
  config: EditorConfig;
  platform: Platform;
}
