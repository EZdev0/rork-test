import { ChatMessage, ToolDefinition, AIProviderType, MemoEntry, TodoItem, AI_PROVIDERS } from '@/types';

export function buildPlannerPrompt(options: {
  projectTree: string;
  memos: MemoEntry[];
  todos: TodoItem[];
}): string {
  let prompt = 'You are the main agent (Planner) of a mobile IDE called "Studio IDE".\n';
  prompt += 'Your task is to break down the user request into distinct, clearly defined steps.\n';
  prompt += '\n';
  prompt += '## WICHTIGER HINWEIS\n';
  prompt += '- Sub-agents ALREADY EXIST and do NOT need to be created anew!\n';
  prompt += '- If the user says "test sub-agents", you should use the EXISTING sub-agents.\n';
  prompt += '- Do NOT create new agent architectures, folders, or structures.\n';
  prompt += '- Use the existing sub-agents for sub-tasks (Analyst, Developer, Tester).\n\n';
  prompt += '## Regeln\n';
  prompt += '- ALWAYS reply in English.\n';
  prompt += '- Return the steps as a list with the appropriate type prefix.\n';
  prompt += '- IMPORTANT: The FIRST step must ALWAYS be a THINK step, where you analyze the request.\n';
  prompt += '- You can insert as many THINK steps (thoughts/analysis) and BRAINSTORM steps as you like.\n';
  prompt += '- THINK steps: Analyze the problem, consider which tools are needed, check if the approach works.\n';
  prompt += '- BRAINSTORM steps: Investigate ALTERNATIVES, gather AT LEAST 3 ideas, validate the plan critically.\n';
  prompt += '- TASK steps: Concrete tasks that a sub-agent should perform.\n';
  prompt += '- WEB_SEARCH steps: Web research for information, documentation, or current data.\n';
  prompt += '- Keep tasks atomic and clearly delineated.\n';
  prompt += '- Maximum of 25 steps per plan (including any number of THINK/BRAINSTORM).\n';
  prompt += '- For very complex requests (>15 Tasks), automatically schedule more THINK/BRAINSTORM steps.\n';
  prompt += '- The steps should be in the correct order.\n';
  prompt += '- Describe exactly which files are affected and which tools are needed.\n';
  prompt += '- IMPORTANT: Write COMPLETE sentences. No incomplete sentences!\n';
  prompt += '- If a task depends on another, mention it.\n';
  prompt += '- Mention in THINK steps which tools (read_file, write_file, etc.) should be used.\n\n';
  prompt += '## BRAINSTORMING RULES\n';
  prompt += '- Brainstorming must be THOROUGH, not superficial!\n';
  prompt += '- Generate AT LEAST 3 different solution approaches.\n';
  prompt += '- Compare pros and cons of each approach.\n';
  prompt += '- Evaluate complexity, maintainability, performance.\n';
  prompt += '- Also think of unconventional solutions.\n';
  prompt += '- Brainstorming is only complete when ALL options have been reviewed.\n\n';

  prompt += '## Project Structure\n```\n' + (options.projectTree || '(Empty Project)') + '\n```\n';

  if (options.memos.length > 0) {
    prompt += '\n## Project Memos\n';
    options.memos.forEach(m => { prompt += '- ' + m.content + '\n'; });
  }

  if (options.todos.length > 0) {
    prompt += '\n## Current Todos\n';
    options.todos.forEach(t => {
      prompt += '- [' + (t.completed ? 'x' : ' ') + '] ' + t.text + '\n';
    });
  }

  prompt += '\n## Response Format\nReturn ONLY the step list, no further explanations.\n';
  prompt += 'Use these formats per line:\n';
  prompt += '- THINK: Title | Detailed thought process and analysis\n';
  prompt += '- BRAINSTORM: Title | What exactly needs to be investigated or checked\n';
  prompt += '- TASK: Title | Complete description of the concrete task\n';
  prompt += '- WEB_SEARCH: Title | What exactly to search for on the web and how many queries\n';
  prompt += '\nExample:\n';
  prompt += 'THINK: Analyze request | I need to understand what the user wants. I will analyze the project structure using read_file and get_project_tree.\n';
  prompt += 'BRAINSTORM: Check architecture | Which files need to be created or changed? Are there dependencies?\n';
  prompt += 'TASK: Create main file | Create the file src/main.kt with the basic app structure.\n';
  prompt += 'WEB_SEARCH: Research documentation | Perform 2 search queries on Kotlin Compose Patterns and best practices.\n';

  return prompt;
}

