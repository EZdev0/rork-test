# 🚀 System Startup Guide

## Debugger configuration (VS Code)

The `.vscode/launch.json` has been updated with 4 profiles:

### 1. **Expo iOS Simulator** (Port 9221)
- Launches Expo and connects to iOS Simulator
- Requires: Xcode (macOS) or ios_webkit_debug_proxy
- ⚠️ **Error on Windows**: `ios_webkit_debug_proxy ENOENT` - iOS debugging is only possible natively on macOS

### 2. **Expo Android Emulator** (Port 9222)
- Launches Expo and connects to Android Emulator
- Requires: Android Studio + Emulator
- ✅ Works on Windows

### 3. **Expo Web Browser** (Port 9223)
- Starts Expo in the web browser (Chrome)
- Fastest test option
- ✅ Platform independent

### 4. **Attach to Expo (Auto)** (Port 9224)
- Automatically connect to running Expo instance
- Flexible for all platforms

---

## Quick start

### Option A: Web Development (Recommended for quick testing)
```bash
npm start -- --web
```
Debugger: Select "Expo Web Browser" in VS Code (Ctrl+Shift+D)

### Option B: Android Testing
```bash
npm start
```
- Press `a` for Android Emulator
- OR scan QR code with Expo Go app on Android phone
- Debugger: Select “Expo Android Emulator”

### Option C: iOS Testing (macOS only)
```bash
npm start
```
- Press `i` for iOS Simulator
- Debugger: Select “Expo iOS Simulator”

---

## Bug Fix: iOS WebKit Debug Proxy

**Error message:**
```
Unable to start ios_webkit_debug_proxy: Error: spawn ios_webkit_debug_proxy ENOENT
```

**Cause:**
- `ios_webkit_debug_proxy` is a macOS/Linux tool
- Not natively available on Windows
- Required for iOS Simulator debugging

**Solutions:**

### 1. **Use WSL2 (Windows)**
```bash
# Install in WSL2
sudo apt-get install libimobiledevice-dev
git clone https://github.com/google/ios-webkit-debug-proxy.git
cd ios-webkit-debug-proxy
./autogen.sh
make
sudo make install
```

### 2. **Prefer Android/Web (Recommended)**
- Use Android Emulator or web browser for development
- iOS only for final testing on macOS

### 3. **Expo Tunnel for Remote iOS**
```bash
npm start -- --tunnel
```
- Scan QR code with physical iPhone (Expo Go app)
- Debugging over network

---

## Project structure

```
rork test/
├── app/ # Expo Router Screens
│ ├── (tabs)/ # Tab navigation
│ │ ├── (home)/ # Home tab with agent mode
│ │ ├── chat/ # Chat interface
│ │ ├── settings/ # Settings
│ │ └── tools/ # Tool overview
│ ├── _layout.tsx # Root layout
│ ├── editor.tsx # Code editor
│ └── +not-found.tsx # 404 Page
├── components/ # UI Components
│ ├── AgentPlanView.tsx # Agent plan visualization
│ ├── AgentTaskCard.tsx # Task Cards
│ ├── ChatBubble.tsx # Chat messages
│ ├── FileTreeItem.tsx # File tree
│ ├── ThinkingBlock.tsx # Thinking UI
│ └── ToolCallView.tsx # Tool execution
├── providers/ # Context Providers
│ ├── AppProvider.tsx # Settings, Todos, Memos
│ ├── AgentProvider.tsx # Agent mode logic
│ ├── ChatProvider.tsx # Chat management
│ └── ProjectProvider.tsx # Project files
├── utils/ # Helper Functions
│ ├── ai-service.ts # AI API Calls
│ ├── file-icons.ts # File icons
│ └── syntax.ts # Syntax highlighting
├── constants/
│ └── colors.ts # IDE color scheme
├── types/
│ └── index.ts # TypeScript Types
└── .qcoder/rules/ # Agent configuration
├── user.md # User preferences
├── Agent.md # Agent rules
└── lessons_learned.md # Mismemory
```

---

## Features & Components

### 1. **Agent Mode** (main feature)
- **Auto-Thinking**: An analysis phase is automatically inserted for complex plans (>2 tasks).
- **Tool System**: 15+ tools (read_file, write_file, web_search, create_todo, etc.)
- **Permission Levels**: always / ask / blocked / removed
- **Learning mode (Beta)**: Automatically saves user information in USER.md

