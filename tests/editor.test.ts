import { describe, it, expect } from 'vitest';
import { createDefaultConfig, createTab, detectLanguage } from '../src/core/editor';

describe('createDefaultConfig', () => {
  it('returns default config', () => {
    const config = createDefaultConfig();
    expect(config.theme).toBe('ripsv-dark');
    expect(config.fontSize).toBe(14);
    expect(config.tabSize).toBe(2);
  });

  it('applies overrides', () => {
    const config = createDefaultConfig({ fontSize: 18, theme: 'ripsv-light' });
    expect(config.fontSize).toBe(18);
    expect(config.theme).toBe('ripsv-light');
  });
});

describe('createTab', () => {
  it('creates a tab with given properties', () => {
    const tab = createTab('index.ts', '/src/index.ts', 'console.log("hi")', 'typescript');
    expect(tab.filename).toBe('index.ts');
    expect(tab.filepath).toBe('/src/index.ts');
    expect(tab.content).toBe('console.log("hi")');
    expect(tab.language).toBe('typescript');
    expect(tab.isDirty).toBe(false);
    expect(tab.id).toBeTruthy();
  });
});

describe('detectLanguage', () => {
  it('detects TypeScript', () => {
    expect(detectLanguage('app.ts')).toBe('typescript');
  });

  it('detects Python', () => {
    expect(detectLanguage('main.py')).toBe('python');
  });

  it('returns plaintext for unknown extensions', () => {
    expect(detectLanguage('file.xyz')).toBe('plaintext');
  });

  it('returns plaintext for files without extension', () => {
    expect(detectLanguage('Makefile')).toBe('plaintext');
  });
});
