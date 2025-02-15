# React Native Storage Manager

A VSCode extension that helps you debug and manage AsyncStorage in your React Native applications in real-time.

## Features

- 🔍 Real-time viewing of AsyncStorage contents
- ✏️ Edit storage values directly from VSCode
- 🔄 Auto-refresh when storage changes
- 🚀 Works with both iOS and Android
- 📱 Support for physical devices
- 💻 Simple and intuitive interface
- 🔌 Dynamic port configuration
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
     // Basic usage with default port (12380)
     StorageDebugger.start();

     // Or specify a custom port
     StorageDebugger.start({
       port: 8088 // Any available port
     });
   }
   ```

2. In VSCode:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "RN: View Storage"
   - Press Enter

3. Port Configuration:
   - Default port is 12380
   - Change port through the UI in the extension
   - Automatic fallback to default port if selected port is in use

## Requirements

- VSCode 1.96.0 or higher
- React Native project with @react-native-async-storage/async-storage

## Extension Settings

This extension contributes the following settings:

* `rnStorageManager.port`: Port for WebSocket connection (default: 12380)
* Port can be changed dynamically through the extension's UI

## Known Issues

- Currently works only with development builds
- WebSocket connection might need a refresh if the Metro bundler is restarted
- Some ports might be unavailable if already in use by other development servers (e.g., 8081 for Metro)

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.