export function parsePlanFromAI(content: string): { title: string; description: string; taskType: 'task' | 'thinking' | 'brainstorm' | 'web_search' }[] {
  const tasks: { title: string; description: string; taskType: 'task' | 'thinking' | 'brainstorm' | 'web_search' }[] = [];
  if (!content) return tasks;
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const thinkMatch = trimmed.match(/^(?:\d+\.?\s*)?THINK:\s*(.+?)\s*\|\s*(.+)$/i);
    if (thinkMatch) {
      tasks.push({ title: thinkMatch[1].trim(), description: thinkMatch[2].trim(), taskType: 'thinking' });
      continue;
    }

    const brainstormMatch = trimmed.match(/^(?:\d+\.?\s*)?BRAINSTORM:\s*(.+?)\s*\|\s*(.+)$/i);
    if (brainstormMatch) {
      tasks.push({ title: brainstormMatch[1].trim(), description: brainstormMatch[2].trim(), taskType: 'brainstorm' });
      continue;
    }

    const webSearchMatch = trimmed.match(/^(?:\d+\.?\s*)?WEB_SEARCH:\s*(.+?)\s*\|\s*(.+)$/i);
    if (webSearchMatch) {
      tasks.push({ title: webSearchMatch[1].trim(), description: webSearchMatch[2].trim(), taskType: 'web_search' });
      continue;
    }

    const taskMatch = trimmed.match(/^(?:\d+\.?\s*)?TASK:\s*(.+?)\s*\|\s*(.+)$/i);
    if (taskMatch) {
      tasks.push({ title: taskMatch[1].trim(), description: taskMatch[2].trim(), taskType: 'task' });
      continue;
    }

    const numberedMatch = trimmed.match(/^\d+\.\s+\*?\*?(.+?)\*?\*?\s*[-–:]\s*(.+)$/);
    if (numberedMatch && !trimmed.startsWith('```')) {
      tasks.push({ title: numberedMatch[1].trim().replace(/\*+/g, ''), description: numberedMatch[2].trim(), taskType: 'task' });
    }
  }

  if (tasks.length === 0) {
    const fallbackLines = lines.filter(l => l.trim().length > 5 && !l.trim().startsWith('#') && !l.trim().startsWith('```'));
    for (const fl of fallbackLines.slice(0, 5)) {
      tasks.push({ title: fl.trim().slice(0, 80), description: fl.trim(), taskType: 'task' });
    }
  }

  if (tasks.length > 0 && tasks[0].taskType !== 'thinking') {
    tasks.unshift({ title: 'Anfrage analysieren', description: 'Analysiere die Anfrage des Users und plane die nächsten Schritte.', taskType: 'thinking' });
  }

  // Limit auf 25 Tasks, aber mit Warnung wenn mehr vorhanden
  if (tasks.length > 25) {
    console.log('[Planner] Plan exceeds 25 tasks, truncating from', tasks.length, 'to 25');
  }
  
  return tasks.slice(0, 25);
}

export const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'read_file',
    description: 'Liest den kompletten Inhalt einer Datei. MUSS vor jeder Bearbeitung aufgerufen werden.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Dateipfad relativ zum Projektstamm' } }, required: ['path'] },
  },
  {
    name: 'read_lines',
    description: 'Liest bestimmte Zeilen einer Datei.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, start_line: { type: 'number', description: 'Startzeile (1-basiert)' }, end_line: { type: 'number', description: 'Endzeile (1-basiert)' } }, required: ['path', 'start_line', 'end_line'] },
  },
  {
    name: 'write_file',
    description: 'Schreibt Inhalt in eine Datei (überschreibt komplett). Datei muss vorher mit read_file gelesen werden.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Neuer Dateiinhalt' } }, required: ['path', 'content'] },
  },
  {
    name: 'create_file',
    description: 'Erstellt eine neue Datei. Fehlende Ordner werden automatisch erstellt.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string', description: 'Dateiinhalt' } }, required: ['path', 'content'] },
  },
  {
    name: 'edit_file',
    description: 'Bearbeitet eine Datei durch Ersetzen von Text. Datei MUSS vorher mit read_file gelesen werden. old_text muss exakt übereinstimmen.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, old_text: { type: 'string', description: 'Exakter Text der ersetzt werden soll' }, new_text: { type: 'string', description: 'Neuer Text' } }, required: ['path', 'old_text', 'new_text'] },
  },
  {
    name: 'delete_file',
    description: 'Löscht eine Datei oder einen leeren Ordner.',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'rename_file',
    description: 'Benennt eine Datei oder einen Ordner um.',
    parameters: { type: 'object', properties: { old_path: { type: 'string' }, new_path: { type: 'string' } }, required: ['old_path', 'new_path'] },
  },
  {
    name: 'list_directory',
    description: 'Listet alle Dateien und Ordner in einem Verzeichnis auf.',
    parameters: { type: 'object', properties: { path: { type: 'string', description: 'Pfad (leer für Wurzelverzeichnis)' } }, required: ['path'] },
  },
  {
    name: 'search_files',
    description: 'Durchsucht alle Dateien nach einem Text (grep-ähnlich). Gibt Dateiname, Zeile und Kontext zurück. Unterstützt reguläre Ausdrücke.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Suchbegriff oder regulärer Ausdruck' }, path: { type: 'string', description: 'Optionaler Pfad zum Einschränken der Suche' } }, required: ['query'] },
  },
  {
    name: 'find_replace',
    description: 'Sucht und ersetzt Text in einer Datei.',
    parameters: { type: 'object', properties: { path: { type: 'string' }, find: { type: 'string' }, replace: { type: 'string' }, all: { type: 'boolean', description: 'Alle Vorkommen ersetzen (Standard: false)' } }, required: ['path', 'find', 'replace'] },
  },
  {
    name: 'create_directory',
    description: 'Erstellt einen neuen Ordner (einschließlich Unterordner).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'get_project_tree',
    description: 'Gibt die gesamte Projektstruktur als Baumdarstellung zurück.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_file_info',
    description: 'Gibt Informationen über eine Datei zurück (Zeilenanzahl, Zeichenanzahl, Sprache).',
    parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] },
  },
  {
    name: 'create_todo',
    description: 'Erstellt einen neuen Todo-Eintrag im Projektplan.',
    parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
  },
  {
    name: 'update_todo',
    description: 'Aktualisiert einen Todo-Eintrag (Status oder Text).',
    parameters: { type: 'object', properties: { id: { type: 'string' }, completed: { type: 'boolean' }, text: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'add_memo',
    description: 'Speichert eine wichtige Erkenntnis oder Notiz im Projektgedächtnis. Nutze dies für Dinge die du dir merken solltest.',
    parameters: { type: 'object', properties: { content: { type: 'string' } }, required: ['content'] },
  },
  {
    name: 'think',
    description: 'Nutze dieses Tool um über ein komplexes Problem nachzudenken. Dein Gedankengang wird dem Benutzer als einklappbarer Block angezeigt. Nutze dies bei schwierigen Aufgaben.',
    parameters: { type: 'object', properties: { thought: { type: 'string', description: 'Dein detaillierter Gedankengang' } }, required: ['thought'] },
  },
  {
    name: 'web_search',
    description: 'Durchsucht das Web nach Informationen. Nutze dies für Recherche, aktuelle Informationen oder Dokumentation.',
    parameters: { type: 'object', properties: { query: { type: 'string', description: 'Suchbegriff' } }, required: ['query'] },
  },
  {
    name: 'web_fetch',
    description: 'Lädt den Inhalt einer Webseite herunter und gibt den Text zurück (ohne HTML-Tags).',
    parameters: { type: 'object', properties: { url: { type: 'string', description: 'URL der Webseite' }, max_length: { type: 'number', description: 'Maximale Zeichenanzahl (Standard: 5000)' } }, required: ['url'] },
  },
  {
    name: 'read_identity_files',
    description: 'Liest alle Identitätsdateien (SOUL.md, AGENTS.md, IDENTITY.md, USER.md, MEMORY.md) und gibt deren Inhalt zurück.',
    parameters: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'update_soul_md',
    description: 'Aktualisiert SOUL.md — die Persönlichkeit, Werte und Verhaltensphilosophie des Agenten. Nutze dies um deine Persönlichkeit zu verfeinern.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Neuer vollständiger Inhalt für SOUL.md' } }, required: ['content'] },
  },
  {
    name: 'update_agents_md',
    description: 'Aktualisiert AGENTS.md — Verhaltensregeln, Reasoning-Protokoll und Tool-Nutzungs-Richtlinien. Nutze dies um Arbeitsweise zu optimieren.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Neuer vollständiger Inhalt für AGENTS.md' } }, required: ['content'] },
  },
  {
    name: 'update_identity_md',
    description: 'Aktualisiert IDENTITY.md — Name, Rolle und Präsentation des Agenten nach außen.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Neuer vollständiger Inhalt für IDENTITY.md' } }, required: ['content'] },
  },
  {
    name: 'update_user_md',
    description: 'Aktualisiert USER.md — Profil des Nutzers, Präferenzen, Kommunikationsstil und bekannte Projekte. Nutze dies um den Nutzer besser zu verstehen.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Neuer vollständiger Inhalt für USER.md' } }, required: ['content'] },
  },
  {
    name: 'update_memory_md',
    description: 'Aktualisiert MEMORY.md — Langzeit-Gedächtnis mit Entscheidungen, gelernten Präferenzen und vergangenen Fehlern. Session-übergreifend persistent.',
    parameters: { type: 'object', properties: { content: { type: 'string', description: 'Neuer vollständiger Inhalt für MEMORY.md' } }, required: ['content'] },
  },
];

