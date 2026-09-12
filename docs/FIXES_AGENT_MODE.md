# 🔧 CRITICAL FIXES FOR AGENCY MODE

## ❌ ERRORS FOUND

### 1. **Thinking is not executed before Todo display**
**Issue**: Agent immediately shows todos without prior analysis
**File**: `providers/AgentProvider.tsx`
**Lines**: 209-218 (create_todo tool)

### 2. **Drag & Drop / Long-Press defective**
**Problem**: Modal is confusing, Cancel is missing, animation is stuck
**File**: `components/AgentPlanView.tsx`
**Lines**: 433-496 (Swap Modal), 626-663 (Long-Press Handler)

### 3. **User information is not saved in learning mode**
**Problem**: "Jonas is called Vibcoder" is forgotten
**File**: `providers/AgentProvider.tsx`
**Missing**: Auto-extraction after job completion

### 4. **Web fetch/web search unstable**
**Issue**: DuckDuckGo API does not provide consistent results
**File**: `providers/AgentProvider.tsx` lines 261-299
**Also**: `providers/ChatProvider.tsx` lines 196-245

---

## ✅ SOLUTIONS

### FIX 1: Insert thinking prompt before todo creation

In `providers/AgentProvider.tsx`, at `createPlan` (after line 352):

```typescript
// AFTER parsing the tasks, BEFORE creating the plan:
const hasThinkingTask = parsedTasks.some(t => t.taskType === 'thinking' || t.taskType === 'brainstorm');
if (!hasThinkingTask && parsedTasks.length > 2) {
// Insert automatic thinking task if complex plan
parsedTasks.unshift({
title: 'Analysis of the order',
description: 'Understand the requirements and plan the implementation systematically.',
taskType: 'thinking' as AgentTaskType,
});
}
```

### FIX 2: Improve drag and drop modal

In `components/AgentPlanView.tsx`, replace the swap modal (from line 433):

```typescript
// BETTER MODAL IMPLEMENTATION
<Modal visible={swapModal.visible} transparent animationType="slide">
<View style={styles.swapOverlay}>
<View style={styles.swapModalContent}>
<View style={styles.swapModalHeader}>
<GripVertical size={20} color={IDE.primary} />
<Text style={styles.swapModalTitle}>Move position {swapModal.fromIndex + 1}</Text>
<TouchableOpacity onPress={handleSwapCancel} style={styles.cancelBtn}>
<X size={22} color={IDE.danger} />
</TouchableOpacity>
</View>

<Text style={styles.swapHint}>Choose a new position:</Text>

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
{i === swapModal.fromIndex ?(
<View style={styles.currentBadge}>
<Text style={styles.currentBadgeText}>Current</Text>
</View>
): (
<ArrowDown size={16} color={IDE.muted} style={{
transform: [{ rotate: i < swapModal.fromIndex ?'180deg' : '0deg' }]
}} />
)}
</TouchableOpacity>
))}
</ScrollView>

<TouchableOpacity onPress={handleSwapCancel} style={styles.cancelButtonFull}>
<Text style={styles.cancelButtonText}>Cancel</Text>
</TouchableOpacity>
</View>
</View>
</Modal>
```

### FIX 3: User info auto-extraction in learning mode

In `providers/AgentProvider.tsx`, add AFTER `executePlan` (before line 947):

```typescript
// CHECK IN LEARNING MODE AT THE END OF EACH JOB
const extractUserInfoIfEnabled = useCallback(async (planId: string, messages: ChatMessage[]) => {
if (!settings.betaAgentLearning || !userMd) return;

const lastUserMessages = messages
.filter(m => m.role === 'user')
.slice(-5);

const userContent = lastUserMessages.map(m => m.content).join('\n');
if (!userContent) return;

// Check for personal information
const nameMatch = userContent.match(/\bich (?:hot|am)\s+(?:der |die )?([A-Z][a-zäöüß]+)/i);
const roleMatch = userContent.match(/\b(?:I am|as a|job(?:lich)?|developer|programmer)\s+([^.,\n!]+)/i);

if (nameMatch || roleMatch) {
let userInfo = userMd;
if (nameMatch && !userInfo.toLowerCase().includes('name')) {
userInfo += '\n\n## Name\nThe user's name is **' + nameMatch[1] + '**.';
}
if (roleMatch && !userInfo.toLowerCase().includes('role') && !userInfo.toLowerCase().includes('job')) {
userInfo += '\n\n## Role\n' + roleMatch[0].charAt(0).toUpperCase() + roleMatch[0].slice(1) + '.';
}

if (userInfo !== userMd) {
setUserMd(userInfo);
console.log('[Agent] User info updated:', { name: nameMatch?.[1], role: roleMatch?.[0] });
}
}
}, [settings.betaAgentLearning, userMd, setUserMd]);
```

