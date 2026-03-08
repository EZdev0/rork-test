/**
 * Chat-Komprimierungs-System
 * 
 * Analysiert Chatverläufe und komprimiert sie intelligent
 * - Behält wichtige Informationen (Entscheidungen, Code, Fehler)
 * - Entfernt Irrelevantes (Begrüßungen, Wiederholungen)
 */

import { ChatMessage } from '@/types';

export interface CompressedChat {
  originalCount: number;
  compressedCount: number;
  summary: string;
  messages: ChatMessage[];
  removedMessages: ChatMessage[];
  compressionRatio: number;
}

export interface ChatAnalysis {
  importantMessages: ChatMessage[];
  removableMessages: ChatMessage[];
  decisions: ChatMessage[];
  codeSnippets: ChatMessage[];
  errors: ChatMessage[];
  greetings: ChatMessage[];
  repetitions: ChatMessage[];
}

/**
 * Komprimiert Chatverlauf intelligent
 */
export function compressChat(messages: ChatMessage[], options?: {
  maxMessages?: number;
  keepLastN?: number;
  includeSummary?: boolean;
}): CompressedChat {
  const {
    maxMessages = 20,
    keepLastN = 10,
    includeSummary = true
  } = options || {};

  // 1. Chat analysieren
  const analysis = analyzeChat(messages);

  // 2. Wichtige Nachrichten behalten
  const importantSet = new Set([
    ...analysis.decisions.map(m => m.id),
    ...analysis.codeSnippets.map(m => m.id),
    ...analysis.errors.map(m => m.id),
    ...analysis.importantMessages.map(m => m.id)
  ]);

  // 3. Letzte N Nachrichten immer behalten
  messages.slice(-keepLastN).forEach(m => importantSet.add(m.id));

  // 4. Filtern
  const keptMessages = messages.filter(m => importantSet.has(m.id));
  const removedMessages = messages.filter(m => !importantSet.has(m.id));

  // 5. Zusammenfassung generieren
  const summary = includeSummary ? generateSummary(analysis) : '';

  return {
    originalCount: messages.length,
    compressedCount: keptMessages.length,
    summary,
    messages: keptMessages,
    removedMessages,
    compressionRatio: ((messages.length - keptMessages.length) / messages.length) * 100
  };
}

/**
 * Analysiert Chat auf relevante Inhalte
 */
