import type { EditorConfig, EditorTab } from '../types/editor';

const DEFAULT_CONFIG: EditorConfig = {
  language: 'plaintext',
  theme: 'ripsv-dark',
  fontSize: 14,
  tabSize: 2,
  wordWrap: 'on',
  minimap: true,
  lineNumbers: 'on',
};

export function createDefaultConfig(overrides?: Partial<EditorConfig>): EditorConfig {
  return { ...DEFAULT_CONFIG, ...overrides };
}

export function createTab(
  filename: string,
  filepath: string,
  content: string = '',
  language: string = 'plaintext',
): EditorTab {
  return {
    id: crypto.randomUUID(),
    filename,
    filepath,
    content,
    language,
    isDirty: false,
  };
}

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescriptreact',
    js: 'javascript',
    jsx: 'javascriptreact',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    rb: 'ruby',
    cpp: 'cpp',
    c: 'c',
    cs: 'csharp',
    html: 'html',
    css: 'css',
    scss: 'scss',
    json: 'json',
    md: 'markdown',
    yaml: 'yaml',
    yml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'dockerfile',
  };
  return ext ? (languageMap[ext] ?? 'plaintext') : 'plaintext';
}
