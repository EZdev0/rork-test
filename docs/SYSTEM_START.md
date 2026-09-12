# 🚀 System-Startanleitung

## Debugger-Konfiguration (VS Code)

Die `.vscode/launch.json` wurde aktualisiert mit 4 Profilen:

### 1. **Expo iOS Simulator** (Port 9221)
- Startet Expo und verbindet mit iOS Simulator
- Benötigt: Xcode (macOS) oder ios_webkit_debug_proxy
- ⚠️ **Fehler bei Windows**: `ios_webkit_debug_proxy ENOENT` - iOS Debugging ist nur auf macOS nativ möglich

### 2. **Expo Android Emulator** (Port 9222)
- Startet Expo und verbindet mit Android Emulator
- Benötigt: Android Studio + Emulator
- ✅ Funktioniert unter Windows

### 3. **Expo Web Browser** (Port 9223)
- Startet Expo im Web-Browser (Chrome)
- Schnellste Testmöglichkeit
- ✅ Plattform-unabhängig

### 4. **Attach to Expo (Auto)** (Port 9224)
- Automatisches Verbinden mit laufender Expo-Instanz
- Flexibel für alle Plattformen

---

## Quick-Start

### Option A: Web-Entwicklung (Empfohlen für schnelle Tests)
```bash
npm start -- --web
```
Debugger: Wähle "Expo Web Browser" in VS Code (Strg+Shift+D)

### Option B: Android Testing
```bash
npm start
```
- Drücke `a` für Android Emulator
- ODER scanne QR-Code mit Expo Go App auf Android-Handy
- Debugger: Wähle "Expo Android Emulator"

### Option C: iOS Testing (nur macOS)
```bash
npm start
```
- Drücke `i` für iOS Simulator
- Debugger: Wähle "Expo iOS Simulator"

---

## Fehlerbehebung: iOS WebKit Debug Proxy

**Fehlermeldung:**
```
Unable to start ios_webkit_debug_proxy: Error: spawn ios_webkit_debug_proxy ENOENT
```

**Ursache:**
- `ios_webkit_debug_proxy` ist ein macOS/Linux-Tool
- Unter Windows nicht nativ verfügbar
- Wird für iOS-Simulator-Debugging benötigt

**Lösungen:**

### 1. **WSL2 verwenden (Windows)**
```bash
# In WSL2 installieren
sudo apt-get install libimobiledevice-dev
git clone https://github.com/google/ios-webkit-debug-proxy.git
cd ios-webkit-debug-proxy
./autogen.sh
make
sudo make install
```

### 2. **Android/Web bevorzugen (Empfohlen)**
- Nutze Android Emulator oder Web-Browser für Development
- iOS nur für finale Tests auf macOS

### 3. **Expo Tunnel für Remote-iOS**
```bash
npm start -- --tunnel
```
- QR-Code mit physischem iPhone scannen (Expo Go App)
- Debugging über Netzwerk

---

## Projektstruktur

```
rork-test/
├── app/                      # Expo Router Screens
│   ├── (tabs)/              # Tab Navigation
│   │   ├── (home)/         # Home Tab mit Agent-Mode
│   │   ├── chat/           # Chat Interface
│   │   ├── settings/       # Einstellungen
│   │   └── tools/          # Tool-Übersicht
│   ├── _layout.tsx         # Root Layout
│   ├── editor.tsx          # Code Editor
│   └── +not-found.tsx      # 404 Page
├── components/              # UI Components
│   ├── AgentPlanView.tsx   # Agent-Plan Visualisierung
│   ├── AgentTaskCard.tsx   # Task Cards
│   ├── ChatBubble.tsx      # Chat Nachrichten
│   ├── FileTreeItem.tsx    # Dateibaum
│   ├── ThinkingBlock.tsx   # Thinking UI
│   └── ToolCallView.tsx    # Tool-Ausführung
├── providers/               # Context Providers
│   ├── AppProvider.tsx     # Settings, Todos, Memos
│   ├── AgentProvider.tsx   # Agent Mode Logik
│   ├── ChatProvider.tsx    # Chat Management
│   └── ProjectProvider.tsx # Projekt-Dateien
├── utils/                   # Helper Functions
│   ├── ai-service.ts       # AI API Calls
│   ├── file-icons.ts       # Datei-Icons
│   └── syntax.ts           # Syntax Highlighting
├── constants/
│   └── colors.ts           # IDE Farbschema
├── types/
│   └── index.ts            # TypeScript Types
└── .qcoder/rules/          # Agent Konfiguration
    ├── user.md             # Nutzerpräferenzen
    ├── Agent.md            # Agenten-Regeln
    └── lessons_learned.md  # Fehlgedächtnis
```

---

## Features & Komponenten

### 1. **Agent Mode** (Hauptfeature)
- **Auto-Thinking**: Bei komplexen Plänen (>2 Tasks) wird automatisch eine Analyse-Phase eingefügt
- **Tool System**: 15+ Tools (read_file, write_file, web_search, create_todo, etc.)
- **Permission Levels**: always / ask / blocked / removed
- **Lernmodus (Beta)**: Speichert User-Infos automatisch in USER.md

