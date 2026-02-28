import React, { useState } from 'react';
import type { AppState } from '../types/editor';
import { createDefaultConfig } from '../core/editor';
import { detectPlatform } from '../core/platform';

const initialState: AppState = {
  tabs: [],
  activeTabId: null,
  config: createDefaultConfig(),
  platform: detectPlatform(),
};

export default function App() {
  const [state, setState] = useState<AppState>(initialState);

  return (
    <div id="ripsv-editor" data-platform={state.platform}>
      <header className="titlebar">
        <h1>RIPsV Editor</h1>
      </header>
      <main className="workspace">
        <aside className="sidebar">
          <p>File Explorer</p>
        </aside>
        <section className="editor-area">
          {state.tabs.length === 0 ? (
            <div className="welcome">
              <h2>Welcome to RIPsV</h2>
              <p>Open a file or create a new one to get started.</p>
            </div>
          ) : (
            <div className="editor-container" />
          )}
        </section>
      </main>
      <footer className="statusbar">
        <span>{state.config.language}</span>
        <span>UTF-8</span>
        <span>{state.platform}</span>
      </footer>
    </div>
  );
}