export function buildSystemPrompt(options: {
  persona: string;
  projectTree: string;
  memos: MemoEntry[];
  todos: TodoItem[];
  mentionedFiles: { path: string; content: string }[];
  yoloMode: boolean;
  agentMd?: string;
  soulMd?: string;
  identityMd?: string;
  userMd?: string;
  memoryMd?: string;
  betaAgentLearning?: boolean;
  toolPermissions?: Record<string, string>;
}): string {
  const personaPrompts: Record<string, string> = {
    standard: 'You are an experienced and helpful AI coding assistant in a mobile IDE called "Studio IDE".',
    android: 'You are a Senior Android Developer Assistant, specialized in Kotlin, Java, Jetpack Compose, Android SDK, and Gradle. You know best practices for Android development.',
    web: 'You are a Senior Web Developer Assistant, specialized in TypeScript, React, Next.js, HTML, CSS, Node.js, and modern web technologies.',
    python: 'You are a Senior Python Developer Assistant, specialized in Python, Django, Flask, FastAPI, Data Science, and Machine Learning.',
    fullstack: 'You are an experienced Fullstack Developer Assistant with expertise in frontend, backend, databases, DevOps, and cloud architectures.',
  };

  let prompt = personaPrompts[options.persona] || personaPrompts.standard;

  prompt += '\n\n## Kernregeln\n';
  prompt += '- Antworte IMMER auf Deutsch.\n';
  prompt += '- Du hast Zugriff auf die unten definierten Tools. Nutze NUR diese Tools.\n';
  prompt += '- WICHTIG: Du MUSST eine Datei IMMER erst mit read_file lesen, BEVOR du sie mit write_file oder edit_file bearbeitest.\n';
  prompt += '- Wenn edit_file fehlschlägt (Text nicht gefunden), lies die Datei erneut mit read_file.\n';
  prompt += '- Erfinde KEINE Tools die nicht existieren. Du hast genau die definierten Tools.\n';
  prompt += '- HANDLE SOFORT. Frage NICHT ob du etwas tun sollst. Nutze Tools DIREKT.\n';
  prompt += '- Für komplexe Aufgaben: Nutze "think" Tool zum Nachdenken, dann handle sofort.\n';
  prompt += '- Nutze add_memo für wichtige Erkenntnisse über das Projekt.\n';
  prompt += '- Formatiere Antworten mit Markdown: **fett**, `code`, Listen etc.\n';
  prompt += '- Use web_search and web_fetch for current information or documentation (if beta tools are enabled).\n';
  prompt += '- If you need to change multiple files, use "think" first to create a plan, then execute EVERYTHING immediately.\n';
  prompt += '- Be efficient: Explain briefly what you are doing, but act above all.\n';
  prompt += '- For complex tasks: ALWAYS use the "think" tool FIRST to analyze the approach.\n';
  prompt += '- Mention in your thought process which tools you will use (e.g., "I need to work with read_file").\n';
  prompt += '- At the end of each response: Briefly summarize which tools were used.\n';
  prompt += '- ALWAYS write complete sentences. No incomplete sentences!\n';

  if (options.betaAgentLearning) {
    prompt += '\n## Learning Capability (Active)\n';
    prompt += 'You have access to 5 persistent identity files. These files survive sessions and define who you are and what you know about the user.\n';
    prompt += 'Du SOLLST diese Dateien aktiv aktualisieren wenn du neue Erkenntnisse gewinnst.\n\n';
    prompt += '### Identitätsdateien\n';
    prompt += '- **SOUL.md** — Deine Persönlichkeit, Werte und Verhaltensphilosophie. Aktualisiere mit `update_soul_md`.\n';
    prompt += '- **AGENTS.md** — Deine Verhaltensregeln, Reasoning-Protokoll und Tool-Nutzung. Aktualisiere mit `update_agents_md`.\n';
    prompt += '- **IDENTITY.md** — Dein Name, Rolle und Präsentation nach außen. Aktualisiere mit `update_identity_md`.\n';
    prompt += '- **USER.md** — Profil des Nutzers: Präferenzen, Stil, Kontext, Projekte. Aktualisiere mit `update_user_md`.\n';
    prompt += '- **MEMORY.md** — Langzeit-Gedächtnis: Entscheidungen, Fehler, gelernte Muster. Aktualisiere mit `update_memory_md`.\n\n';
    prompt += '### Lern-Regeln\n';
    prompt += '- Lies zu Beginn einer Session mit `read_identity_files` den aktuellen Stand.\n';
    prompt += '- Aktualisiere USER.md wenn du neue Nutzer-Präferenzen entdeckst.\n';
    prompt += '- Aktualisiere MEMORY.md am Ende wichtiger Aufgaben mit Zusammenfassung.\n';
    prompt += '- Aktualisiere AGENTS.md wenn du neue effektive Arbeitsweisen findest.\n';
    prompt += '- Aktualisiere SOUL.md nur wenn sich grundlegende Werte/Stil ändern sollen.\n';
    prompt += '- LÖSCHE NIEMALS diese Dateien. Du darfst sie nur aktualisieren.\n';
    prompt += '- Schreibe immer den VOLLSTÄNDIGEN neuen Inhalt, nicht nur Änderungen.\n';
  }

  if (options.soulMd && options.soulMd.trim()) {
    prompt += '\n## SOUL.md — Persönlichkeit\n';
    prompt += options.soulMd + '\n';
  }

  if (options.agentMd && options.agentMd.trim()) {
    prompt += '\n## AGENTS.md — Verhaltensregeln\n';
    prompt += options.agentMd + '\n';
  }

  if (options.identityMd && options.identityMd.trim()) {
    prompt += '\n## IDENTITY.md — Identität\n';
    prompt += options.identityMd + '\n';
  }

  if (options.userMd && options.userMd.trim()) {
    prompt += '\n## USER.md — Nutzer-Profil\n';
    prompt += options.userMd + '\n';
  }

  if (options.memoryMd && options.memoryMd.trim()) {
    prompt += '\n## MEMORY.md — Langzeit-Gedächtnis\n';
    prompt += options.memoryMd + '\n';
  }

  if (options.toolPermissions) {
    const blocked = Object.entries(options.toolPermissions).filter(([_, v]) => v === 'blocked').map(([k]) => k);
    const removed = Object.entries(options.toolPermissions).filter(([_, v]) => v === 'removed').map(([k]) => k);
    if (blocked.length > 0) {
      prompt += '\n## Blockierte Tools\n';
      prompt += 'Folgende Tools sind vom Nutzer blockiert. Informiere den Nutzer wenn du sie brauchst:\n';
      blocked.forEach(t => { prompt += '- ' + t + ' (blockiert - bitte Nutzer um Freigabe)\n'; });
    }
    if (removed.length > 0) {
      prompt += '\n(Hinweis: Einige Tools sind nicht verfügbar.)\n';
    }
  }

  if (!options.yoloMode) {
    prompt += '\n## Bestätigungsmodus\n';
    prompt += '- Für destruktive Aktionen (Löschen, komplettes Überschreiben): Frage kurz nach.\n';
    prompt += '- Für Erstellen und Bearbeiten: Handle DIREKT ohne nachzufragen.\n';
  } else {
    prompt += '\n## YOLO-Modus aktiv\n';
    prompt += '- Du darfst Dateien ohne Nachfragen erstellen, bearbeiten und löschen.\n';
    prompt += '- Handle schnell und effizient, aber informiere den Benutzer über Änderungen.\n';
  }

  prompt += '\n## Projektstruktur\n```\n' + (options.projectTree || '(Leeres Projekt)') + '\n```\n';

  if (options.memos.length > 0) {
    prompt += '\n## Projekt-Memos\n';
    options.memos.forEach(m => { prompt += '- ' + m.content + '\n'; });
  }

  if (options.todos.length > 0) {
    prompt += '\n## Aktuelle Todos\n';
    options.todos.forEach(t => {
      prompt += '- [' + (t.completed ? 'x' : ' ') + '] (ID: ' + t.id + ') ' + t.text + '\n';
    });
  }

  if (options.mentionedFiles.length > 0) {
    prompt += '\n## Referenzierte Dateien\n';
    options.mentionedFiles.forEach(f => {
      prompt += '\n### ' + f.path + '\n```\n' + f.content + '\n```\n';
    });
  }

  return prompt;
}

