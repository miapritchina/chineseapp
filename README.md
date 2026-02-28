# RIPsV Editor

A cross-platform code editor for cloud, mobile, and desktop environments.

## Overview

RIPsV is a modern, lightweight code editor designed to work seamlessly across multiple platforms:

- **Cloud** — Browser-based editing with real-time collaboration
- **Mobile** — Native mobile experience for coding on the go (iOS & Android)
- **Desktop** — Full-featured desktop application (Windows, macOS, Linux)

## Features

- Syntax highlighting for 50+ languages
- Intelligent code completion
- Integrated terminal
- File explorer with tree view
- Multi-tab editing
- Themes and customization
- Cross-device sync
- Offline support
- Git integration

## Tech Stack

- **Frontend**: TypeScript, React
- **Editor Core**: Monaco Editor
- **Desktop**: Electron
- **Mobile**: React Native
- **Backend**: Node.js
- **Build Tool**: Vite

## Getting Started

### Prerequisites

- Node.js >= 18
- npm >= 9

### Installation

```bash
npm install
```

### Development

```bash
# Start web development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## Project Structure

```
├── src/
│   ├── core/           # Editor core logic
│   ├── components/     # Shared UI components
│   ├── platform/
│   │   ├── web/        # Web/cloud platform layer
│   │   ├── desktop/    # Electron desktop layer
│   │   └── mobile/     # React Native mobile layer
│   ├── services/       # Backend services & API
│   ├── themes/         # Editor themes
│   ├── utils/          # Shared utilities
│   └── types/          # TypeScript type definitions
├── public/             # Static assets
└── tests/              # Test suites
```

## License

MIT
