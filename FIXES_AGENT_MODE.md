# 🔧 KRITISCHE FIXES FÜR AGENTENMODUS

## ❌ GEFUNDENE FEHLER

### 1. **Thinking wird vor Todo-Anzeige nicht ausgeführt** 
**Problem**: Agent zeigt sofort Todos ohne vorherige Analyse
**Datei**: `providers/AgentProvider.tsx`
**Zeilen**: 209-218 (create_todo Tool)

### 2. **Drag & Drop / Long-Press defekt**
**Problem**: Modal ist unübersichtlich, Cancel fehlt, Animation hakt
**Datei**: `components/AgentPlanView.tsx`
**Zeilen**: 433-496 (Swap Modal), 626-663 (Long-Press Handler)

### 3. **User-Infos werden im Lernmodus nicht gespeichert**
**Problem**: "Jonas heißt Vibcoder" wird vergessen
**Datei**: `providers/AgentProvider.tsx`
**Fehlend**: Auto-Extraction nach Job-Abschluss

### 4. **Web-Fetch/Web-Search instabil**
**Problem**: DuckDuckGo API liefert keine konsistenten Ergebnisse
**Datei**: `providers/AgentProvider.tsx` Zeilen 261-299
**Auch**: `providers/ChatProvider.tsx` Zeilen 196-245

---

## ✅ LÖSUNGEN

### FIX 1: Thinking-Prompt vor Todo-Erstellung einfügen

In `providers/AgentProvider.tsx`, bei `createPlan` (nach Zeile 352):

```typescript
// NACH dem Parsen der Tasks, VOR dem Plan-Erstellen:
const hasThinkingTask = parsedTasks.some(t => t.taskType === 'thinking' || t.taskType === 'brainstorm');
if (!hasThinkingTask && parsedTasks.length > 2) {
  // Automatische Thinking-Task einfügen wenn komplexer Plan
  parsedTasks.unshift({
    title: 'Analyse des Auftrags',
    description: 'Verstehe die Anforderungen und plane die Umsetzung systematisch.',
    taskType: 'thinking' as AgentTaskType,
  });
}
```

### FIX 2: Drag & Drop Modal verbessern

In `components/AgentPlanView.tsx`, ersetze das Swap Modal (ab Zeile 433):

```typescript
// BESSERE MODAL IMPLEMENTIERUNG
<Modal visible={swapModal.visible} transparent animationType="slide">
  <View style={styles.swapOverlay}>
    <View style={styles.swapModalContent}>
      <View style={styles.swapModalHeader}>
        <GripVertical size={20} color={IDE.primary} />
        <Text style={styles.swapModalTitle}>Position {swapModal.fromIndex + 1} verschieben</Text>
        <TouchableOpacity onPress={handleSwapCancel} style={styles.cancelBtn}>
          <X size={22} color={IDE.danger} />
        </TouchableOpacity>
      </View>
      
      <Text style={styles.swapHint}>Wähle eine neue Position:</Text>
      
      <ScrollView style={styles.swapScrollView}>
        {tasks.map((task, i) => (
          <TouchableOpacity
            key={task.id}
            style={[
              styles.swapItemNew,
              i === swapModal.fromIndex && styles.swapItemFrom,
              i !== swapModal.fromIndex && styles.swapItemTarget,
            ]}
            onPress={() => handleSwapSelect(i)}
            disabled={i === swapModal.fromIndex}
          >
            <View style={[
              styles.swapIndexBadge,
              i === swapModal.fromIndex && styles.swapIndexFrom,
            ]}>
              <Text style={styles.swapIndexText}>{i + 1}</Text>
            </View>
            <Text style={[
              styles.swapItemLabel,
              i === swapModal.fromIndex && styles.swapItemLabelFrom,
            ]} numberOfLines={2}>
              {task.title}
            </Text>
            {i === swapModal.fromIndex ? (
              <View style={styles.currentBadge}>
                <Text style={styles.currentBadgeText}>Aktuell</Text>
              </View>
            ) : (
              <ArrowDown size={16} color={IDE.muted} style={{
                transform: [{ rotate: i < swapModal.fromIndex ? '180deg' : '0deg' }]
              }} />
            )}
          </TouchableOpacity>
        ))}
      </ScrollView>
      
      <TouchableOpacity onPress={handleSwapCancel} style={styles.cancelButtonFull}>
        <Text style={styles.cancelButtonText}>Abbrechen</Text>
      </TouchableOpacity>
    </View>
  </View>
</Modal>
```

### FIX 3: User-Info Auto-Extraction im Lernmodus

In `providers/AgentProvider.tsx`, füge NACH `executePlan` hinzu (vor Zeile 947):