function formatMessagesForOpenAI(messages: ChatMessage[], systemPrompt: string) {
  const formatted: any[] = [{ role: 'system', content: systemPrompt }];

  for (const msg of messages) {
    if (msg.role === 'tool') {
      formatted.push({
        role: 'tool',
        tool_call_id: msg.toolCallId || '',
        content: msg.content || '',
      });
    } else if (msg.role === 'assistant' && msg.toolCalls && msg.toolCalls.length > 0) {
      formatted.push({
        role: 'assistant',
        content: msg.content || null,
        tool_calls: msg.toolCalls.map(tc => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: JSON.stringify(tc.arguments || {}) },
        })),
      });
    } else {
      formatted.push({ role: msg.role, content: msg.content || '' });
    }
  }

  return formatted;
}

function formatMessagesForAnthropic(messages: ChatMessage[]) {
  const formatted: any[] = [];
  let i = 0;

  while (i < messages.length) {
    const msg = messages[i];

    if (msg.role === 'user') {
      formatted.push({ role: 'user', content: [{ type: 'text', text: msg.content || '' }] });
      i++;
    } else if (msg.role === 'assistant') {
      const content: any[] = [];
      if (msg.content) content.push({ type: 'text', text: msg.content });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.arguments || {} });
        }
      }
      if (content.length === 0) content.push({ type: 'text', text: '' });
      formatted.push({ role: 'assistant', content });
      i++;

      const toolResults: any[] = [];
      while (i < messages.length && messages[i].role === 'tool') {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: messages[i].toolCallId || '',
          content: messages[i].content || '',
        });
        i++;
      }
      if (toolResults.length > 0) {
        formatted.push({ role: 'user', content: toolResults });
      }
    } else if (msg.role === 'tool') {
      formatted.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: msg.toolCallId || '', content: msg.content || '' }],
      });
      i++;
    } else {
      i++;
    }
  }

  return formatted;
}

