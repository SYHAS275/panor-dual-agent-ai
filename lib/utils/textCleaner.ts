/**
 * Strips Markdown formatting from a string to produce clean plain text.
 * Removes:
 * - Headers (#, ##)
 * - Bold/Italic (*, _, **)
 * - Code blocks (`, ```)
 * - Links ([text](url) -> text)
 * - List bullets (-, *, + at start of lines)
 * - Blockquotes (>)
 * - Horizontal rules (---)
 */
export function cleanText(text: string): string {
  if (!text) return '';

  let cleaned = text;

  // 1. Remove Headers (e.g. "### Title" -> "Title")
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');

  // 2. Remove Blockquotes (> text)
  cleaned = cleaned.replace(/^>\s+/gm, '');

  // 3. Remove List bullets (e.g. "- item", "* item" -> "item")
  cleaned = cleaned.replace(/^[\s\t]*[-*+]\s+/gm, '');

  // 4. Remove Code Blocks (```code```) - remove fences but keep content
  cleaned = cleaned.replace(/```(?:[\w\d]*)\n?([\s\S]*?)```/g, '$1');

  // 5. Remove Inline Code (`code`)
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');

  // 6. Remove Bold/Italic (e.g. "**bold**", "*italic*", "***both***")
  // Using [\s\S] to match newlines within the block
  // This loop ensures nested/multiple occurrences are handled
  // We do this aggressively: just strip all * and _ sequences that surround text
  // The simple regex (\*{1,3}|_{1,3})(.*?)\1 had issues with newlines and nesting.
  
  // Strategy: Remove pairs of ***, **, *, __, _
  // We use a specific order: *** then ** then *
  
  cleaned = cleaned.replace(/\*{3}([\s\S]*?)\*{3}/g, '$1'); // ***bolditalic***
  cleaned = cleaned.replace(/\*{2}([\s\S]*?)\*{2}/g, '$1'); // **bold**
  cleaned = cleaned.replace(/\*{1}([\s\S]*?)\*{1}/g, '$1'); // *italic*
  
  cleaned = cleaned.replace(/_{3}([\s\S]*?)_{3}/g, '$1'); // ___bolditalic___
  cleaned = cleaned.replace(/_{2}([\s\S]*?)_{2}/g, '$1'); // __bold__
  cleaned = cleaned.replace(/_{1}([\s\S]*?)_{1}/g, '$1'); // _italic_

  // 7. Remove Links ([text](url) -> text) - keeping the text description
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');

  // 8. Remove Images (![alt](url) -> alt)
  cleaned = cleaned.replace(/!\[([^\]]*)\]\([^\)]+\)/g, '$1');

  // 9. Remove Horizontal Rules (---)
  cleaned = cleaned.replace(/^-{3,}\s*$/gm, '');

  // 10. Aggressive Cleanup (User Request): "there is still stars symbol# etc remove them"
  // Remove any remaining * or # characters that might have been missed or used decoratively
  cleaned = cleaned.replace(/[*#]/g, '');

  // 11. Normalize Whitespace (optional, but good for "clean text")
  // Collapse multiple spaces/newlines?
  // Let's just trim lines
  cleaned = cleaned.split('\n').map(line => line.trim()).join('\n');

  return cleaned.trim();
}
