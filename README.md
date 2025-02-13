# React Native Storage Manager

A VSCode extension that helps you debug and manage AsyncStorage in your React Native applications in real-time.

## Features

- 🔍 Real-time viewing of AsyncStorage contents
- ✏️ Edit storage values directly from VSCode
- 🔄 Auto-refresh when storage changes
- 🚀 Works with both iOS and Android
- 📱 Support for physical devices
- 💻 Simple and intuitive interface
- ❌ Fix delete items

## Installation

1. Install the extension from VSCode Marketplace
2. Install the companion npm package in your React Native project:
   ```bash
   npm install --save-dev rn-storage-debugger
   ```

## Usage

1. In your React Native app, initialize the debugger:
   ```javascript
   import StorageDebugger from 'rn-storage-debugger';

   if (__DEV__) {
     StorageDebugger.start();
   }
   ```

2. In VSCode:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "RN: View Storage"
   - Press Enter

## Requirements

- VSCode 1.96.0 or higher
- React Native project with @react-native-async-storage/async-storage

## Extension Settings

This extension contributes the following settings:

* `rnStorageManager.port`: Port to use for WebSocket connection (default: 8082)

## Known Issues

- Currently works only with development builds
- WebSocket connection might need a refresh if the Metro bundler is restarted

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.