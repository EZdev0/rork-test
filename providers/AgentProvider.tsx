import React, { useState, useCallback, useRef } from 'react';
import createContextHook from '@nkzw/create-context-hook';
import { AgentPlan, AgentTask, AgentTaskStatus, AgentTaskType, AgentToolUsage, ChatMessage, ToolCall, AIProviderType, PendingToolApproval, TOOL_REGISTRY } from '@/types';
import { callAI, TOOL_DEFINITIONS, buildSystemPrompt, buildPlannerPrompt, parsePlanFromAI, generateFinalResponse } from '@/utils/ai-service';
import { useApp } from '@/providers/AppProvider';
import { useProject } from '@/providers/ProjectProvider';

function genId(): string {
  return 'ag_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function buildFinalSummaryContext(
  userRequest: string,
  tasks: AgentTask[],
  filesCreated: string[],
  filesModified: string[],
  filesDeleted: string[],
  hasErrors: boolean,
): string {
  let ctx = 'Fasse das Ergebnis dieses Auftrags zusammen und erkläre dem Nutzer was erledigt wurde.\n\n';
  ctx += '## Ursprünglicher Auftrag\n' + userRequest + '\n\n';
  ctx += '## Ausgeführte Schritte\n';
  for (const t of tasks) {
    const status = t.status === 'completed' ? '✅' : t.status === 'error' ? '❌' : '⏭️';
    ctx += status + ' **' + t.title + '**';
    if (t.result) ctx += ': ' + t.result.slice(0, 200);
    if (t.error) ctx += ' (Fehler: ' + t.error + ')';
    ctx += '\n';
  }
  if (filesCreated.length > 0) ctx += '\n**Erstellte Dateien:** ' + [...new Set(filesCreated)].join(', ') + '\n';
  if (filesModified.length > 0) ctx += '**Geänderte Dateien:** ' + [...new Set(filesModified)].join(', ') + '\n';
  if (filesDeleted.length > 0) ctx += '**Gelöschte Dateien:** ' + [...new Set(filesDeleted)].join(', ') + '\n';
  if (hasErrors) ctx += '\nEs gab Fehler bei einigen Aufgaben. Erkläre was funktioniert hat und was nicht.\n';
  ctx += '\nSchreibe eine hilfreiche Zusammenfassung. Erwähne welche Dateien erstellt/geändert wurden und was der nächste Schritt sein könnte.';
  return ctx;
}

