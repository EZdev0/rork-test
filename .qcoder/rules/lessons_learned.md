# 🧠 QCoder System-Gedächtnis (LONG-TERM MEMORY)

*Dies ist das zentrale Lern-System. QCoder liest dies VOR jeder Aktion um Fehler zu vermeiden.*

## 📋 Memory-Kategorien

### 1. Globale Memos (Übergreifendes Lernen)
- **Speicherort:** `.qcoder/rules/lessons_learned.md` (diese Datei)
- **Zweck:** Framework-übergreifende Erkenntnisse, Architektur-Patterns, wiederkehrende Fehler
- **Automatische Erstellung:** KI erstellt bei neuen Erkenntnissen Eintrag

### 2. Lokale Memos (Projekt-spezifisch)
- **Speicherort:** `.qcoder/memos/{projekt-name}.md`
- **Zweck:** Projekt-bezogene Entscheidungen, Code-Stil, spezifische Anforderungen
- **Verknüpfung:** Kann mit spezifischen Files verlinkt sein

---

## 🔴 KRITISCHE REGELN (IMMER BEACHTEN!)

### [REGEL-001] Read-Before-Write
**Vor JEDEM Schreibzugriff MUSS Datei gelesen werden!**
```
✅ KORREKT: read_file → Analyse → search_replace
❌ FALSCH: Direkt schreiben ohne Kontext
```

### [REGEL-002] Multi-Agenten Hierarchie
```
Hauptagent (Super-Agent Modus AKTIV)
├── Hat VOLLE Tool-Berechtigung
├── Kann Unteragenten erstellen/steuern
├── Erhält Tasks von User
└── Delegiert an Unteragenten
    ├── Read-Only Agent (Analyse)
    ├── Code Agent (Implementierung)
    └── Test Agent (Validierung)
```

### [REGEL-003] Tool-Berechtigungen
- **YOLO Mode:** Alle Tools ohne Nachfrage
- **Standard Mode:** 
  - Read-Tools: Immer erlaubt
  - Write-Tools: Nachfrage required
  - Tool-Calls werden am UI angezeigt
- **Unteragenten:** Benötigen explizite Permission-Level

### [REGEL-004] Chat-Komprimierung
- Alle 10 Nachrichten ODER bei Kontextwechsel
- Nur relevante Informationen behalten
- User muss vor Löschung bestätigen
- Zusammenfassung im Memo speichern

---

## 📚 Bekannte Probleme & Lösungen

### [2026-03-02] Multi-Agenten Kommunikation
**[FEHLER]** Hauptagent kommuniziert nicht klar mit Unteragenten  
**[URSACHE]** Fehlender Systemprompt für Rollentrennung  
**[LÖSUNG]** Jeder Agent erhält spezifischen Systemprompt mit klaren Zielen

### [2026-03-02] Grafik-Fehler bei Agenten-UI
**[FEHLER]** UI wird nicht korrekt aktualisiert nach Agenten-Aktion  
**[URSACHE]** Race Conditions, fehlende Loading States  
**[LÖSUNG]** 
- Loading State VOR Agenten-Start anzeigen
- Error Boundaries um jede Komponente
- UI-Update erst nach Data-Validation

### [2026-03-02] Tool-Call Berechtigungen
**[FEHLER]** Tools wurden ohne Permission ausgeführt  
**[LÖSUNG]** 
```javascript
if (!yoloMode && tool.requiresPermission) {
  showPermissionDialog(tool);
  return; // Warten auf User-Input
}
```

---

## 🎯 Auto-Memo Vorlage

Wenn KI neue Erkenntnis gewinnt:
```markdown
### [DATUM] Kurztitel des Problems
**[FEHLER]** Was ist schiefgelaufen?  
**[URSACHE]** Warum ist es passiert? (Root Cause)  
**[LÖSUNG]** Wie wurde es fixiert?  
**[PRÄVENTION]** Wie verhindern wir zukünftige Fehler?
```

---

## ⚡ Quick-Reference für KI

**VOR JEDER AKTION:**
1. ✅ lessons_learned.md gelesen?
2. ✅ Projekt-spezifisches Memo geprüft?
3. ✅ Dateien gelesen vor Bearbeitung?
4. ✅ Tool-Berechtigungen validiert?
5. ✅ Super-Agent Modus berücksichtigt?

**BEI FEHLERN:**
1. ❌ Sofort stoppen
2. 📝 Fehler hier dokumentieren
3. 🔍 Root Cause analysieren
4. ✅ Fix implementieren
5. 🔄 Validieren dass Fix funktioniert

---

*Dieses Dokument wird dynamisch erweitert. Jede Session kann neue Einträge hinzufügen.*
