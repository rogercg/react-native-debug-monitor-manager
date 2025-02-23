Aquí está el README actualizado para la nueva extensión:

# React Native Debug Monitor (Preview)

A VSCode extension that helps you debug and monitor React Native applications in real-time, including AsyncStorage management and Network request monitoring.

## Features

- 🔍 Real-time AsyncStorage Monitoring
  - View and edit AsyncStorage contents
  - Auto-refresh when storage changes
  - Delete individual items or clear all storage
  
- 🌐 Network Request Monitoring
  - Track all network requests (XHR, Fetch, and Axios)
  - Inspect request/response headers and bodies
  - Monitor request timing and status
  - Support for custom Axios instances

- 🚀 General Features
  - Works with both iOS and Android
  - Support for physical devices
  - Dynamic port configuration
  - Simple and intuitive interface
  - Real-time updates

## Installation

1. Install the extension from VSCode Marketplace
2. Install the companion npm package in your React Native project:
   ```bash
   npm install --save-dev react-native-debug-monitor
   ```

## Usage

### Basic Setup
```javascript
import StorageDebugger from 'react-native-debug-monitor';

if (__DEV__) {
  // Basic usage with default port (12380)
  StorageDebugger.start();
}
```

### Network Monitoring with Axios
```javascript
import StorageDebugger from 'react-native-debug-monitor';
import axios from './axiosConfig';  // Your axios instance

if (__DEV__) {
  StorageDebugger.start();
  // Configure axios monitoring (optional)
  if (StorageDebugger.networkMonitor) {
    StorageDebugger.networkMonitor.addAxiosInstance(axios);
  }
}
```

### Advanced Configuration
```javascript
StorageDebugger.start({
  port: 8088,               // Optional: Custom port
  serverIP: '192.168.1.100' // Optional: For physical devices
});
```

### VSCode Commands
1. For Storage Monitoring:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "RN: View Storage"
   - Press Enter

2. For Network Monitoring:
   - Open Command Palette (Cmd/Ctrl + Shift + P)
   - Type "RN: View Network"
   - Press Enter

## Requirements

- VSCode 1.60.0 or higher
- React Native project
- @react-native-async-storage/async-storage (for storage monitoring)

## Port Configuration

- Default port: 12380
- Can be changed through:
  - Code configuration
  - Extension UI
  - Automatic fallback to default port if selected port is in use

## Known Issues

- Only works with development builds
- WebSocket connection might need a refresh if Metro bundler is restarted
- Some ports might be unavailable if in use by other development servers (e.g., 8081 for Metro)
- Network monitoring might not capture requests made before initialization

## Troubleshooting

### Physical Device Connection
- Ensure device and computer are on the same network
- Verify correct IP address configuration
- Check if port is not blocked by firewall

### Network Monitor Issues
- Verify network monitoring is enabled
- Check axios instance configuration
- Ensure requests are made after initialization

## Contributing

Contributions are welcome! Please visit our GitHub repository:
[GitHub Repository Link]

## License

This project is licensed under the MIT License - see the LICENSE file for details.

---
**Note**: This is a preview version. Features and APIs might change in future releases.

## Release Notes

### 1.0.0-preview.1
- Initial preview release
- Added Storage monitoring capabilities
- Added Network request monitoring
- Added support for Axios instances
- Basic configuration options