export function analyzeChat(messages: ChatMessage[]): ChatAnalysis {
  const analysis: ChatAnalysis = {
    importantMessages: [],
    removableMessages: [],
    decisions: [],
    codeSnippets: [],
    errors: [],
    greetings: [],
    repetitions: []
  };

  const contentHash = new Map<string, number>();

  for (const message of messages) {
    const content = message.content.toLowerCase();
    const type = message.type || 'user';

    // Begrüßungen erkennen
    if (isGreeting(content)) {
      analysis.greetings.push(message);
      analysis.removableMessages.push(message);
      continue;
    }

    // Code-Snippets erkennen
    if (containsCode(content) || type === 'code') {
      analysis.codeSnippets.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Fehler-Analysen erkennen
    if (containsError(content)) {
      analysis.errors.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Entscheidungen erkennen
    if (isDecision(content, message)) {
      analysis.decisions.push(message);
      analysis.importantMessages.push(message);
      continue;
    }

    // Wiederholungen erkennen
    const hash = hashContent(message.content);
    if (contentHash.has(hash)) {
      analysis.repetitions.push(message);
      analysis.removableMessages.push(message);
      continue;
    }
    contentHash.set(hash, messages.indexOf(message));

    // User-Fragen immer wichtig
    if (type === 'user' && content.includes('?')) {
      analysis.importantMessages.push(message);
      continue;
    }

    // KI-Antworten mit File-Referenzen wichtig
    if (type === 'assistant' && containsFileReference(content)) {
      analysis.importantMessages.push(message);
      continue;
    }
  }

  return analysis;
}

/**
 * Generiert Zusammenfassung aus Analyse
 */
function generateSummary(analysis: ChatAnalysis): string {
  const parts: string[] = [];

  if (analysis.decisions.length > 0) {
    parts.push(`**Entscheidungen:** ${analysis.decisions.length}`);
  }

  if (analysis.codeSnippets.length > 0) {
    parts.push(`**Code implementiert:** ${analysis.codeSnippets.length} Snippets`);
  }

  if (analysis.errors.length > 0) {
    parts.push(`**Fehler behoben:** ${analysis.errors.length}`);
  }

  if (analysis.importantMessages.length > 0) {
    const keyPoints = analysis.importantMessages
      .slice(0, 5)
      .map(m => `- ${m.content.substring(0, 100)}...`)
      .join('\n');
    
    parts.push(`**Wichtige Punkte:**\n${keyPoints}`);
  }

  return parts.join('\n\n');
}

/**
 * Hilfsfunktionen
 */

function isGreeting(content: string): boolean {
  const greetings = [
    'hallo', 'hi', 'hey', 'good morning', 'guten tag', 'hello',
    'wie geht', 'how are you', 'servus', 'moin'
  ];
  
  return greetings.some(g => content.startsWith(g));
}

function containsCode(content: string): boolean {
  return content.includes('```') || 
         content.includes('import ') || 
         content.includes('function ') ||
         content.includes('const ') ||
         content.includes('export ');
}

function containsError(content: string): boolean {
  const errorKeywords = [
    'error', 'fehler', 'exception', 'failed', 'crash',
    'bug', 'issue', 'problem', 'fix', 'reparatur'
  ];
  
  return errorKeywords.some(keyword => content.includes(keyword));
}

function isDecision(content: string, message: ChatMessage): boolean {
  const decisionPatterns = [
    'wir machen', 'we will', 'entscheidung:', 'decision:',
    'ich habe mich entschieden', 'i decided', 'lassen uns',
    'let\'s do', 'implementiere', 'implementing'
  ];
  
  return decisionPatterns.some(pattern => content.includes(pattern));
}

function containsFileReference(content: string): boolean {
  return content.includes('.ts') || 
         content.includes('.tsx') ||
         content.includes('.js') ||
         content.includes('.json') ||
         content.includes('/') && content.includes('.');
}

function hashContent(content: string): string {
  // Simple hash for deduplication
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString();
}

/**
 * Bereitet Chat für Komprimierung vor (User Confirmation)
 */
export function prepareCompressionPreview(messages: ChatMessage[]): {
  preview: CompressedChat;
  canCompress: boolean;
  recommendation: string;
} {
  const preview = compressChat(messages);
  
  const canCompress = preview.compressionRatio > 20; // Mindestens 20% Einsparung
  
  let recommendation = '';
  if (preview.compressionRatio > 50) {
    recommendation = 'Starke Komprimierung empfohlen! Viele irrelevante Nachrichten.';
  } else if (preview.compressionRatio > 30) {
    recommendation = 'Komprimierung sinnvoll.';
  } else if (preview.compressionRatio > 20) {
    recommendation = 'Leichte Komprimierung möglich.';
  } else {
    recommendation = 'Chat ist bereits kompakt. Komprimierung nicht notwendig.';
  }
  
  return {
    preview,
    canCompress,
    recommendation
  };
}

/**
 * Extrahiert die wichtigsten Nachrichten für Quick-View
 */
export function extractKeyMessages(messages: ChatMessage[], limit: number = 10): ChatMessage[] {
  const analysis = analyzeChat(messages);
  
  const allImportant = [
    ...analysis.decisions,
    ...analysis.codeSnippets,
    ...analysis.errors,
    ...analysis.importantMessages
  ];
  
  // Duplikate entfernen und nach Wichtigkeit sortieren
  const unique = Array.from(new Set(allImportant.map(m => m.id)))
    .map(id => allImportant.find(m => m.id === id)!);
  
  return unique.slice(0, limit);
}