Then call at the end of `executePlan` (before line 944):

```typescript
// EXTRACT USER INFO WHEN LEARNING MODE ACTIVE
if (settings.betaAgentLearning) {
const allMessages = pTasks.flatMap(t => t.subAgentMessages || []);
await extractUserInfoIfEnabled(planId, allMessages);
}
```

### FIX 4: Improve web search error handling

In `providers/AgentProvider.tsx`, replace `web_search` case (lines 261-280):

```typescript
case 'web_search': {
if (!args?.query) return { result: 'ERROR: Search term missing.'};
try {
// DuckDuckGo with better error handling
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 8000);
const resp = await fetch(
'https://api.duckduckgo.com/?q=' + encodeURIComponent(args.query) + '&format=json&no_redirect=1&no_html=1',
{ signal: controller.signal }
);
clearTimeout(timeout);

if (!resp.ok) {
// Fallback: Simulate successful search
console.log('[Web-Search] DDG failed, status:', resp.status);
return { result: 'No web results found for "' + args.query + '".Try alternative wording.'};
}

const data = await resp.json();
let results = '';

if (data?.Abstract) {
results += '**Summary:**\n' + data.Abstract + '\n\n';
}

if (data?.RelatedTopics && Array.isArray(data.RelatedTopics)) {
const topics = data.RelatedTopics.slice(0, 8);
for (const t of topics) {
if (t?.Text) {
results += '• ' + t.Text + '\n';
if (t?.FirstURL) results += ' _Source: ' + t.FirstURL + '_\n';
}
}
}

return results ||'ℹ️ No concrete results for: ' + args.query;
} catch (e: any) {
console.log('[Web-Search] Error:', e.message);
return { result: '⚠️ Web search not available (network error).Describe what you want to find.'};
}
}
```

---

## 📝 ADDITIONAL IMPROVEMENTS

### A. Expand system prompt for auto-thinking

In `utils/ai-service.ts`, at `buildPlannerPrompt`:

```typescript
// Add:
if (!parsedTasks.some(t => t.taskType === 'thinking') && tasks.length > 3) {
prompt += '\n\nTIP: For complex tasks (>3 steps), an analysis phase (thinking) should be inserted first.';
}
```

### B. ChatProvider: User info extraction also in manual mode

In `providers/ChatProvider.tsx`, after `sendMessage` (around line 600):

```typescript
// After a successful AI response in learning mode
if (settings.betaAgentLearning && response.content) {
// Check user messages for information
const userMsgs = messages.filter(m => m.role === 'user');
const lastUserMsg = userMsgs[userMsgs.length - 1]?.content ||'';

const nameExtract = lastUserMsg.match(/\bich (?:hot|am)\s+([A-Z][a-zäöüß]+)/i);
if (nameExtract && !userMd.includes(nameExtract[1])) {
const newName = '\n\n## Name\nUser is called **' + nameExtract[1] + '**.';
setUserMd(userMd + newName);
}
}
```

---

## 🎯 PRIORITIES

1. **HIGH**: FIX 3 (Save user information) - Implement immediately
2. **HIGH**: FIX 1 (Thinking before Todos) - Important for UX
3. **MEDIUM**: FIX 2 (Drag & Drop) - Usability
4. **LOW**: FIX 4 (Web Search) - Already working

---

## 🧵 IMPLEMENTATION ORDER

1. First adapt `AgentProvider.tsx` (Thinking + User Info)
2. Then improve `AgentPlanView.tsx` modal
3. Lastly `ChatProvider.tsx` for manual chats
4. Testing: Create Jonas as a Vibcoder, start the agent job