function formatMessagesForGemini(messages: ChatMessage[]) {
  const contents: any[] = [];

  for (const msg of messages) {
    if (msg.role === 'user') {
      contents.push({ role: 'user', parts: [{ text: msg.content || '' }] });
    } else if (msg.role === 'assistant') {
      const parts: any[] = [];
      if (msg.content) parts.push({ text: msg.content });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push({ functionCall: { name: tc.name, args: tc.arguments || {} } });
        }
      }
      if (parts.length === 0) parts.push({ text: '' });
      contents.push({ role: 'model', parts });
    } else if (msg.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: msg.toolName || 'unknown', response: { result: msg.content || '' } } }],
      });
    }
  }

  return contents;
}

async function callOpenAI(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal, endpoint?: string) {
  let url = 'https://api.openai.com/v1/chat/completions';
  if (endpoint) {
    let cleanEndpoint = endpoint.trim();
    if (!cleanEndpoint.startsWith('http://') && !cleanEndpoint.startsWith('https://')) {
      cleanEndpoint = 'https://' + cleanEndpoint;
    }
    if (cleanEndpoint.endsWith('/v1/chat/completions')) {
      url = cleanEndpoint;
    } else {
      url = cleanEndpoint.replace(/\/$/, '') + '/v1/chat/completions';
    }
  }
  const formattedMessages = formatMessagesForOpenAI(messages, systemPrompt);

  const body: any = {
    model,
    messages: formattedMessages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  console.log('[AI] Calling OpenAI-compatible:', model, 'endpoint:', endpoint || 'openai', 'messages:', formattedMessages.length);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['Authorization'] = 'Bearer ' + apiKey;
  }
  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unbekannter Fehler');
    console.log('[AI] OpenAI-compatible error:', response.status, errorText);
    throw new AIError(response.status, 'Fehler (' + response.status + '): ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('Keine Antwort erhalten.');

  return {
    content: choice.message?.content || '',
    toolCalls: (choice.message?.tool_calls || []).map((tc: any) => ({
      id: tc.id || 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: tc.function?.name || '',
      arguments: safeParseJSON(tc.function?.arguments || '{}'),
    })),
  };
}

async function callOpenRouter(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const url = 'https://openrouter.ai/api/v1/chat/completions';
  const formattedMessages = formatMessagesForOpenAI(messages, systemPrompt);

  const body: any = {
    model,
    messages: formattedMessages,
    temperature: 0.7,
    max_tokens: 4096,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    }));
  }

  console.log('[AI] Calling OpenRouter:', model, 'messages:', formattedMessages.length);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://studio-ide.app',
      'X-Title': 'Studio Mobile IDE',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unbekannter Fehler');
    console.log('[AI] OpenRouter error:', response.status, errorText);
    throw new AIError(response.status, 'OpenRouter Fehler (' + response.status + '): ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  const choice = data.choices?.[0];

  if (!choice) throw new Error('Keine Antwort von OpenRouter erhalten.');

  return {
    content: choice.message?.content || '',
    toolCalls: (choice.message?.tool_calls || []).map((tc: any) => ({
      id: tc.id || 'tc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      name: tc.function?.name || '',
      arguments: safeParseJSON(tc.function?.arguments || '{}'),
    })),
  };
}

