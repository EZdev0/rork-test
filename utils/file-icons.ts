const COLOR_MAP: Record<string, string> = {
  kt: '#A97BFF', java: '#E76F00', ts: '#3178C6', tsx: '#3178C6',
  js: '#F7DF1E', jsx: '#F7DF1E', py: '#3776AB', rb: '#CC342D',
  go: '#00ADD8', rs: '#DEA584', c: '#555555', cpp: '#F34B7D',
  h: '#555555', cs: '#178600', swift: '#F05138', dart: '#0175C2',
  xml: '#E44D26', html: '#E34C26', css: '#1572B6', scss: '#C6538C',
  json: '#F7DF1E', yaml: '#CB171E', yml: '#CB171E', md: '#519ABA',
  txt: '#94A3B8', sh: '#4EAA25', bat: '#C1F12E',
  gradle: '#02303A', kts: '#A97BFF', sql: '#E38C00',
  graphql: '#E535AB', dockerfile: '#2496ED', gitignore: '#F05032',
  svg: '#FFB13B', png: '#10B981', jpg: '#10B981', gif: '#10B981',
  zip: '#F59E0B', tar: '#F59E0B', gz: '#F59E0B',
  properties: '#94A3B8', toml: '#9C4121', lock: '#94A3B8',
  env: '#EAB308', cfg: '#94A3B8', ini: '#94A3B8',
};

const LABEL_MAP: Record<string, string> = {
  kt: 'KT', java: 'JV', ts: 'TS', tsx: 'TX', js: 'JS', jsx: 'JX',
  py: 'PY', rb: 'RB', go: 'GO', rs: 'RS', c: 'C', cpp: 'C+',
  h: 'H', cs: 'C#', swift: 'SW', dart: 'DA',
  xml: '<>', html: '<>', css: '#', scss: 'SC', json: '{}',
  yaml: 'YM', yml: 'YM', md: 'MD', txt: 'TX', sh: '$',
  gradle: 'GR', kts: 'KS', sql: 'SQ', svg: 'SV',
  zip: 'ZP', png: 'IM', jpg: 'IM', gif: 'GF',
  gitignore: 'GI', dockerfile: 'DK', properties: 'PR',
  toml: 'TM', lock: 'LK', env: 'EN', bat: 'BT',
};

export function getFileColor(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (filename.toLowerCase() === 'dockerfile') return COLOR_MAP.dockerfile;
  if (filename.toLowerCase() === '.gitignore') return COLOR_MAP.gitignore;
  if (filename.toLowerCase() === '.env') return COLOR_MAP.env;
  return COLOR_MAP[ext] || '#64748B';
}

export function getFileLabel(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (filename.toLowerCase() === 'dockerfile') return 'DK';
  if (filename.toLowerCase() === '.gitignore') return 'GI';
  return LABEL_MAP[ext] || ext.toUpperCase().slice(0, 2) || 'F';
}

export function detectLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const map: Record<string, string> = {
    kt: 'kotlin', java: 'java', ts: 'typescript', tsx: 'typescript',
    js: 'javascript', jsx: 'javascript', py: 'python', rb: 'ruby',
    go: 'go', rs: 'rust', c: 'c', cpp: 'cpp', cs: 'csharp',
    swift: 'swift', dart: 'dart', xml: 'xml', html: 'xml',
    css: 'css', scss: 'css', json: 'json', yaml: 'yaml', yml: 'yaml',
    md: 'markdown', sh: 'shell', sql: 'sql', gradle: 'gradle',
    kts: 'kotlin', svg: 'xml',
  };
  return map[ext] || 'plain';
}

export function isBinaryFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'zip', 'tar', 'gz', 'rar', '7z', 'exe', 'dll', 'so', 'dylib', 'apk', 'aab', 'ipa', 'class', 'jar', 'war'].includes(ext);
}