export const [AgentProvider, useAgent] = createContextHook(() => {
  const [plans, setPlans] = useState<AgentPlan[]>([]);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [isPlanning, setIsPlanning] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const [pendingToolApproval, setPendingToolApproval] = useState<PendingToolApproval | null>(null);
  const abortRef = useRef<boolean>(false);
  const plansRef = useRef<AgentPlan[]>([]);
  plansRef.current = plans;

  const { settings, getApiKey, getFallbackSettings, todos, memos, addTodo, updateTodoItem, addMemo, agentMd, setAgentMd, soulMd, setSoulMd, identityMd, setIdentityMd, userMd, setUserMd, memoryMd, setMemoryMd, getToolPermission } = useApp();
  const {
    getFileContent, updateFileContent, createFile, deleteFile, renameFile,
    createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo,
  } = useProject();

  const activePlan = plans.find(p => p.id === activePlanId) ?? null;

  const updatePlan = useCallback((planId: string, updater: (plan: AgentPlan) => AgentPlan) => {
    setPlans(prev => prev.map(p => p.id === planId ? updater({ ...p }) : p));
  }, []);

  const updateTaskInPlan = useCallback((planId: string, taskId: string, updater: (task: AgentTask) => AgentTask) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      return {
        ...p,
        tasks: p.tasks.map(t => t.id === taskId ? updater({ ...t }) : t),
      };
    }));
  }, []);

  const checkAgentToolPermission = useCallback(async (toolName: string, args: Record<string, any>): Promise<{ allowed: boolean; reason?: string }> => {
    const perm = getToolPermission(toolName);
    console.log('[Agent] Checking permission for', toolName, ':', perm);

    if (perm === 'always') return { allowed: true };
    if (perm === 'removed') return { allowed: false, reason: 'TOOL_HIDDEN' };
    if (perm === 'blocked') return { allowed: false, reason: 'TOOL_BLOCKED: Tool "' + toolName + '" ist vom Nutzer blockiert. Informiere den Nutzer, dass dieses Tool freigegeben werden muss.' };

    if (perm === 'ask') {
      return new Promise<{ allowed: boolean; reason?: string }>((resolve) => {
        const reg = TOOL_REGISTRY.find(t => t.name === toolName);
        const approval: PendingToolApproval = {
          id: 'agap_' + Date.now().toString(36),
          toolName,
          toolDisplayName: reg?.displayName || toolName,
          arguments: args,
          resolve: (approved: boolean) => {
            setPendingToolApproval(null);
            resolve(approved
              ? { allowed: true }
              : { allowed: false, reason: 'TOOL_REJECTED: Nutzer hat "' + toolName + '" abgelehnt.' }
            );
          },
          timestamp: Date.now(),
        };
        setPendingToolApproval(approval);
      });
    }

    return { allowed: true };
  }, [getToolPermission]);

  const approveAgentTool = useCallback((approved: boolean) => {
    if (pendingToolApproval) {
      pendingToolApproval.resolve(approved);
    }
  }, [pendingToolApproval]);

  const executeTool = useCallback(async (name: string, args: Record<string, any>): Promise<{ result: string; fileAction?: { type: 'created' | 'modified' | 'deleted'; path: string } }> => {
    console.log('[Agent] Executing tool:', name, JSON.stringify(args).slice(0, 200));

    if (name !== 'think' && name !== 'task_complete' && name !== 'verify_file') {
      const permCheck = await checkAgentToolPermission(name, args);
      if (!permCheck.allowed) {
        if (permCheck.reason === 'TOOL_HIDDEN') {
          return { result: 'FEHLER: Unbekanntes Tool "' + name + '".' };
        }
        return { result: permCheck.reason || 'Tool nicht erlaubt.' };
      }
    }

    try {
      switch (name) {
        case 'read_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden.' };
          return { result: content };
        }
        case 'read_lines': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden.' };
          const lines = content.split('\n');
          const start = Math.max(0, (args.start_line || 1) - 1);
          const end = Math.min(lines.length, args.end_line || lines.length);
          return { result: lines.slice(start, end).map((l: string, i: number) => (start + i + 1) + ': ' + l).join('\n') };
        }
        case 'write_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const existed = getFileContent(args.path) !== null;
          updateFileContent(args.path, args.content ?? '');
          const lineCount = (args.content || '').split('\n').length;
          return {
            result: 'Datei "' + args.path + '" geschrieben (' + lineCount + ' Zeilen).',
            fileAction: { type: existed ? 'modified' : 'created', path: args.path },
          };
        }
        case 'create_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          createFile(args.path, args.content || '');
          return { result: 'Datei "' + args.path + '" erstellt.', fileAction: { type: 'created', path: args.path } };
        }
        case 'edit_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          if (!args?.old_text) return { result: 'FEHLER: old_text ist leer.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden. Bitte erst mit read_file lesen.' };
          if (!content.includes(args.old_text)) return { result: 'FEHLER: Text nicht gefunden in "' + args.path + '". Bitte erneut mit read_file lesen.' };
          const newContent = content.replace(args.old_text, args.new_text ?? '');
          updateFileContent(args.path, newContent);
          return { result: 'Datei "' + args.path + '" bearbeitet.', fileAction: { type: 'modified', path: args.path } };
        }
        case 'delete_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          deleteFile(args.path);
          return { result: 'Datei "' + args.path + '" gelöscht.', fileAction: { type: 'deleted', path: args.path } };
        }
        case 'rename_file': {
          if (!args?.old_path || !args?.new_path) return { result: 'FEHLER: old_path und new_path sind erforderlich.' };
          renameFile(args.old_path, args.new_path);
          return { result: 'Umbenannt: "' + args.old_path + '" → "' + args.new_path + '".', fileAction: { type: 'modified', path: args.new_path } };
        }
        case 'list_directory': {
          return { result: listDirectory(args?.path || '') };
        }
        case 'search_files': {
          if (!args?.query) return { result: 'FEHLER: Kein Suchbegriff angegeben.' };
          return { result: searchFilesInProject(args.query, args.path) };
        }
        case 'find_replace': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          if (args?.find === undefined || args?.find === null || args.find === '') return { result: 'FEHLER: Suchtext (find) fehlt.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" nicht gefunden.' };
          let newContent: string;
          let count: number;
          if (args.all) {
            count = content.split(args.find).length - 1;
            newContent = content.split(args.find).join(args.replace ?? '');
          } else {
            count = content.includes(args.find) ? 1 : 0;
            newContent = content.replace(args.find, args.replace ?? '');
          }
          updateFileContent(args.path, newContent);
          return { result: count + ' Vorkommen in "' + args.path + '" ersetzt.', fileAction: { type: 'modified', path: args.path } };
        }
        case 'create_directory': {
          if (!args?.path) return { result: 'FEHLER: Kein Pfad angegeben.' };
          createDirectory(args.path);
          return { result: 'Verzeichnis "' + args.path + '" erstellt.' };
        }
        case 'get_project_tree': {
          return { result: getProjectTree() };
        }
        case 'get_file_info': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          return { result: getFileInfo(args.path) };
        }
        case 'create_todo': {
          if (!args?.text) return { result: 'FEHLER: Todo-Text fehlt.' };
          const id = addTodo(args.text);
          return { result: 'Todo erstellt (ID: ' + id + '): "' + args.text + '"' };
        }
        case 'update_todo': {
          if (!args?.id) return { result: 'FEHLER: Todo-ID fehlt.' };
          updateTodoItem(args.id, args.completed, args.text);
          return { result: 'Todo "' + args.id + '" aktualisiert.' };
        }
        case 'add_memo': {
          if (!args?.content) return { result: 'FEHLER: Memo-Inhalt fehlt.' };
          addMemo(args.content);
          return { result: 'Memo gespeichert: "' + args.content + '"' };
        }
        case 'think': {
          return { result: 'Gedankengang verarbeitet.' };
        }
        case 'read_identity_files': {
          let output = '';
          output += '## SOUL.md\n' + (soulMd || '(leer)') + '\n\n';
          output += '## AGENTS.md\n' + (agentMd || '(leer)') + '\n\n';
          output += '## IDENTITY.md\n' + (identityMd || '(leer)') + '\n\n';
          output += '## USER.md\n' + (userMd || '(leer)') + '\n\n';
          output += '## MEMORY.md\n' + (memoryMd || '(leer)');
          return { result: output };
        }
        case 'update_soul_md': {
          if (!args?.content) return { result: 'FEHLER: Kein Inhalt angegeben.' };
          setSoulMd(args.content);
          return { result: 'SOUL.md aktualisiert (' + args.content.split('\n').length + ' Zeilen).' };
        }
        case 'update_agents_md': {
          if (!args?.content) return { result: 'FEHLER: Kein Inhalt angegeben.' };
          setAgentMd(args.content);
          return { result: 'AGENTS.md aktualisiert (' + args.content.split('\n').length + ' Zeilen).' };
        }
        case 'update_identity_md': {
          if (!args?.content) return { result: 'FEHLER: Kein Inhalt angegeben.' };
          setIdentityMd(args.content);
          return { result: 'IDENTITY.md aktualisiert (' + args.content.split('\n').length + ' Zeilen).' };
        }
        case 'update_user_md': {
          if (!args?.content) return { result: 'FEHLER: Kein Inhalt angegeben.' };
          setUserMd(args.content);
          return { result: 'USER.md aktualisiert (' + args.content.split('\n').length + ' Zeilen).' };
        }
        case 'update_memory_md': {
          if (!args?.content) return { result: 'FEHLER: Kein Inhalt angegeben.' };
          setMemoryMd(args.content);
          return { result: 'MEMORY.md aktualisiert (' + args.content.split('\n').length + ' Zeilen).' };
        }
        case 'web_search': {
          if (!args?.query) return { result: 'FEHLER: Suchbegriff fehlt.' };
          try {
            // DuckDuckGo mit besserem Error-Handling und Timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 8000);
            
            const resp = await fetch(
              'https://api.duckduckgo.com/?q=' + encodeURIComponent(args.query) + '&format=json&no_redirect=1&no_html=1',
              { signal: controller.signal }
            );
            clearTimeout(timeoutId);
            
            if (!resp.ok) {
              console.log('[Web-Search] DDG failed, status:', resp.status);
              return { result: 'ℹ️ Keine Web-Ergebnisse für "' + args.query + '" gefunden. Versuche alternative Formulierung.' };
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
            
            return { result: results || 'ℹ️ Keine konkreten Ergebnisse für: ' + args.query };
          } catch (e: any) {
            console.log('[Web-Search] Error:', e.message);
            return { result: '⚠️ Web-Suche nicht verfügbar (Netzwerkfehler). Beschreibe was du finden möchtest.' };
          }
        }
        case 'web_fetch': {
          if (!args?.url) return { result: 'FEHLER: URL fehlt.' };
          try {
            const resp = await fetch(args.url, {
              headers: { 'Accept': 'text/html,text/plain,application/json' },
            });
            if (!resp.ok) return { result: 'Fetch fehlgeschlagen (Status ' + resp.status + ').' };
            const text = await resp.text();
            const maxLen = args.max_length || 5000;
            const cleaned = text.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            return { result: cleaned.length > maxLen ? cleaned.slice(0, maxLen) + '... (gekürzt)' : cleaned };
          } catch (e: any) {
            return { result: 'FEHLER bei Web-Fetch: ' + (e?.message || 'Netzwerkfehler') };
          }
        }
        case 'task_complete': {
          return { result: 'AUFGABE_ABGESCHLOSSEN: ' + (args?.summary || 'Fertig') };
        }
        case 'verify_file': {
          if (!args?.path) return { result: 'FEHLER: Kein Dateipfad angegeben.' };
          const content = getFileContent(args.path);
          if (content === null) return { result: 'FEHLER: Datei "' + args.path + '" existiert nicht.' };
          const lines = content.split('\n').length;
          const isEmpty = content.trim().length === 0;
          return { result: 'Datei "' + args.path + '" existiert. Zeilen: ' + lines + '. Leer: ' + (isEmpty ? 'Ja' : 'Nein') + '.' };
        }
        default:
          return { result: 'FEHLER: Unbekanntes Tool "' + name + '".' };
      }
    } catch (e: any) {
      console.log('[Agent] Tool error:', name, e);
      return { result: 'FEHLER bei ' + name + ': ' + (e?.message || 'Unbekannter Fehler') };
    }
  }, [getFileContent, updateFileContent, createFile, deleteFile, renameFile, createDirectory, searchFilesInProject, getProjectTree, listDirectory, getFileInfo, addTodo, updateTodoItem, addMemo, checkAgentToolPermission, agentMd, soulMd, identityMd, userMd, memoryMd, setAgentMd, setSoulMd, setIdentityMd, setUserMd, setMemoryMd]);

  const createPlan = useCallback(async (userRequest: string): Promise<string | null> => {
    setIsPlanning(true);
    try {
      const apiKey = getApiKey();
      if (!apiKey) throw new Error('Kein API-Schlüssel konfiguriert.');

      const plannerPrompt = buildPlannerPrompt({
        projectTree: getProjectTree(),
        memos,
        todos,
      });

      const planMsg: ChatMessage[] = [{
        id: genId(),
        role: 'user',
        content: userRequest,
        timestamp: Date.now(),
      }];

      const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

      const response = await callAI(
        settings.selectedProvider as AIProviderType,
        apiKey,
        settings.selectedModel,
        planMsg,
        [],
        plannerPrompt,
        settings.customEndpoint || undefined,
        fallbackSettings,
      );

      const parsedTasks = parsePlanFromAI(response.content);

      // FIX 1: Thinking-Task automatisch einfügen wenn komplexer Plan (>2 Tasks)
      const hasThinkingTask = parsedTasks.some(t => t.taskType === 'thinking' || t.taskType === 'brainstorm');
      if (!hasThinkingTask && parsedTasks.length > 2) {
        parsedTasks.unshift({
          title: '🧠 Analyse des Auftrags',
          description: 'Verstehe die Anforderungen, analysiere die Projektstruktur und plane die Umsetzung systematisch. Welche Dateien müssen gelesen/erstellt/geändert werden?',
          taskType: 'thinking' as any,
        });
        console.log('[Agent] Auto-inserted thinking task for complex plan');
      }

      const plan: AgentPlan = {
        id: genId(),
        userRequest,
        tasks: parsedTasks.map((t, i) => ({
          id: genId() + '_t' + i,
          title: t.title,
          description: t.description,
          taskType: (t.taskType || 'task') as AgentTaskType,
          status: 'draft' as AgentTaskStatus,
          subAgentMessages: [],
          filesCreated: [],
          filesModified: [],
          filesDeleted: [],
        })),
        status: 'review',
        createdAt: Date.now(),
      };

      setPlans(prev => [...prev, plan]);
      setActivePlanId(plan.id);
      return plan.id;
    } catch (e: any) {
      console.log('[Agent] Planning error:', e);
      return null;
    } finally {
      setIsPlanning(false);
    }
  }, [settings, getApiKey, getFallbackSettings, getProjectTree, memos, todos]);

  const updateTaskDetails = useCallback((planId: string, taskId: string, title: string, description: string) => {
    updateTaskInPlan(planId, taskId, task => ({
      ...task,
      title,
      description,
    }));
  }, [updateTaskInPlan]);

  const addTaskToPlan = useCallback((planId: string, title: string, description: string, taskType: AgentTaskType = 'task') => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const newTask: AgentTask = {
        id: genId(),
        title,
        description,
        taskType,
        status: 'draft',
        subAgentMessages: [],
        filesCreated: [],
        filesModified: [],
        filesDeleted: [],
      };
      return { ...p, tasks: [...p.tasks, newTask] };
    }));
  }, []);

  const removeTaskFromPlan = useCallback((planId: string, taskId: string) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      return { ...p, tasks: p.tasks.filter(t => t.id !== taskId) };
    }));
  }, []);

  const reorderTasksInPlan = useCallback((planId: string, fromIndex: number, toIndex: number) => {
    setPlans(prev => prev.map(p => {
      if (p.id !== planId) return p;
      const newTasks = [...p.tasks];
      if (fromIndex < 0 || fromIndex >= newTasks.length || toIndex < 0 || toIndex >= newTasks.length) return p;
      const [moved] = newTasks.splice(fromIndex, 1);
      newTasks.splice(toIndex, 0, moved);
      return { ...p, tasks: newTasks };
    }));
  }, []);

  const executeSubAgent = useCallback(async (planId: string, task: AgentTask): Promise<void> => {
    if (task.taskType === 'web_search') {
      updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));
      
      const apiKey = getApiKey();
      if (!apiKey) {
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'error', completedAt: Date.now(),
          error: 'Kein API-Schlüssel für Web-Suche verfügbar.',
        }));
        return;
      }

      try {
        const webTools = TOOL_DEFINITIONS.filter(t => ['web_search', 'web_fetch', 'think', 'add_memo'].includes(t.name));
        webTools.push({
          name: 'task_complete',
          description: 'Rufe dieses Tool auf wenn die Web-Recherche abgeschlossen ist.',
          parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Zusammenfassung der Recherche-Ergebnisse' } }, required: ['summary'] },
        });

        const searchPrompt = 'Du bist ein Web-Recherche-Agent. Antworte auf Deutsch.\n'
          + 'Deine Aufgabe: ' + task.title + '\n'
          + 'Details: ' + task.description + '\n\n'
          + 'Nutze web_search um Informationen zu finden und web_fetch um Webseiten zu laden.\n'
          + 'Fasse die Ergebnisse zusammen und rufe task_complete auf wenn du fertig bist.\n'
          + 'Nutze add_memo um wichtige Erkenntnisse zu speichern.';

        let messages: ChatMessage[] = [{
          id: genId(), role: 'user',
          content: 'Recherchiere: ' + task.title + '\n' + task.description,
          timestamp: Date.now(),
        }];

        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        let iterations = 0;
        let taskDone = false;

        while (iterations < 10 && !abortRef.current && !taskDone) {
          iterations++;
          const response = await callAI(
            settings.selectedProvider as AIProviderType, apiKey, settings.selectedModel,
            messages, webTools, searchPrompt,
            settings.customEndpoint || undefined, fallbackSettings,
          );

          if (!response.toolCalls || response.toolCalls.length === 0) {
            messages = [...messages, { id: genId(), role: 'assistant', content: response.content || '', timestamp: Date.now() }];
            taskDone = true;
            break;
          }

          const toolCalls: ToolCall[] = response.toolCalls.map(tc => ({
            id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
          }));

          messages = [...messages, { id: genId(), role: 'assistant', content: response.content || '', toolCalls, timestamp: Date.now() }];

          for (const tc of toolCalls) {
            if (tc.name === 'task_complete') {
              tc.status = 'completed';
              tc.result = 'Recherche abgeschlossen: ' + (tc.arguments?.summary || '');
              taskDone = true;
              messages = [...messages, { id: genId(), role: 'tool', content: tc.result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now() }];
              break;
            }
            const { result } = await executeTool(tc.name, tc.arguments);
            tc.result = result;
            tc.status = result.startsWith('FEHLER') ? 'error' : 'completed';
            messages = [...messages, { id: genId(), role: 'tool', content: result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now() }];
          }

          updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));
        }

        const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: lastAssistant?.content || task.description,
          result: 'Web-Recherche abgeschlossen: ' + task.title,
          subAgentMessages: [...messages],
        }));
      } catch (e: any) {
        console.log('[Agent] Web search task error:', e);
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'error', completedAt: Date.now(),
          error: 'Web-Suche fehlgeschlagen: ' + (e?.message || 'Unbekannter Fehler'),
        }));
      }
      return;
    }

    if (task.taskType === 'thinking' || task.taskType === 'brainstorm') {
      updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));
      
      const apiKey = getApiKey();
      if (!apiKey) {
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: task.description,
          result: task.taskType === 'thinking' ? 'Analyse abgeschlossen: ' + task.title : 'Brainstorming abgeschlossen: ' + task.title,
        }));
        return;
      }

      try {
        const baseThinkPrompt = task.taskType === 'thinking'
          ? `Analysiere folgendes Problem EXTREM GRÜNDLICH und TIEFGEHEND. Nimm dir Zeit für eine detaillierte Analyse.

Thema: ${task.title}

Beschreibung: ${task.description}

Projektstruktur:\n${getProjectTree()}

WICHTIG:
- Analysiere das Problem in mehreren Schichten (Oberflächlich → Tief)
- Betrachte ALLE relevanten Aspekte
- Denke an Edge Cases, Fehlerbehandlung, Performance
- Überlege welche Files betroffen sein könnten
- Plane die Implementierung Schritt-für-Schritt
- Validiere deinen Ansatz kritisch

Gib einen sehr detaillierten Gedankengang zurück.`
          : `Brainstorme über folgendes Thema. Untersuche MULTIPLE Alternativen und Ansätze.

Thema: ${task.title}

Beschreibung: ${task.description}

Projektstruktur:\n${getProjectTree()}

WICHTIG:
- Generiere MINDESTENS 3 verschiedene Lösungsansätze
- Vergleiche Vor- und Nachteile jedes Ansatzes
- Bewerte Komplexität, Wartbarkeit, Performance
- Denke auch an unkonventionelle Lösungen
- Sammle kreative Ideen
- Validiere jede Alternative kritisch

Untersuche alle Optionen gründlich.`;

        const thinkMsgs: ChatMessage[] = [{ id: genId(), role: 'user', content: baseThinkPrompt, timestamp: Date.now() }];
        const readOnlyTools = TOOL_DEFINITIONS.filter(t => ['read_file', 'read_lines', 'list_directory', 'search_files', 'get_project_tree', 'get_file_info', 'think'].includes(t.name));
        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

        const response = await callAI(
          settings.selectedProvider as AIProviderType, apiKey, settings.selectedModel,
          thinkMsgs, readOnlyTools, 'Antworte auf Deutsch. Sei SEHR analytisch, gründlich und tiefgehend. Denke langsam und systematisch. Nutze nur Lese-Tools zur Analyse.',
          settings.customEndpoint || undefined, fallbackSettings,
        );

        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: response.content || task.description,
          result: task.taskType === 'thinking' ? 'Analyse abgeschlossen.' : 'Brainstorming abgeschlossen.',
        }));
      } catch (e: any) {
        updateTaskInPlan(planId, task.id, t => ({
          ...t, status: 'completed', completedAt: Date.now(),
          thinkingContent: task.description,
          result: 'Gedankengang abgeschlossen (offline).',
        }));
      }
      return;
    }

    const apiKey = getApiKey();
    if (!apiKey) throw new Error('Kein API-Schlüssel.');

    updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'running', startedAt: Date.now() }));

    const filteredBaseTools = TOOL_DEFINITIONS.filter(t => {
      if (!settings.yoloMode) {
        if (t.name === 'web_search' && !settings.betaWebSearch) return false;
        if (t.name === 'web_fetch' && !settings.betaWebFetch) return false;
      }
      const learningTools = ['read_identity_files', 'update_soul_md', 'update_agents_md', 'update_identity_md', 'update_user_md', 'update_memory_md'];
      if (learningTools.includes(t.name) && !settings.betaAgentLearning) return false;
      const perm = getToolPermission(t.name);
      if (perm === 'removed') return false;
      return true;
    });

    const subAgentTools = [...filteredBaseTools, {
      name: 'task_complete',
      description: 'Rufe dieses Tool auf wenn die Aufgabe abgeschlossen ist. Gib eine Zusammenfassung an.',
      parameters: { type: 'object', properties: { summary: { type: 'string', description: 'Zusammenfassung was erledigt wurde' } }, required: ['summary'] },
    }, {
      name: 'verify_file',
      description: 'Überprüfe ob eine Datei existiert und korrekt erstellt wurde.',
      parameters: { type: 'object', properties: { path: { type: 'string', description: 'Dateipfad' } }, required: ['path'] },
    }];

    const systemPrompt = buildSystemPrompt({
      persona: settings.persona,
      projectTree: getProjectTree(),
      memos,
      todos,
      mentionedFiles: [],
      yoloMode: settings.yoloMode,
      agentMd: settings.betaAgentLearning ? agentMd : undefined,
      soulMd: settings.betaAgentLearning ? soulMd : undefined,
      identityMd: settings.betaAgentLearning ? identityMd : undefined,
      userMd: settings.betaAgentLearning ? userMd : undefined,
      memoryMd: settings.betaAgentLearning ? memoryMd : undefined,
      betaAgentLearning: settings.betaAgentLearning,
      toolPermissions: settings.yoloMode ? undefined : settings.toolPermissions,
    });

    const taskPrompt = systemPrompt + '\n\n## Aktuelle Unteraufgabe\n'
      + 'Titel: ' + task.title + '\n'
      + 'Beschreibung: ' + task.description + '\n\n'
      + 'WICHTIG: Du bist ein Unteragent. Führe NUR diese spezifische Aufgabe aus.\n'
      + 'Wenn du fertig bist, rufe das Tool "task_complete" auf mit einer Zusammenfassung.\n'
      + 'Lies Dateien IMMER erst bevor du sie bearbeitest.\n'
      + 'Nach dem Erstellen einer Datei, nutze verify_file um sicherzustellen dass sie korrekt angelegt wurde.\n'
      + 'Wenn ein Tool fehlschlägt, versuche es zu korrigieren und erneut auszuführen.\n';

    let messages: ChatMessage[] = [{
      id: genId(),
      role: 'user',
      content: 'Führe folgende Aufgabe aus:\n\nTitel: ' + task.title + '\nBeschreibung: ' + task.description,
      timestamp: Date.now(),
    }];

    const filesCreated: string[] = [];
    const filesModified: string[] = [];
    const filesDeleted: string[] = [];
    let iterations = 0;
    const maxIterations = 20;
    let taskDone = false;

    const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;

    while (iterations < maxIterations && !abortRef.current && !taskDone) {
      iterations++;
      console.log('[Agent] Sub-agent iteration', iterations, 'for task:', task.title);

      try {
        const response = await callAI(
          settings.selectedProvider as AIProviderType,
          apiKey,
          settings.selectedModel,
          messages,
          subAgentTools,
          taskPrompt,
          settings.customEndpoint || undefined,
          fallbackSettings,
        );

        if (!response.toolCalls || response.toolCalls.length === 0) {
          const assistantMsg: ChatMessage = {
            id: genId(), role: 'assistant', content: response.content || '', timestamp: Date.now(),
          };
          messages = [...messages, assistantMsg];
          updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));

          const contentLower = (response.content || '').toLowerCase();
          const looksComplete = contentLower.includes('abgeschlossen') || contentLower.includes('fertig') || contentLower.includes('erledigt') || contentLower.includes('erstellt') || contentLower.includes('geschrieben');
          if (looksComplete || iterations >= 3) {
            taskDone = true;
            break;
          }

          const nudgeMsg: ChatMessage = {
            id: genId(), role: 'user', timestamp: Date.now(),
            content: 'Du hast noch keine Tools aufgerufen. Bitte nutze JETZT die verfügbaren Tools um die Aufgabe auszuführen. '
              + 'Erstelle Dateien mit create_file, lies sie mit read_file, etc. '
              + 'Wenn du fertig bist, rufe task_complete auf. '
              + 'Schreibe Tool-Aufrufe im Format: ```tool\n{"name": "tool_name", "arguments": {...}}\n```',
          };
          messages = [...messages, nudgeMsg];
          continue;
        }

        const toolCalls: ToolCall[] = response.toolCalls.map(tc => ({
          id: tc.id, name: tc.name, arguments: tc.arguments ?? {}, status: 'running' as const,
        }));

        const assistantMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: response.content || '', toolCalls, timestamp: Date.now(),
        };
        messages = [...messages, assistantMsg];

        const toolResultMessages: ChatMessage[] = [];
        for (const tc of toolCalls) {
          if (abortRef.current) break;

          if (tc.name === 'task_complete') {
            tc.status = 'completed';
            tc.result = 'Aufgabe abgeschlossen: ' + (tc.arguments?.summary || '');
            taskDone = true;
            toolResultMessages.push({
              id: genId(), role: 'tool', content: tc.result, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
            });
            break;
          }

          const { result, fileAction } = await executeTool(tc.name, tc.arguments);
          tc.result = result;
          const isError = result.startsWith('FEHLER');
          tc.status = isError ? 'error' : 'completed';

          if (fileAction) {
            if (fileAction.type === 'created' && !filesCreated.includes(fileAction.path)) filesCreated.push(fileAction.path);
            if (fileAction.type === 'modified' && !filesModified.includes(fileAction.path)) filesModified.push(fileAction.path);
            if (fileAction.type === 'deleted' && !filesDeleted.includes(fileAction.path)) filesDeleted.push(fileAction.path);
          }

          let toolContent = result;
          if (isError) {
            toolContent = result + '\n\nHINWEIS: Das Tool ist fehlgeschlagen. Du kannst:\n'
              + '1. Die Datei erst mit read_file oder list_directory prüfen\n'
              + '2. Den Befehl mit korrigierten Parametern erneut versuchen\n'
              + '3. Mit verify_file prüfen ob die Datei existiert\n'
              + 'Fahre innerhalb dieses Schrittes fort, ohne abzubrechen.';
          }

          toolResultMessages.push({
            id: genId(), role: 'tool', content: toolContent, toolCallId: tc.id, toolName: tc.name, timestamp: Date.now(),
          });
        }

        messages = [...messages, ...toolResultMessages];
        updateTaskInPlan(planId, task.id, t => ({
          ...t,
          subAgentMessages: [...messages],
          filesCreated: [...filesCreated],
          filesModified: [...filesModified],
          filesDeleted: [...filesDeleted],
        }));
      } catch (e: any) {
        console.log('[Agent] Sub-agent iteration error:', e);
        const errorMsg: ChatMessage = {
          id: genId(), role: 'assistant', content: 'Fehler: ' + (e?.message || 'Unbekannt'), timestamp: Date.now(),
        };
        messages = [...messages, errorMsg];
        updateTaskInPlan(planId, task.id, t => ({ ...t, subAgentMessages: [...messages] }));
        if (iterations >= 3) break;
      }
    }

    const hasToolErrors = messages.some(m => m.role === 'tool' && m.content?.startsWith('FEHLER'));
    const hasFileOutputs = filesCreated.length > 0 || filesModified.length > 0;
    const finalStatus: AgentTaskStatus = abortRef.current ? 'cancelled'
      : taskDone ? 'completed'
      : iterations >= maxIterations ? (hasFileOutputs ? 'completed' : 'error')
      : 'completed';
    const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');

    let errorDetail: string | undefined;
    if (finalStatus === 'error') {
      errorDetail = 'Maximale Iterationen erreicht.';
      if (hasToolErrors) {
        const failedTools = messages.filter(m => m.role === 'tool' && m.content?.startsWith('FEHLER')).map(m => m.toolName).filter(Boolean);
        errorDetail += ' Fehlgeschlagene Tools: ' + [...new Set(failedTools)].join(', ');
      }
    }

    updateTaskInPlan(planId, task.id, t => ({
      ...t,
      status: finalStatus,
      completedAt: Date.now(),
      result: lastAssistant?.content || 'Aufgabe abgeschlossen.',
      subAgentMessages: [...messages],
      filesCreated: [...filesCreated],
      filesModified: [...filesModified],
      filesDeleted: [...filesDeleted],
      error: errorDetail,
    }));
  }, [settings, getApiKey, getFallbackSettings, getProjectTree, memos, todos, executeTool, updateTaskInPlan]);

  const executePlan = useCallback(async (planId: string) => {
    abortRef.current = false;
    setIsExecuting(true);

    updatePlan(planId, p => ({ ...p, status: 'executing' }));

    const currentPlan = plansRef.current.find(p => p.id === planId);
    if (!currentPlan) {
      setIsExecuting(false);
      return;
    }

    try {
      for (const task of currentPlan.tasks) {
        if (task.status === 'completed' || task.status === 'cancelled') continue;
        updateTaskInPlan(planId, task.id, t => ({ ...t, status: 'pending' }));
      }

      const latestPlan = plansRef.current.find(p => p.id === planId);
      const tasksToRun = latestPlan?.tasks ?? currentPlan.tasks;

      let hadFatalError = false;
      for (const task of tasksToRun) {
        if (abortRef.current || hadFatalError) break;
        if (task.status === 'completed' || task.status === 'cancelled') continue;

        try {
          await executeSubAgent(planId, task);

          const updatedPlan = plansRef.current.find(p => p.id === planId);
          const updatedTask = updatedPlan?.tasks.find(t => t.id === task.id);
          if (updatedTask?.status === 'error') {
            if (settings.autoRetry) {
              console.log('[Agent] Task failed, retrying once:', task.title);
              const retryTask: AgentTask = {
                ...task,
                status: 'pending',
                subAgentMessages: [],
                filesCreated: [],
                filesModified: [],
                filesDeleted: [],
                error: undefined,
                result: undefined,
              };
              try {
                await executeSubAgent(planId, retryTask);
              } catch (retryErr: any) {
                console.log('[Agent] Retry also failed:', retryErr);
              }
            }

            const retryPlan = plansRef.current.find(p => p.id === planId);
            const retryTaskResult = retryPlan?.tasks.find(t => t.id === task.id);
            if (retryTaskResult?.status === 'error') {
              hadFatalError = true;
              for (const remainingTask of tasksToRun) {
                if (remainingTask.status === 'draft' || remainingTask.status === 'pending') {
                  updateTaskInPlan(planId, remainingTask.id, t => ({
                    ...t, status: 'cancelled', error: 'Abgebrochen: Vorheriger Schritt fehlgeschlagen.',
                  }));
                }
              }
            }
          }
        } catch (e: any) {
          console.log('[Agent] Task execution error:', e);
          updateTaskInPlan(planId, task.id, t => ({
            ...t, status: 'error', error: e?.message || 'Unbekannter Fehler', completedAt: Date.now(),
          }));
          hadFatalError = true;
          for (const remainingTask of tasksToRun) {
            if (remainingTask.id !== task.id && (remainingTask.status === 'draft' || remainingTask.status === 'pending')) {
              updateTaskInPlan(planId, remainingTask.id, t => ({
                ...t, status: 'cancelled', error: 'Abgebrochen: Vorheriger Schritt fehlgeschlagen.',
              }));
            }
          }
        }
      }

      await new Promise(resolve => setTimeout(resolve, 100));

      const finishedPlan = plansRef.current.find(p => p.id === planId);
      const pTasks = finishedPlan?.tasks ?? currentPlan.tasks;
      
      const completedCount = pTasks.filter(t => t.status === 'completed').length;
      const errorCount = pTasks.filter(t => t.status === 'error').length;
      const cancelledCount = pTasks.filter(t => t.status === 'cancelled').length;
      const totalTaskCount = pTasks.length;
      const allDone = pTasks.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled');
      const hasRealErrors = errorCount > 0;
      const allSucceeded = completedCount === totalTaskCount;
      
      const allCreated = pTasks.flatMap(t => t.filesCreated || []);
      const allModified = pTasks.flatMap(t => t.filesModified || []);
      const allDeleted = pTasks.flatMap(t => t.filesDeleted || []);

      const toolMap: Record<string, { completed: number; error: number }> = {};
      for (const task of pTasks) {
        for (const msg of (task.subAgentMessages || [])) {
          if (msg.role === 'assistant' && msg.toolCalls) {
            for (const tc of msg.toolCalls) {
              if (!tc || tc.name === 'task_complete') continue;
              if (!toolMap[tc.name]) toolMap[tc.name] = { completed: 0, error: 0 };
              if (tc.status === 'error') toolMap[tc.name].error++;
              else if (tc.status === 'completed') toolMap[tc.name].completed++;
            }
          }
        }
      }
      const totalToolsUsed: AgentToolUsage[] = Object.entries(toolMap).map(([name, counts]) => ({
        name,
        count: counts.completed + counts.error,
        status: counts.error > 0 && counts.completed > 0 ? 'mixed' : counts.error > 0 ? 'error' : 'completed',
      }));

      let finalResponse = '';
      try {
        const apiKey = getApiKey();
        const summaryContext = buildFinalSummaryContext(currentPlan.userRequest, pTasks, allCreated, allModified, allDeleted, hasRealErrors);
        const fallbackSettings = settings.autoFallback ? getFallbackSettings() : undefined;
        const aiResponse = await generateFinalResponse(
          settings.selectedProvider as AIProviderType,
          apiKey,
          settings.selectedModel,
          summaryContext,
          settings.customEndpoint || undefined,
          fallbackSettings,
        );
        finalResponse = aiResponse || '';
      } catch (e: any) {
        console.log('[Agent] AI final response failed, using fallback:', e?.message);
      }

      if (!finalResponse.trim()) {
        if (allSucceeded) {
          finalResponse = 'Alle **' + totalTaskCount + ' Aufgaben** wurden erfolgreich abgeschlossen.';
        } else if (hasRealErrors) {
          finalResponse = completedCount + ' von ' + totalTaskCount + ' Aufgaben abgeschlossen. ' + errorCount + ' Aufgabe(n) sind fehlgeschlagen.';
        } else {
          finalResponse = 'Auftrag beendet. ' + completedCount + '/' + totalTaskCount + ' Aufgaben erledigt.';
        }
        if (allCreated.length > 0) finalResponse += '\n\n**Erstellte Dateien:** ' + [...new Set(allCreated)].join(', ');
        if (allModified.length > 0) finalResponse += '\n\n**Geänderte Dateien:** ' + [...new Set(allModified)].join(', ');
        if (allDeleted.length > 0) finalResponse += '\n\n**Gelöschte Dateien:** ' + [...new Set(allDeleted)].join(', ');
      }

      let summary = '## Zusammenfassung\n\n';
      summary += '**Auftrag:** ' + currentPlan.userRequest + '\n\n';
      summary += '**Tasks:** ' + completedCount + '/' + totalTaskCount + ' abgeschlossen\n';
      if (hasRealErrors) {
        summary += '**Fehlgeschlagen:** ' + errorCount + ' Aufgaben\n';
      }

      const finalStatus = allSucceeded ? 'completed' : (allDone && hasRealErrors) ? 'error' : allDone ? 'completed' : 'error';
      console.log('[Agent] Plan final status:', finalStatus, 'completed:', completedCount, 'errors:', errorCount, 'cancelled:', cancelledCount, 'total:', totalTaskCount);

      updatePlan(planId, p => {
        const latestCompletedCount = p.tasks.filter(t => t.status === 'completed').length;
        const latestErrorCount = p.tasks.filter(t => t.status === 'error').length;
        const latestAllSucceeded = latestCompletedCount === p.tasks.length;
        const latestHasErrors = latestErrorCount > 0;
        const computedStatus = latestAllSucceeded ? 'completed' : latestHasErrors ? 'error' : 'completed';

        return {
          ...p,
          status: computedStatus as AgentPlan['status'],
          summary,
          finalResponse,
          totalToolsUsed,
          completedAt: Date.now(),
        };
      });

      // FIX 3B: User-Info Extraction nach Job-Abschluss (wenn Lernmodus aktiv)
      if (settings.betaAgentLearning) {
        const allMessages = pTasks.flatMap(t => t.subAgentMessages || []);
        await extractUserInfoIfEnabled(allMessages);
      }
    } catch (e: any) {
      console.log('[Agent] Plan execution error:', e);
      updatePlan(planId, p => ({ ...p, status: 'error' }));
    } finally {
      setIsExecuting(false);
    }
  }, [updatePlan, updateTaskInPlan, executeSubAgent]);

  const stopExecution = useCallback(() => {
    abortRef.current = true;
    setIsExecuting(false);
  }, []);

  const dismissPlan = useCallback((planId: string) => {
    updatePlan(planId, p => ({ ...p, dismissed: true }));
    if (activePlanId === planId) setActivePlanId(null);
  }, [activePlanId, updatePlan]);

  const retryTask = useCallback(async (planId: string, taskId: string) => {
    const plan = plansRef.current.find(p => p.id === planId);
    const task = plan?.tasks.find(t => t.id === taskId);
    if (!plan || !task) return;

    setIsExecuting(true);
    updatePlan(planId, p => ({ ...p, status: 'executing' }));

    const cleanTask: AgentTask = {
      ...task,
      status: 'pending',
      taskType: task.taskType || 'task',
      subAgentMessages: [],
      filesCreated: [],
      filesModified: [],
      filesDeleted: [],
      error: undefined,
      result: undefined,
      thinkingContent: undefined,
      completedAt: undefined,
    };

    try {
      await executeSubAgent(planId, cleanTask);
    } catch (e: any) {
      updateTaskInPlan(planId, taskId, t => ({ ...t, status: 'error', error: e?.message || 'Fehler' }));
    } finally {
      setIsExecuting(false);
      const updatedPlan = plansRef.current.find(p => p.id === planId);
      if (updatedPlan) {
        const allDone = updatedPlan.tasks.every(t => t.status === 'completed' || t.status === 'error' || t.status === 'cancelled');
        const hasErrors = updatedPlan.tasks.some(t => t.status === 'error');
        if (allDone) {
          updatePlan(planId, p => ({ ...p, status: hasErrors ? 'error' : 'completed', completedAt: Date.now() }));
        }
      }
    }
  }, [updatePlan, updateTaskInPlan, executeSubAgent]);

  // FIX 3: User-Info Auto-Extraction im Lernmodus
  const extractUserInfoIfEnabled = useCallback(async (messages: ChatMessage[]) => {
    if (!settings.betaAgentLearning) return;
    
    const lastUserMessages = messages
      .filter(m => m.role === 'user')
      .slice(-5);
    
    const userContent = lastUserMessages.map(m => m.content).join('\n');
    if (!userContent.trim()) return;
    
    // Prüfe auf persönliche Informationen (Name, Rolle, etc.)
    const nameMatch = userContent.match(/\bich (?:heiße|bin)\s+(?:der |die )?([A-Z][a-zäöüß]+)/i);
    const roleMatch = userContent.match(/\b(?:ich bin|als|beruf(?:lich)?|entwickler|programmierer)\s+([^.,\n!]+)/i);
    const companyMatch = userContent.match(/\b(?:arbeite bei|firma|unternehmen|in\s+firma)\s+([A-Z][a-zA-Zäöüß\s]+)/i);
    
    let userInfoUpdated = false;
    let newUserInfo = userMd || '';
    
    if (nameMatch && !newUserInfo.toLowerCase().includes('name')) {
      newUserInfo += '\n\n## Name\nDer Nutzer heißt **' + nameMatch[1] + '**.';
      userInfoUpdated = true;
      console.log('[Agent] Extracted name:', nameMatch[1]);
    }
    
    if (roleMatch && !newUserInfo.toLowerCase().includes('rolle') && !newUserInfo.toLowerCase().includes('beruf')) {
      const roleText = roleMatch[0].trim();
      newUserInfo += '\n\n## Rolle\n' + roleText.charAt(0).toUpperCase() + roleText.slice(1) + '.';
      userInfoUpdated = true;
      console.log('[Agent] Extracted role:', roleText);
    }
    
    if (companyMatch && !newUserInfo.toLowerCase().includes('firma') && !newUserInfo.toLowerCase().includes('unternehmen')) {
      newUserInfo += '\n\n## Firma\nNutzer arbeitet bei **' + companyMatch[1].trim() + '**.';
      userInfoUpdated = true;
      console.log('[Agent] Extracted company:', companyMatch[1]);
    }
    
    if (userInfoUpdated && newUserInfo.trim()) {
      setUserMd(newUserInfo);
      addMemo('User-Info aktualisiert: ' + (nameMatch ? 'Name=' + nameMatch[1] : '') + (roleMatch ? ', Rolle=' + roleMatch[0].slice(0, 30) : ''));
      console.log('[Agent] USER.MD updated successfully');
    }
  }, [settings.betaAgentLearning, userMd, setUserMd, addMemo]);

  const visiblePlans = plans.filter(p => !p.dismissed);

  return {
    plans: visiblePlans, activePlan, activePlanId, isPlanning, isExecuting,
    createPlan, executePlan, stopExecution, dismissPlan,
    updateTaskDetails, addTaskToPlan, removeTaskFromPlan, reorderTasksInPlan, retryTask,
    setActivePlanId,
    pendingToolApproval, approveAgentTool,
  };
});