async function callAnthropic(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const formattedMessages = formatMessagesForAnthropic(messages);

  const body: any = {
    model,
    max_tokens: 4096,
    system: systemPrompt,
    messages: formattedMessages,
  };

  if (tools.length > 0) {
    body.tools = tools.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  console.log('[AI] Calling Anthropic:', model, 'messages:', formattedMessages.length);

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unbekannter Fehler');
    console.log('[AI] Anthropic error:', response.status, errorText);
    throw new AIError(response.status, 'Anthropic Fehler (' + response.status + '): ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  let content = '';
  const toolCalls: any[] = [];

  for (const block of data.content || []) {
    if (block.type === 'text') {
      content += block.text;
    } else if (block.type === 'tool_use') {
      toolCalls.push({
        id: block.id || 'tc_' + Date.now(),
        name: block.name,
        arguments: block.input || {},
      });
    }
  }

  return { content, toolCalls };
}

async function callGemini(apiKey: string, model: string, messages: ChatMessage[], tools: ToolDefinition[], systemPrompt: string, signal: AbortSignal) {
  const contents = formatMessagesForGemini(messages);

  const body: any = {
    contents,
    systemInstruction: { parts: [{ text: systemPrompt }] },
    generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
  };

  if (tools.length > 0) {
    body.tools = [{
      functionDeclarations: tools.map(t => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    }];
  }

  const url = 'https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + apiKey;

  console.log('[AI] Calling Gemini:', model, 'contents:', contents.length);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unbekannter Fehler');
    console.log('[AI] Gemini error:', response.status, errorText);
    throw new AIError(response.status, 'Gemini Fehler (' + response.status + '): ' + errorText.slice(0, 300));
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  let content = '';
  const toolCalls: any[] = [];

  for (const part of parts) {
    if (part.text) {
      content += part.text;
    } else if (part.functionCall) {
      toolCalls.push({
        id: 'gem_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      });
    }
  }

  return { content, toolCalls };
}

function safeParseJSON(str: string): Record<string, any> {
  try {
    return JSON.parse(str);
  } catch {
    console.log('[AI] Failed to parse JSON:', str.slice(0, 100));
    return {};
  }
}

class AIError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'AIError';
  }
}

function isRateLimitError(error: any): boolean {
  if (error instanceof AIError && error.status === 429) return true;
  if (error?.message?.includes('429')) return true;
  if (error?.message?.toLowerCase()?.includes('rate') && error?.message?.toLowerCase()?.includes('limit')) return true;
  return false;
}

function isAuthError(error: any): boolean {
  if (error instanceof AIError && (error.status === 401 || error.status === 403)) return true;
  if (error?.message?.includes('401') || error?.message?.includes('Unauthorized')) return true;
  return false;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getProviderForFallback(currentProvider: AIProviderType, settings: Record<string, string>): { provider: AIProviderType; key: string; model: string } | null {
  if (currentProvider !== 'rork') {
    return { provider: 'rork', key: 'rork_builtin', model: 'rork-default' };
  }

  const fallbackOrder: { provider: AIProviderType; keyName: string; model: string }[] = [
    { provider: 'groq', keyName: 'groqKey', model: 'llama-3.3-70b-versatile' },
    { provider: 'gemini', keyName: 'geminiKey', model: 'gemini-2.0-flash' },
    { provider: 'openrouter', keyName: 'openrouterKey', model: 'meta-llama/llama-3.3-70b-instruct:free' },
    { provider: 'openai', keyName: 'openaiKey', model: 'gpt-4o-mini' },
    { provider: 'anthropic', keyName: 'anthropicKey', model: 'claude-3-5-haiku-20241022' },
  ];

  for (const fb of fallbackOrder) {
    if (fb.provider === currentProvider) continue;
    const key = settings[fb.keyName];
    if (key && key.length > 5) {
      return { provider: fb.provider, key, model: fb.model };
    }
  }

  return null;
}

function buildToolCallInstructions(tools: ToolDefinition[]): string {
  if (tools.length === 0) return '';
  let instructions = '\n## Tool-Calling Anweisungen\n';
  instructions += 'Du kannst Tools aufrufen indem du sie in einem speziellen Format ausgibst.\n';
  instructions += 'Schreibe Tool-Aufrufe GENAU in diesem Format (JSON in einem tool-Block):\n';
  instructions += '```tool\n{"name": "tool_name", "arguments": {"param1": "value1"}}\n```\n\n';
  instructions += 'WICHTIG:\n';
  instructions += '- Schreibe NUR EINEN tool-Block pro Nachricht.\n';
  instructions += '- Schreibe den tool-Block am ANFANG deiner Antwort, BEVOR du Text schreibst.\n';
  instructions += '- Nach dem Tool-Aufruf wird dir das Ergebnis zurückgegeben und du kannst weitere Tools aufrufen.\n';
  instructions += '- Wenn du FERTIG bist, rufe das Tool "task_complete" auf.\n';
  instructions += '- Nutze Tools AKTIV und SOFORT. Frage NICHT ob du etwas tun sollst.\n\n';
  instructions += '## Verfügbare Tools\n';
  for (const t of tools) {
    const params = t.parameters?.properties
      ? Object.entries(t.parameters.properties).map(([k, v]: [string, any]) => k + ' (' + (v?.type || 'string') + '): ' + (v?.description || '')).join(', ')
      : '';
    const required = t.parameters?.required?.join(', ') || '';
    instructions += '- **' + t.name + '**: ' + t.description + '\n';
    if (params) instructions += '  Parameter: ' + params + '\n';
    if (required) instructions += '  Pflicht: ' + required + '\n';
  }
  return instructions;
}

function parseToolCallsFromText(text: string): { toolCalls: { id: string; name: string; arguments: Record<string, any> }[]; cleanContent: string } {
  const toolCalls: { id: string; name: string; arguments: Record<string, any> }[] = [];
  let cleanContent = text;

  const toolBlockRegex = /```tool\s*\n([\s\S]*?)\n```/g;
  let match;

  while ((match = toolBlockRegex.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed?.name) {
        toolCalls.push({
          id: 'rk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          name: parsed.name,
          arguments: parsed.arguments || parsed.params || {},
        });
      }
    } catch (e) {
      console.log('[AI] Failed to parse tool block:', match[1]?.slice(0, 100));
    }
    cleanContent = cleanContent.replace(match[0], '').trim();
  }

  const inlineRegex = /\{\s*"name"\s*:\s*"(\w+)"\s*,\s*"arguments"\s*:\s*(\{[^}]*\})\s*\}/g;
  if (toolCalls.length === 0) {
    while ((match = inlineRegex.exec(text)) !== null) {
      try {
        const args = JSON.parse(match[2]);
        toolCalls.push({
          id: 'rk_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 6),
          name: match[1],
          arguments: args,
        });
        cleanContent = cleanContent.replace(match[0], '').trim();
      } catch {
        console.log('[AI] Failed to parse inline tool call');
      }
    }
  }

  return { toolCalls, cleanContent };
}

async function callRork(
  messages: ChatMessage[],
  systemPrompt: string,
  tools?: ToolDefinition[],
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any> }[] }> {
  console.log('[AI] Calling Rork free model, messages:', messages.length, 'tools:', tools?.length ?? 0);

  type UserMessage = { role: 'user'; content: string };
  type AssistantMessage = { role: 'assistant'; content: string };

  const formatted: (UserMessage | AssistantMessage)[] = [];

  let fullSystemPrompt = systemPrompt;
  if (tools && tools.length > 0) {
    fullSystemPrompt += buildToolCallInstructions(tools);
  }

  for (const msg of messages) {
    if (msg.role === 'tool') {
      const toolName = msg.toolName || 'tool';
      formatted.push({
        role: 'user',
        content: '[Tool-Ergebnis von ' + toolName + ']:\n' + (msg.content || '(leer)'),
      });
      continue;
    }
    if (msg.role === 'user') {
      formatted.push({ role: 'user', content: msg.content || '' });
    } else if (msg.role === 'assistant') {
      let assistantContent = msg.content || '';
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        for (const tc of msg.toolCalls) {
          assistantContent += '\n```tool\n' + JSON.stringify({ name: tc.name, arguments: tc.arguments }) + '\n```';
        }
      }
      formatted.push({ role: 'assistant', content: assistantContent });
    }
  }

  if (formatted.length > 0 && formatted[0].role === 'user') {
    formatted[0] = {
      role: 'user',
      content: '[Systemanweisung: ' + fullSystemPrompt.slice(0, 4000) + ']\n\n' + (formatted[0].content || ''),
    };
  } else {
    formatted.unshift({ role: 'user', content: '[Systemanweisung: ' + fullSystemPrompt.slice(0, 4000) + ']' });
  }

  // Ensure strict alternating pattern if required by SDK, or clean empty content
  const cleanedFormatted: (UserMessage | AssistantMessage)[] = [];
  for (const msg of formatted) {
    if (typeof msg.content === 'string' && msg.content.trim() === '') {
        msg.content = '(empty message)';
    }
    cleanedFormatted.push(msg);
  }

  try {
    const RORK_URL = 'https://toolkit.rork.com/llm/text';
    const res = await fetch(RORK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: cleanedFormatted })
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error('Rork API Error: ' + res.status + ' ' + errText);
    }
    const data = await res.json();
    const text = data?.completion || '';

    if (tools && tools.length > 0) {
      const { toolCalls, cleanContent } = parseToolCallsFromText(text);
      console.log('[AI] Rork parsed tool calls:', toolCalls.length, toolCalls.map(tc => tc.name));
      return { content: cleanContent, toolCalls };
    }

    return { content: text, toolCalls: [] };
  } catch (e: any) {
    console.log('[AI] Rork error:', e);
    throw new Error('Studio KI Fehler: ' + (e?.message || 'Unbekannter Fehler'));
  }
}