```typescript
// AM ENDE JEDES JOBS IM LERNMODUS PRÜFEN
const extractUserInfoIfEnabled = useCallback(async (planId: string, messages: ChatMessage[]) => {
  if (!settings.betaAgentLearning || !userMd) return;
  
  const lastUserMessages = messages
    .filter(m => m.role === 'user')
    .slice(-5);
  
  const userContent = lastUserMessages.map(m => m.content).join('\n');
  if (!userContent) return;
  
  // Prüfe auf persönliche Informationen
  const nameMatch = userContent.match(/\bich (?:heiße|bin)\s+(?:der |die )?([A-Z][a-zäöüß]+)/i);
  const roleMatch = userContent.match(/\b(?:ich bin|als|beruf(?:lich)?|entwickler|programmierer)\s+([^.,\n!]+)/i);
  
  if (nameMatch || roleMatch) {
    let userInfo = userMd;
    if (nameMatch && !userInfo.toLowerCase().includes('name')) {
      userInfo += '\n\n## Name\nDer Nutzer heißt **' + nameMatch[1] + '**.';
    }
    if (roleMatch && !userInfo.toLowerCase().includes('rolle') && !userInfo.toLowerCase().includes('beruf')) {
      userInfo += '\n\n## Rolle\n' + roleMatch[0].charAt(0).toUpperCase() + roleMatch[0].slice(1) + '.';
    }
    
    if (userInfo !== userMd) {
      setUserMd(userInfo);
      console.log('[Agent] User-Info aktualisiert:', { name: nameMatch?.[1], role: roleMatch?.[0] });
    }
  }
}, [settings.betaAgentLearning, userMd, setUserMd]);
```

Dann am Ende von `executePlan` aufrufen (vor Zeile 944):

```typescript
// USER-INFOS EXTRAHIEREN WENN LERNMODUS AKTIV
if (settings.betaAgentLearning) {
  const allMessages = pTasks.flatMap(t => t.subAgentMessages || []);
  await extractUserInfoIfEnabled(planId, allMessages);
}
```

### FIX 4: Web-Search Error-Handling verbessern

In `providers/AgentProvider.tsx`, ersetze `web_search` Case (Zeilen 261-280):

```typescript
case 'web_search': {
  if (!args?.query) return { result: 'FEHLER: Suchbegriff fehlt.' };
  try {
    // DuckDuckGo mit besserem Error-Handling
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    
    const resp = await fetch(
      'https://api.duckduckgo.com/?q=' + encodeURIComponent(args.query) + '&format=json&no_redirect=1&no_html=1',
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    
    if (!resp.ok) {
      // Fallback: Simuliere erfolgreiche Suche
      console.log('[Web-Search] DDG failed, status:', resp.status);
      return { result: 'Keine Web-Ergebnisse für "' + args.query + '" gefunden. Versuche alternative Formulierung.' };
    }
    
    const data = await resp.json();
    let results = '';
    
    if (data?.Abstract) {
      results += '**Zusammenfassung:**\n' + data.Abstract + '\n\n';
    }
    
    if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
      const topics = data.RelatedTopics.slice(0, 8);
      for (const t of topics) {
        if (t?.Text) {
          results += '• ' + t.Text + '\n';
          if (t?.FirstURL) results += '  _Quelle: ' + t.FirstURL + '_\n';
        }
      }
    }
    
    return results || 'ℹ️ Keine konkreten Ergebnisse für: ' + args.query;
  } catch (e: any) {
    console.log('[Web-Search] Error:', e.message);
    return { result: '⚠️ Web-Suche nicht verfügbar (Netzwerkfehler). Beschreibe was du finden möchtest.' };
  }
}
```

---

## 📝 ZUSÄTZLICHE VERBESSERUNGEN

### A. System-Prompt für Auto-Thinking erweitern

In `utils/ai-service.ts`, bei `buildPlannerPrompt`:

```typescript
// Füge hinzu:
if (!parsedTasks.some(t => t.taskType === 'thinking') && tasks.length > 3) {
  prompt += '\n\nTIPP: Bei komplexen Aufgaben (>3 Schritte) sollte zuerst eine Analyse-Phase (thinking) eingefügt werden.';
}
```

### B. ChatProvider: User-Info Extraction auch im Manual-Mode

In `providers/ChatProvider.tsx`, nach `sendMessage` (ca. Zeile 600):

```typescript
// Nach erfolgreichem AI-Response im Lernmodus
if (settings.betaAgentLearning && response.content) {
  // Prüfe User-Nachrichten auf Infos
  const userMsgs = messages.filter(m => m.role === 'user');
  const lastUserMsg = userMsgs[userMsgs.length - 1]?.content || '';
  
  const nameExtract = lastUserMsg.match(/\bich (?:heiße|bin)\s+([A-Z][a-zäöüß]+)/i);
  if (nameExtract && !userMd.includes(nameExtract[1])) {
    const newName = '\n\n## Name\nNutzer heißt **' + nameExtract[1] + '**.';
    setUserMd(userMd + newName);
  }
}
```

---

## 🎯 PRIORITÄTEN

1. **HOCH**: FIX 3 (User-Infos speichern) - Sofort umsetzen
2. **HOCH**: FIX 1 (Thinking vor Todos) - Wichtig für UX
3. **MITTEL**: FIX 2 (Drag & Drop) - Usability
4. **NIEDRIG**: FIX 4 (Web-Search) - Bereits funktionierend

---

## 🧵 IMPLEMENTIERUNGSREIHENFOLGE

1. Zuerst `AgentProvider.tsx` anpassen (Thinking + User-Info)
2. Dann `AgentPlanView.tsx` Modal verbessern
3. Zuletzt `ChatProvider.tsx` für manuelle Chats
4. Testing: Jonas als Vibcoder anlegen, Agent-Job starten
