/**
 * Normaliza texto de input do usuário.
 * - Remove espaços extras
 * - Detecta padrões como "sou joão", "me chamo maria" e extrai o nome
 * - Capitaliza primeira letra de cada palavra
 */

const NAME_PATTERNS = [
  /^(?:(?:eu )?(?:sou|me chamo|meu nome [eé]|pode me chamar de?|chamo))\s+(.+)$/i,
  /^(?:é|eh|e)\s+(.+)$/i,
];

export function normalizeInput(value: string, inputType?: string): string {
  let text = value.trim().replace(/\s+/g, ' ');

  if (inputType === 'nome') {
    // Try to extract name from common patterns
    for (const pattern of NAME_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        text = match[1].trim();
        break;
      }
    }
    // Capitalize each word
    text = text
      .toLowerCase()
      .split(' ')
      .map(w => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ');
  } else if (inputType === 'email') {
    text = text.toLowerCase();
  } else if (inputType === 'texto') {
    // Just capitalize first letter
    text = text.charAt(0).toUpperCase() + text.slice(1);
  }

  return text;
}
