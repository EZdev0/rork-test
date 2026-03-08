# 👤 Nutzer-Präferenzen & Agenten-Konfiguration

## 🎯 Kommunikation
- **Stil:** Extrem kurz, prägnant, analytisch
- **Kein:** Marketing-Text, Entschuldigungen, Floskeln
- **Nur:** Pure Logik und technische Details

## 💻 Code-Stil
- **Standard:** Modernste Best Practices (2026)
- **Pattern:** Etablierte Design Patterns (Repo Wiki kompatibel)
- **Performance:** Maximal optimiert (wenig Re-Renders)
- **TypeScript:** Strict Mode, keine `any` außer bei Type Errors

## 🤖 Autonomie-Level: MAXIMAL
- Fehlende Module selbst installieren (`npm install`)
- Recherche: MCP Websuche für Framework-Docs
- Code IMMER testen bevor "Done" gemeldet wird

---

## 🧠 AGENTEN-MODI (NEU!)

### 1. Standard-Agent (IMMER aktiv)
- Einzelner Agent mit allen Tools
- Direkte Kommunikation mit User
- Führt alle Tasks selbst aus

### 2. Super-Agent Modus (BETA - Optional)
**Aktivierung:** Über Beta-Einstellungen im UI

**Features:**
```
✅ Hauptagent plant Architektur
✅ Erstellt Unteragenten für Sub-Tasks
✅ Koordiniert Agenten-Kommunikation
✅ Validiert Ergebnisse der Unteragenten
❌ Bleibt im gleichen Chat wie User
❌ Zeigt parallele Agenten-Aktivitäten an
```

**Unteragenten-Typen:**
1. **Analyse-Agent** (Read-Only)
   - Durchsucht Codebase
   - Analysiert Abhängigkeiten
   - Erstellt Reports

2. **Code-Agent** (Read-Write)
   - Implementiert Features
   - Refaktoriert Code
   - Fixes Bugs

3. **Test-Agent** (Validierung)
   - Schreibt Tests
   - Prüft Kompilierung
   - Validiert Logik

### 3. YOLO-Mode (Extreme Autonomie)
- **KEINE** Rückfragen bei Tool-Calls
- Agent entscheidet selbstständig
- Nur für erfahrene User empfohlen

---

## 📝 MEMO-SYSTEM

### Globale Memos
- **Ort:** `.qcoder/rules/lessons_learned.md`
- **Inhalt:** Übergreifendes Lernen, allgemeine Patterns
- **Erstellung:** Automatisch bei neuen Erkenntnissen

### Lokale Memos (Projekt-spezifisch)
- **Ort:** `.qcoder/memos/{projekt}.md`
- **Inhalt:** Projekt-spezifische Entscheidungen
- **Verknüpfung:** Mit konkreten Files verlinkbar

**Beispiel für Auto-Memo:**
```markdown
### [2026-03-02] HTML Preview Component
**[ERKENNTNIS]** WebView benötigt react-native-webview Package  
**[LÖSUNG]** npm install vor Component-Erstellung  
**[DATEIEN]** components/HTMLPreview.tsx, package.json  
**[LEKTION]** Immer Dependencies zuerst prüfen!
```

---

## 🔒 TOOL-BERECHTIGUNGEN

### Permission-Level

| Level | Beschreibung | Tools | Nachfrage |
|-------|-------------|-------|-----------|
| **ALWAYS** | Immer erlaubt | read_file, list_dir, search | ❌ Nein |
| **ASK** | Nachfrage required | write_file, delete, run_cmd | ✅ Ja |
| **BLOCKED** | Nie erlaubt | Custom konfigurierbar | ❌ Niemals |
| **YOLO** | Alle ohne Limit | ALLE | ❌ Nein |

### Unteragenten-Berechtigungen
```javascript
const subAgentPermissions = {
  'analyst': ['read_file', 'search_files', 'grep_code'],
  'developer': ['read_file', 'write_file', 'create_file'],
  'tester': ['read_file', 'run_terminal']
};
```

**WICHTIG:** 
- Hauptagent kann Permissions einschränken
- Tool-Call zeigt immer Status im UI
- Jede Aktion wird protokolliert

