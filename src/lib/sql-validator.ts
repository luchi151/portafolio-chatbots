const BLOCKED: string[] = [
  'DROP', 'DELETE', 'INSERT', 'UPDATE', 'ALTER', 'CREATE', 'TRUNCATE',
  'GRANT', 'REVOKE', 'EXEC', 'EXECUTE', 'CALL', 'PROCEDURE', 'FUNCTION',
  'TRIGGER', 'SCHEMA', 'DATABASE', 'ATTACH', 'DETACH', 'LOAD',
];

export function validateSQL(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();

  if (!trimmed) return { valid: false, error: 'SQL vacío' };

  const normalized = trimmed.toUpperCase();

  // Must start with SELECT or WITH (for CTEs)
  if (!normalized.startsWith('SELECT') && !normalized.startsWith('WITH')) {
    return { valid: false, error: 'Solo se permiten consultas SELECT' };
  }

  for (const kw of BLOCKED) {
    if (new RegExp(`\\b${kw}\\b`, 'i').test(sql)) {
      return { valid: false, error: `Operación no permitida: ${kw}` };
    }
  }

  // Block comment-based injections
  if (/\/\*[\s\S]*?\*\//.test(sql) || /--/.test(sql)) {
    return { valid: false, error: 'Comentarios SQL no permitidos' };
  }

  return { valid: true };
}