async function callProviderDirect(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  systemPrompt: string,
  signal: AbortSignal,
  customEndpoint?: string,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any> }[] }> {
  switch (provider) {
    case 'rork':
      return await callRork(messages, systemPrompt, tools);
    case 'openai':
      return await callOpenAI(apiKey, model, messages, tools, systemPrompt, signal);
    case 'anthropic':
      return await callAnthropic(apiKey, model, messages, tools, systemPrompt, signal);
    case 'gemini':
      return await callGemini(apiKey, model, messages, tools, systemPrompt, signal);
    case 'groq':
      return await callOpenAI(apiKey, model, messages, tools, systemPrompt, signal, 'https://api.groq.com/openai');
    case 'openrouter':
      return await callOpenRouter(apiKey, model, messages, tools, systemPrompt, signal);
    case 'custom':
      return await callOpenAI(apiKey, model, messages, tools, systemPrompt, signal, customEndpoint);
    default:
      throw new Error('Unbekannter Anbieter: ' + provider);
  }
}

export async function callAI(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  tools: ToolDefinition[],
  systemPrompt: string,
  customEndpoint?: string,
  fallbackSettings?: Record<string, string>,
): Promise<{ content: string; toolCalls: { id: string; name: string; arguments: Record<string, any> }[]; usedFallback?: boolean; fallbackProvider?: string }> {
  if (!apiKey && provider !== 'rork' && provider !== 'custom') {
    throw new Error('API-Schlüssel fehlt. Bitte in den Einstellungen konfigurieren.\n\nTipp: Wähle "Studio KI" als Anbieter für kostenlose Nutzung ohne Schlüssel!');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000);

  try {
    let lastError: any = null;
    const maxRetries = 3;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        const result = await callProviderDirect(provider, apiKey, model, messages, tools, systemPrompt, controller.signal, customEndpoint);
        return result;
      } catch (error: any) {
        lastError = error;
        console.log('[AI] Attempt', attempt + 1, 'failed:', error?.message?.slice(0, 100));

        if (isAuthError(error)) {
          throw new Error('Ungültiger API-Schlüssel für ' + provider + '. Bitte überprüfe deinen Schlüssel in den Einstellungen.');
        }

        if (error.name === 'AbortError') {
          throw new Error('Zeitüberschreitung: Die KI-Anfrage hat zu lange gedauert (120s).');
        }

        if (isRateLimitError(error)) {
          if (attempt < maxRetries - 1) {
            const waitTime = (attempt + 1) * 3000;
            console.log('[AI] Rate limit hit, waiting', waitTime, 'ms before retry...');
            await sleep(waitTime);
            continue;
          }

          if (fallbackSettings) {
            const fallback = getProviderForFallback(provider, fallbackSettings);
            if (fallback) {
              console.log('[AI] Rate limit persists, falling back to:', fallback.provider, fallback.model);
              try {
                const result = await callProviderDirect(fallback.provider, fallback.key, fallback.model, messages, tools, systemPrompt, controller.signal);
                return { ...result, usedFallback: true, fallbackProvider: fallback.provider };
              } catch (fbError: any) {
                console.log('[AI] Fallback also failed:', fbError?.message?.slice(0, 100));
              }
            }
          }

          throw new Error(
            'Rate-Limit erreicht bei ' + provider + '.\n\n'
            + '💡 Tipps:\n'
            + '• Warte 30-60 Sekunden und versuche es erneut\n'
            + '• Wechsle zu einem anderen Anbieter (Groq, Gemini oder OpenRouter sind kostenlos)\n'
            + '• Konfiguriere einen zweiten API-Schlüssel als Fallback'
          );
        }

        if (error?.message?.includes('Failed to fetch') || error?.message?.includes('Network')) {
          if (attempt < maxRetries - 1) {
            await sleep(2000);
            continue;
          }
          throw new Error('Netzwerkfehler. Bitte überprüfe deine Internetverbindung.');
        }

        if (attempt < maxRetries - 1) {
          await sleep(1500);
          continue;
        }
      }
    }

    throw lastError || new Error('KI-Anfrage fehlgeschlagen nach ' + maxRetries + ' Versuchen.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateFinalResponse(
  provider: AIProviderType,
  apiKey: string,
  model: string,
  summaryContext: string,
  customEndpoint?: string,
  fallbackSettings?: Record<string, string>,
): Promise<string> {
  const systemPrompt = 'You are an AI assistant. Summarize the result of a completed task. Reply in English. Use Markdown formatting (**bold**, lists, etc). Write a clear, helpful summary of what was done. No tool calls. Write complete sentences.';

  const messages: ChatMessage[] = [{
    id: 'final_' + Date.now().toString(36),
    role: 'user',
    content: summaryContext,
    timestamp: Date.now(),
  }];

  try {
    const response = await callAI(provider, apiKey, model, messages, [], systemPrompt, customEndpoint, fallbackSettings);
    return response.content || '';
  } catch (e: any) {
    console.log('[AI] generateFinalResponse error:', e?.message);
    return '';
  }
}

export function parseThinkingFromContent(content: string): { thinking: string; cleanContent: string } {
  if (!content) return { thinking: '', cleanContent: '' };

  let thinking = '';
  let cleanContent = content;

  // Handle closed tags
  const thinkRegexClosed = /<think(?:ing)?>([\s\S]*?)<\/think(?:ing)?>/gi;
  let match;
  while ((match = thinkRegexClosed.exec(cleanContent)) !== null) {
    thinking += (thinking ? '\n\n' : '') + match[1].trim();
  }
  cleanContent = cleanContent.replace(thinkRegexClosed, '').trim();

  // Handle unclosed tag at the end (during streaming)
  const unclosedRegex = /<think(?:ing)?>([\s\S]*)$/i;
  const unclosedMatch = unclosedRegex.exec(cleanContent);
  if (unclosedMatch) {
    thinking += (thinking ? '\n\n' : '') + unclosedMatch[1].trim();
    cleanContent = cleanContent.replace(unclosedRegex, '').trim();
  }

  return { thinking, cleanContent };
}