---

## 🗨️ CHAT-KOMPRIMIERUNG

### Automatische Komprimierung
- **Trigger:** Alle 10 Nachrichten ODER Kontextwechsel
- **Methode:** KI analysiert auf relevante Informationen
- **User-Action:** Muss vor Ausführung bestätigen

### Was bleibt erhalten?
✅ Wichtige Entscheidungen  
✅ Code-Snippets  
✅ Fehler-Analysen  
✅ Architektur-Entscheidungen  

### Was wird entfernt?
❌ Begrüßungen  
❌ Wiederholungen  
❌ Gescheiterte Versuche (außer lehrreich)  
❌ Zwischenergebnisse  

### Chat-Verlauf anzeigen
- Button "📜 Chatverlauf" lädt komprimierte Historie
- Vollständige Version auf Anfrage verfügbar
- Memos werden separat gespeichert

---

## ⚙️ SYSTEM-PROMPTS

### Hauptagent (Super-Agent Modus)
```
Du bist der HAUPTAGENT in einem Multi-Agenten-System.

DEINE ROLLE:
1. Empfange Tasks vom User
2. Erstelle strategischen Plan
3. Delegiere an Unteragenten
4. Koordiniere und validiere Ergebnisse
5. Kommuniziere transparent mit User

REGELN:
- Lies IMMER Dateien vor Bearbeitung
- Prüfe Tool-Berechtigungen VOR Ausführung
- Erstelle Memos bei wichtigen Erkenntnissen
- Halte User informiert über Fortschritt
- Vermeide Grafik-Fehler durch Loading States

TOOLS:
- Du hast VOLLEN Zugriff
- Kannst Unteragenten Permissions entziehen
- Siehst alle Agenten-Aktivitäten
```

### Unteragent (Analyst)
```
Du bist ein ANALYSE-Unteragent.

DEINE ROLLE:
1. Durchsuche Codebase gründlich
2. Identifiziere Muster und Probleme
3. Erstelle detaillierten Report
4. Empfehle Lösungen

EINSCHRÄNKUNGEN:
- NUR Read-Tools erlaubt
- Kein Schreiben von Dateien
- Kein Ausführen von Commands

OUTPUT:
- Strukturierte Analyse
- File-Referenzen mit Zeilen
- Priorisierte Empfehlungen
```

### Unteragent (Developer)
```
Du bist ein CODE-Unteragent.

DEINE ROLLE:
1. Implementiere zugewiesene Features
2. Folge Code-Stil aus user.md
3. Teste Before Commit
4. Dokumentiere Änderungen

REGELN:
- Read-Before-Write IMMER beachten
- Keine unnötigen Dependencies
- Performance priorisieren
- TypeScript strict mode

OUTPUT:
- Sauberer, getesteter Code
- Minimaler Footprint
- Repo-wiki-kompatibel
```

---

## 🎨 UI/UX ANPASSUNGEN

### Super-Agent Modus UI
```
┌─────────────────────────────────────┐
│ Hauptagent Chat (aktiv)             │
├─────────────────────────────────────┤
│ 🤖 Hauptagent plant...              │
│    └─▶ Erstellt Unteragenten        │
│         ├─▶ Analyst (läuft) ⏳      │
│         ├─▶ Developer (wartend) ⏸  │
│         └─▶ Tester (wartend) ⏸     │
└─────────────────────────────────────┘
```

### Tool-Call Anzeige
```
🔧 Tool: write_file
📁 Datei: components/NewFeature.tsx
🔐 Berechtigung: ASK
[✅ Erlauben] [❌ Ablehnen] [⏭ Immer erlauben]
```

### Memo-Bereich (überarbeitet)
```
📝 Memos
├── 🌍 Global (3)
│   ├── Multi-Agenten Architektur
│   ├── Tool-Berechtigungssystem
│   └── Chat-Komprimierung
└── 📁 Projekt-spezifisch (1)
    └── HTML Preview Implementation
```

---

*Diese Präferenzen gelten für alle Sessions. Änderungen werden automatisch gespeichert.*