**Tools mit Auto-Extraction:**
- `extractUserInfoIfEnabled()` prüft nach jedem Job User-Nachrichten
- Extrahiert Name, Beruf, Firma per Regex
- Speichert in AsyncStorage als `ide_user_md`

### 2. **Chat Interface**
- **Thinking Blocks**: Zeigt KI-Überlegungen an
- **Todo Integration**: Tasks werden visualisiert
- **Tool Calls**: Live-Anzeige der Tool-Ausführung
- **Syntax Highlighting**: Code mit PrismJS

### 3. **Drag & Drop Todo-Grafik**
- **Long-Press**: 400ms Delay zum Aktivieren
- **Swap Modal**: Schönes UI mit Cancel-Button
- **LayoutAnimation**: Smooth Reordering (iOS/Android)
- **Visuelle Badges**: "Aktuell" Markierung

### 4. **Web Search Tool**
- **DuckDuckGo API**: Privacy-fokussiert
- **Timeout**: 8s AbortController
- **Error Handling**: Freundliche Fallback-Meldungen
- **Result Formatting**: Zusammenfassung + Quellen

### 5. **Settings Provider**
- **AsyncStorage**: Persistenz aller Einstellungen
- **API Keys**: OpenAI, Anthropic, Gemini, Groq, etc.
- **Beta Features**: WebSearch, WebFetch, AgentLearning
- **Yolo Mode**: Alle Tools ohne Nachfrage

---

## Dependencies (Produktion)

| Paket | Version | Zweck |
|-------|---------|-------|
| expo | ~54.0.27 | Core Framework |
| react | 19.1.0 | UI Library |
| react-native | 0.81.5 | Mobile Framework |
| expo-router | ~6.0.17 | File-based Routing |
| @tanstack/react-query | ^5.83.0 | Server State |
| zustand | ^5.0.2 | State Management |
| lucide-react-native | ^0.523.0 | Icons |
| @rork-ai/toolkit-sdk | ^0.2.51 | AI Toolkit |
| patch-package | ^8.0.1 | Postinstall Patches |

## Dev-Dependencies

| Paket | Version | Zweck |
|-------|---------|-------|
| typescript | ~5.9.2 | Type Checking |
| eslint | ^9.31.0 | Linting |
| @babel/core | ^7.25.2 | Transpilation |

---

## Build-Status

✅ **npm install** - Erfolgreich (1040 Pakete)  
✅ **TypeScript Compilation** - 0 errors  
⚠️ **Expo Doctor** - 2 Warnings (harmlos)

### Bekannte Warnings:

1. **Lockfile-Konflikt**
   - `package-lock.json` + `bun.lock` existieren beide
   - **Lösung**: Eine entfernen oder ignorieren (für lokales Dev OK)

2. **expo-location Duplikat**
   - v19.0.8 (direkt) + v15.1.1 (via react-native-web-maps)
   - **Lösung**: Harmlos, Expo dedupliziert automatisch

---

## Test-Checkliste

### ✅ Core-Funktionen getestet:

- [x] **App-Start**: `npm start` läuft stabil
- [x] **Tab-Navigation**: Alle 4 Tabs erreichbar
- [x] **Chat**: Nachrichten senden/empfangen
- [x] **Agent Mode**: Pläne erstellen + ausführen
- [x] **Thinking Tasks**: Auto-Analyse bei komplexen Jobs
- [x] **Drag & Drop**: Long-Press Swap Modal funktioniert
- [x] **User-Info Extraction**: Speichert Namen/Beruf (Lernmodus)
- [x] **Web Search**: DuckDuckGo mit Timeout
- [x] **Settings**: API Keys speichern/laden
- [x] **AsyncStorage**: Persistenz aller Daten
- [x] **TypeScript**: 0 Compiler Errors
- [x] **ESLint**: Code-Qualität geprüft

### ⚠️ Eingeschränkte Funktionen:

- [ ] **iOS Simulator Debugging**: Nur auf macOS (ios_webkit_debug_proxy fehlt)
- [ ] **Physische Geräte**: Manuelles QR-Scannen nötig
- [ ] **Production Build**: EAS CLI noch nicht installiert

---

## Nächste Schritte (Optional)

### 1. **EAS CLI installieren** (für Builds)
```bash
npm install -g @expo/eas-cli
eas build:configure
```

### 2. **CI/CD einrichten**
- GitHub Actions für automatische Tests
- EAS Submit für Store-Deployments

### 3. **Performance-Optimierung**
- Hermes Engine aktivieren (app.json)
- Bundle-Größe analysieren

---

## Nützliche Commands

```bash
# Development
npm start                    # Expo Dev Server
npm start -- --web          # Web Vorschau
npm start -- --tunnel       # Tunnel-Modus (Firewall-Problem)
npm start -- --clear        # Cache leeren

# Testing
npx expo lint               # ESLint
npx tsc --noEmit           # TypeScript Check
npx expo-doctor            # Projekt-Gesundheitscheck

# Cleanup
rm -rf node_modules && npm install  # Clean Install
rm package-lock.json       # Lockfile bereinigen (optional)
```

---

## Support & Docs

- **Expo Docs**: https://docs.expo.dev/
- **React Native**: https://reactnative.dev/
- **Rork FAQ**: https://rork.com/faq
- **EAS Build**: https://docs.expo.dev/build/introduction/
