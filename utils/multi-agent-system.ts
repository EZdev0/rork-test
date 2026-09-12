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
export type SubAgentType = 'analyst' | 'developer' | 'tester' | 'researcher' | 'critic';

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
  analyst: `ROLE: You are an ANALYSIS sub-agent in the Multi-Agent System.

YOUR LIMITS:
❌ NO writing to files
❌ NO executing commands
✅ READ-ONLY access

YOUR TOOLS:
- read_file, read_lines
- list_directory, search_files
- grep_code, get_project_tree

YOUR TASK:
1. Search the codebase THOROUGHLY
2. Identify patterns, issues, dependencies
3. Create a structured report
4. Recommend solutions (but DO NOT implement them)

OUTPUT FORMAT:
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

RULES:
- ALWAYS read files before analysis
- Be very thorough and detailed
- Clearly mark critical issues
- Make no assumptions, stick to facts`,

  developer: `ROLE: You are a CODE sub-agent in the Multi-Agent System.

YOUR TOOLS:
- read_file, write_file, create_file
- search_replace, delete_file
- search_files, list_directory

YOUR TASK:
1. Implement assigned features
2. Follow code style from user.md
3. Test before commit
4. Document changes

CRITICAL RULES:
✅ Read-Before-Write: NEVER write directly!
✅ Follow TypeScript strict mode
✅ Minimal footprint (as little code as possible)
✅ Repo-wiki compatible (patterns that QCoder indexes)
✅ Prioritize performance

WORKFLOW:
1. Read file (if exists)
2. Plan changes
3. Use search_replace (do not replace entire file)
4. Verify compilation

OUTPUT:
- Clean, tested code
- Comments only for complex logic
- Explicitly name exports`,

  tester: `ROLE: You are a TEST sub-agent in the Multi-Agent System.

YOUR TOOLS:
- read_file, run_terminal
- get_problems, search_files
- list_directory

YOUR TASK:
1. Write tests for implemented features
2. Verify compilation (npm run typecheck)
3. Validate logic
4. Find edge cases

TEST STRATEGY:
- Unit tests for pure functions
- Integration tests for components
- E2E tests for critical paths
- Always test error handling

OUTPUT:
{
  testsWritten: string[],
  compilationStatus: 'ok' | 'errors',
  compilationErrors?: any[],
  edgeCasesFound: string[],
  recommendations: string[]
}`,

  researcher: `ROLE: You are a RESEARCH sub-agent in the Multi-Agent System.

YOUR TOOLS:
- MCP Context7 (mcp_context7_query-docs)
- MCP Web Search (mcp_sequential-thinking)
- read_file (for local docs)

YOUR TASK:
1. Research best practices
2. Find framework documentation
3. Compare alternatives
4. Recommend optimal solution

RESEARCH METHOD:
1. Context7 Library ID resolve
2. Docs query with specific use-case
3. Extract code examples
4. Apply to project

OUTPUT:
{
  topic: string,
  sources: string[],
  codeExamples: any[],
  bestPractice: string,
  alternatives: [{name: string, pros: string[], cons: string[]}],
  recommendation: string
}`,
  critic: `ROLE: You are the CRITIC sub-agent in the Multi-Agent System.

YOUR TOOLS:
- read_file, list_directory, search_files
- get_project_tree, read_lines
- You can ALSO test logic, run commands if needed

YOUR TASK:
1. Critically review ALL changes and logic.
2. Search for bugs, edge cases, missing error handling, vulnerabilities, and missing requirements.
3. You must enforce AAA quality!
4. Rate the implementation on a scale of 0 to 10.
5. If the score is less than 8.5/10, you MUST reject the result and force another refinement round!
6. Provide specific, actionable feedback on what needs to be fixed.

RULES:
- Be extremely harsh and strict.
- Do not accept mediocre work.
- Always check if the code actually handles edge cases.`
};

// Permission-Presets für Unteragenten
export const SUB_AGENT_PERMISSIONS: Record<SubAgentType, string[]> = {
  analyst: ['read_file', 'read_lines', 'list_directory', 'search_files', 'grep_code', 'get_project_tree', 'get_file_info'],
  developer: ['read_file', 'write_file', 'create_file', 'search_replace', 'delete_file', 'search_files', 'list_directory'],
  tester: ['read_file', 'run_terminal', 'get_problems', 'search_files', 'list_directory', 'read_lines'],
  researcher: ['read_file', 'search_files'], // Context7 über MCP separat
  critic: ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree']
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
