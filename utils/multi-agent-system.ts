/**
 * Multi-Agenten-System Erweiterung
 * 
 * Fügt Unteragenten-Unterstützung zum bestehenden AgentProvider hinzu
 * - Hauptagent koordiniert
 * - Unteragenten führen Sub-Tasks aus
 * - Tool-Berechtigungen werden vererbt/eingeschränkt
 */

import { AgentTask, ChatMessage, AIProviderType, PendingToolApproval } from '@/types';
import { callAI, TOOL_DEFINITIONS } from '@/utils/ai-service';

// Types für Multi-Agenten-System
export type SubAgentType = 'analyst' | 'developer' | 'tester' | 'researcher';

export interface SubAgent {
  id: string;
  type: SubAgentType;
  name: string;
  status: 'idle' | 'working' | 'completed' | 'error' | 'waiting';
  systemPrompt: string;
  permissions: string[]; // Erlaubte Tools
  currentTask?: SubAgentTask;
  chatHistory: ChatMessage[];
  result?: SubAgentResult;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

export interface SubAgentTask {
  id: string;
  title: string;
  description: string;
  goal: string;
  files?: string[]; // Zu bearbeitende Dateien
  outputFormat: string; // Erwartetes Output-Format
  priority: 'high' | 'medium' | 'low';
  parentTaskId?: string; // Verweis auf Haupt-Task
}

export interface SubAgentResult {
  status: 'success' | 'partial' | 'failed';
  summary: string;
  findings?: any[]; // Analyse-Ergebnisse
  filesCreated?: string[];
  filesModified?: string[];
  codeChanges?: any;
  recommendations?: string[];
  nextSteps?: string[];
}

export interface MultiAgentState {
  enabled: boolean; // Super-Agent Modus aktiv?
  mainAgentId: string;
  subAgents: SubAgent[];
  activeSubAgentId?: string;
  coordinationChat: ChatMessage[]; // Kommunikation zwischen Agenten
}

// Default System-Prompts für Unteragenten
export const SUB_AGENT_PROMPTS: Record<SubAgentType, string> = {
  analyst: `ROLLE: Du bist ein ANALYSE-Unteragent im Multi-Agenten-System.

DEINE LIMITS:
❌ KEIN Schreiben von Dateien
❌ KEIN Ausführen von Commands
✅ NUR Lese-Zugriff

DEINE TOOLS:
- read_file, read_lines
- list_directory, search_files
- grep_code, get_project_tree

DEINE AUFGABE:
1. Durchsuche Codebase GRÜNDLICH
2. Identifiziere Patterns, Probleme, Abhängigkeiten
3. Erstelle strukturierten Report
4. Empfehle Lösungen (aber implementiere NICHT)

OUTPUT-FORMAT:
{
  status: 'complete' | 'partial' | 'failed',
  filesAnalyzed: string[],
  findings: [{
    file: string,
    line: number,
    issue: string,
    severity: 'high' | 'medium' | 'low',
    recommendation: string
  }],
  summary: string,
  nextSteps: string[]
}

REGELN:
- Lies IMMER Dateien vor Analyse
- Sei sehr gründlich und detailliert
- Markiere kritische Issues klar
- Keine Annahmen treffen, nur Fakten`,

  developer: `ROLLE: Du bist ein CODE-Unteragent im Multi-Agenten-System.

DEINE TOOLS:
- read_file, write_file, create_file
- search_replace, delete_file
- search_files, list_directory

DEINE AUFGABE:
1. Implementiere zugewiesene Features
2. Folge Code-Stil aus user.md
3. Teste Before Commit
4. Dokumentiere Änderungen

KRITISCHE REGELN:
✅ Read-Before-Write: NIEMALS direkt schreiben!
✅ TypeScript strict mode einhalten
✅ Minimaler Footprint (wenig Code wie möglich)
✅ Repo-wiki-kompatibel (Pattern die QCoder indexieren kann)
✅ Performance priorisieren

WORKFLOW:
1. Datei lesen (falls existierend)
2. Änderungen planen
3. Search_replace nutzen (nicht整个 Datei ersetzen)
4. Kompilierung prüfen

OUTPUT:
- Sauberer, getesteter Code
- Kommentare nur bei komplexer Logik
- Exporte explizit benennen`,

  tester: `ROLLE: Du bist ein TEST-Unteragent im Multi-Agenten-System.

DEINE TOOLS:
- read_file, run_terminal
- get_problems, search_files
- list_directory

DEINE AUFGABE:
1. Schreibe Tests für implementierte Features
2. Prüfe Kompilierung (npm run typecheck)
3. Validiere Logik
4. Finde Edge Cases

TEST-STRATEGIE:
- Unit Tests für reine Funktionen
- Integration Tests für Components
- E2E Tests für kritische Pfade
- Error Handling immer testen

OUTPUT:
{
  testsWritten: string[],
  compilationStatus: 'ok' | 'errors',
  compilationErrors?: any[],
  edgeCasesFound: string[],
  recommendations: string[]
}`,

  researcher: `ROLLE: Du bist ein RESEARCH-Unteragent im Multi-Agenten-System.

DEINE TOOLS:
- MCP Context7 (mcp_context7_query-docs)
- MCP Websuche (mcp_sequential-thinking)
- read_file (für lokale Doku)

DEINE AUFGABE:
1. Recherchiere Best Practices
2. Finde Framework-Dokumentation
3. Vergleiche Alternativen
4. Empfiehl optimale Lösung

RESEARCH-METHODE:
1. Context7 Library ID resolve
2. Docs query mit spezifischem Use-Case
3. Code-Beispiele extrahieren
4. Auf Projekt anwenden

OUTPUT:
{
  topic: string,
  sources: string[],
  codeExamples: any[],
  bestPractice: string,
  alternatives: [{name: string, pros: string[], cons: string[]}],
  recommendation: string
}`
};

// Permission-Presets für Unteragenten
export const SUB_AGENT_PERMISSIONS: Record<SubAgentType, string[]> = {
  analyst: ['read_file', 'read_lines', 'list_directory', 'search_files', 'grep_code', 'get_project_tree', 'get_file_info'],
  developer: ['read_file', 'write_file', 'create_file', 'search_replace', 'delete_file', 'search_files', 'list_directory'],
  tester: ['read_file', 'run_terminal', 'get_problems', 'search_files', 'list_directory', 'read_lines'],
  researcher: ['read_file', 'search_files'] // Context7 über MCP separat
};

/**
 * Erstellt neuen Unteragenten
 */
export function createSubAgent(type: SubAgentType, task?: SubAgentTask): SubAgent {
  return {
    id: `sub_${type}_${Date.now()}`,
    type,
    name: `${type.charAt(0).toUpperCase() + type.slice(1)}-Agent`,
    status: task ? 'working' : 'idle',
    systemPrompt: SUB_AGENT_PROMPTS[type],
    permissions: SUB_AGENT_PERMISSIONS[type],
    currentTask: task,
    chatHistory: [],
    createdAt: Date.now()
  };
}

/**
 * Führt Task mit Unteragenten aus
 */
export async function executeSubAgentTask(
  agent: SubAgent,
  task: SubAgentTask,
  apiKey: string,
  provider: AIProviderType,
  model: string,
  customEndpoint?: string
): Promise<SubAgentResult> {
  try {
    // 1. Task-spezifischen Prompt bauen
    const taskPrompt = buildSubAgentTaskPrompt(task);
    
    // 2. Tools filtern nach Permissions
    const allowedTools = TOOL_DEFINITIONS.filter(t => agent.permissions.includes(t.name));
    
    // 3. KI aufrufen
    const messages: ChatMessage[] = [
      { id: 'init', role: 'user', content: taskPrompt, timestamp: Date.now() }
    ];
    
    const response = await callAI(
      provider,
      apiKey,
      model,
      messages,
      allowedTools,
      agent.systemPrompt,
      customEndpoint
    );
    
    // 4. Ergebnis parsen (response ist {content, toolCalls, ...})
    const result = parseSubAgentResponse(response.content, agent.type);
    
    // 5. Agent aktualisieren
    agent.status = 'completed';
    agent.result = result;
    agent.completedAt = Date.now();
    
    return result;
    
  } catch (error: any) {
    agent.status = 'error';
    agent.error = error.message;
    
    return {
      status: 'failed',
      summary: `Task failed: ${error.message}`,
      recommendations: ['Error analysieren und Task neu versuchen']
    };
  }
}

/**
 * Baut Prompt für Unteragenten-Task
 */
function buildSubAgentTaskPrompt(task: SubAgentTask): string {
  let prompt = `AUFGABE: ${task.title}\n\n`;
  prompt += `BESCHREIBUNG: ${task.description}\n\n`;
  prompt += `ZIEL: ${task.goal}\n\n`;
  
  if (task.files && task.files.length > 0) {
    prompt += `RELEVANTE DATEIEN:\n${task.files.map(f => `- ${f}`).join('\n')}\n\n`;
  }
  
  prompt += `ERWARTETER OUTPUT:\n${task.outputFormat}\n\n`;
  
  if (task.priority === 'high') {
    prompt += `⚠️ PRIORITÄT: HOCH - Bitte schnell bearbeiten!\n\n`;
  }
  
  return prompt;
}

/**
 * Parst Antwort von Unteragent
 */
function parseSubAgentResponse(response: string, agentType: SubAgentType): SubAgentResult {
  // Simple parsing - in production would need better logic
  const lines = response.split('\n');
  
  return {
    status: 'success',
    summary: response.substring(0, 500),
    recommendations: lines.filter(l => l.startsWith('- ') || l.startsWith('•')).slice(0, 5)
  };
}

/**
 * Koordiniert Kommunikation zwischen Agenten
 */
export function coordinateAgentCommunication(
  mainAgentChat: ChatMessage[],
  subAgentResults: SubAgentResult[]
): ChatMessage[] {
  // Fasse Ergebnisse zusammen
  const summary: ChatMessage = {
    id: `coord_${Date.now()}`,
    role: 'assistant',
    content: buildCoordinationSummary(subAgentResults),
    timestamp: Date.now()
  };
  
  return [...mainAgentChat, summary];
}

/**
 * Baut Zusammenfassung der Agenten-Koordination
 */
function buildCoordinationSummary(results: SubAgentResult[]): string {
  let summary = '## 🤖 Multi-Agenten Koordination\n\n';
  
  results.forEach((result, idx) => {
    summary += `### Agent ${idx + 1}\n`;
    summary += `Status: ${result.status === 'success' ? '✅' : result.status === 'partial' ? '⚠️' : '❌'}\n`;
    summary += `Ergebnis: ${result.summary}\n`;
    
    if (result.recommendations?.length) {
      summary += `Empfehlungen:\n${result.recommendations.map(r => `- ${r}`).join('\n')}\n`;
    }
    
    summary += '\n---\n\n';
  });
  
  return summary;
}