**Tools with Auto Extraction:**
- `extractUserInfoIfEnabled()` checks user messages after every job
- Extracts name, profession, company via regex
- Saves to AsyncStorage as `ide_user_md`

### 2. **Chat Interface**
- **Thinking Blocks**: Displays AI considerations
- **Todo Integration**: Tasks are visualized
- **Tool Calls**: Live display of tool execution
- **Syntax Highlighting**: Code with PrismJS

### 3. **Drag & Drop Todo Graphic**
- **Long-Press**: 400ms delay to activate
- **Swap Modal**: Nice UI with cancel button
- **LayoutAnimation**: Smooth Reordering (iOS/Android)
- **Visual Badges**: “Current” marking

### 4. **Web Search Tool**
- **DuckDuckGo API**: Privacy-focused
- **Timeout**: 8s AbortController
- **Error Handling**: Friendly fallback messages
- **Result Formatting**: Summary + Sources

### 5. **Settings Providers**
- **AsyncStorage**: Persistence of all settings
- **API Keys**: OpenAI, Anthropic, Gemini, Groq, etc.
- **Beta Features**: WebSearch, WebFetch, AgentLearning
- **Yolo Mode**: All tools without asking

---

## Dependencies (production)

|Package |Version |Purpose |
|-------|---------|-------|
|expo |~54.0.27 |Core Framework |
|react |19.1.0 |UI Library |
|react-native |0.81.5 |Mobile Framework |
|expo router |~6.0.17 |File-based routing |
|@tanstack/react-query |^5.83.0 |Server State |
|condition |^5.0.2 |State Management |
|lucide-react-native |^0.523.0 |Icons |
|@rork-ai/toolkit-sdk |^0.2.51 |AI Toolkit |
|patch package |^8.0.1 |Postinstall Patches |

## Dev dependencies

|Package |Version |Purpose |
|-------|---------|-------|
|typescript |~5.9.2 |Type Checking |
|eslint |^9.31.0 |Linting |
|@babel/core |^7.25.2 |Transpilation |

---

## Build status

✅ **npm install** - Successful (1040 packages)
✅ **TypeScript Compilation** - 0 errors
⚠️ **Expo Doctor** - 2 Warnings (harmless)

### Known warnings:
1. **Lockfile conflict**
- `package-lock.json` + `bun.lock` both exist
- **Solution**: Remove or ignore one (OK for local dev)

2. **expo-location duplicate**
- v19.0.8 (direct) + v15.1.1 (via react-native-web-maps)
- **Solution**: Harmless, Expo deduplicates automatically

---

## Test checklist

### ✅ Core features tested:

- [x] **App start**: `npm start` runs stable
- [x] **Tab navigation**: All 4 tabs accessible
- [x] **Chat**: Send/receive messages
- [x] **Agent Mode**: Create + execute plans
- [x] **Thinking Tasks**: Auto-analysis for complex jobs
- [x] **Drag & Drop**: Long-Press Swap Modal works
- [x] **User-Info Extraction**: Saves name/profession (learning mode)
- [x] **Web Search**: DuckDuckGo with timeout
- [x] **Settings**: Save/load API keys
- [x] **AsyncStorage**: Persistence of all data
- [x] **TypeScript**: 0 compiler errors
- [x] **ESLint**: Code quality checked

### ⚠️ Limited features:

- [ ] **iOS Simulator Debugging**: Only on macOS (ios_webkit_debug_proxy is missing)
- [ ] **Physical devices**: Manual QR scanning required
- [ ] **Production Build**: EAS CLI not installed yet

---

## Next Steps (Optional)

### 1. **Install EAS CLI** (for builds)
```bash
npm install -g @expo/eas-cli
eas build:configure
```

### 2. **Set up CI/CD**
- GitHub Actions for automated testing
- EAS Submit for store deployments

### 3. **Performance Optimization**
- Activate Hermes Engine (app.json)
- Analyze bundle size

---

## Useful commands

```bash
# Development
npm start # Expo Dev Server
npm start -- --web # Web preview
npm start -- --tunnel # Tunnel mode (firewall problem)
npm start -- --clear # Clear cache

# Testing
npx expo lint #ESLint
npx tsc --noEmit # TypeScript check
npx expo-doctor # Project health check

# Cleanup
rm -rf node_modules && npm install # Clean Install
rm package-lock.json # Clean lockfile (optional)
```

---

## Support & Docs

- **Expo Docs**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **Rork FAQ**: https://rork.com/faq
- **EAS Build**: https://docs.expo.dev/build/introduction/
