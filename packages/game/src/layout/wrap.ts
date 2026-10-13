/** Перенос текста по словам в строки ширины `width` клеток; слово длиннее строки режется. */
export function wrap(text: string, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      for (let w = word; w.length > 0; ) {
        const sep = line ? ' ' : '';
        if (line.length + sep.length + w.length <= width) {
          line += sep + w;
          w = '';
        } else if (line) {
          lines.push(line);
          line = '';
        } else {
          lines.push(w.slice(0, width));
          w = w.slice(width);
        }
      }
    }
    lines.push(line);
  }
  return lines;
}
