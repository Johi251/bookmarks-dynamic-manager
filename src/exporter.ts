import type { AppState, Bookmark, Category } from './types';

/** Download einer Datei im Browser (Blob -> a[download]). */
export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5_000);
}

export function exportJson(state: AppState): string {
  return JSON.stringify(state, null, 2);
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export ins Netscape-HTML-Format — kann direkt wieder in Chrome/Firefox/Brave
 * importiert werden. Gruppiert nach Kategorien; alle weiteren Kategorienamen und
 * Tags stehen im TAGS-Attribut, damit beim Re-Import nichts verloren geht.
 */
export function exportNetscapeHtml(state: AppState): string {
  const catById = new Map<string, Category>(state.categories.map((c) => [c.id, c]));
  const catPath = (id: string): string => {
    const parts: string[] = [];
    let cur: Category | undefined = catById.get(id);
    while (cur) {
      parts.unshift(cur.name);
      cur = cur.parentId ? catById.get(cur.parentId) : undefined;
    }
    return parts.join(' / ');
  };

  const groups = new Map<string, Bookmark[]>();
  for (const bm of state.bookmarks) {
    const key = bm.categoryIds.length ? catPath(bm.categoryIds[0]) : 'Sonstige';
    const list = groups.get(key) ?? [];
    list.push(bm);
    groups.set(key, list);
  }
  const sortedKeys = [...groups.keys()].sort((a, b) => a.localeCompare(b, 'de'));

  const now = Math.floor(Date.now() / 1000);
  const lines: string[] = [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- Bookmarks Dynamic Manager Export -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>Bookmarks</TITLE><H1>Bookmarks</H1><DL><p>`,
  ];
  for (const key of sortedKeys) {
    const items = groups.get(key)!;
    lines.push(`    <DT><H3 ADD_DATE="${now}">${escapeHtml(key)}</H3>`);
    lines.push('    <DL><p>');
    for (const bm of [...items].sort((a, b) => b.added - a.added)) {
      const extraCats = bm.categoryIds.slice(1).map((id) => catById.get(id)?.name ?? '').filter(Boolean);
      const tags = [...extraCats, ...bm.tags].join(',');
      const tagAttr = tags ? ` TAGS="${escapeHtml(tags)}"` : '';
      lines.push(
        `        <DT><A HREF="${escapeHtml(bm.url)}" ADD_DATE="${Math.floor(bm.added / 1000)}"${tagAttr}>${escapeHtml(
          bm.title
        )}</A>`
      );
    }
    lines.push('    </DL><p>');
  }
  lines.push('</DL><p>');
  return lines.join('\n');
}

/** Markdown-Liste nach Kategorien gruppiert (jüngstes zuerst). */
export function exportMarkdown(state: AppState): string {
  const catById = new Map<string, Category>(state.categories.map((c) => [c.id, c]));
  const groups = new Map<string, Bookmark[]>();
  for (const bm of state.bookmarks) {
    const name = bm.categoryIds.length ? catById.get(bm.categoryIds[0])?.name ?? 'Sonstige' : 'Sonstige';
    const list = groups.get(name) ?? [];
    list.push(bm);
    groups.set(name, list);
  }
  const out: string[] = ['# Bookmarks Dynamic Manager — Export', '', `Stand: ${new Date().toLocaleString('de-DE')}`, ''];
  for (const key of [...groups.keys()].sort((a, b) => a.localeCompare(b, 'de'))) {
    out.push(`## ${key}`, '');
    for (const bm of [...groups.get(key)!].sort((a, b) => b.added - a.added)) {
      const tags = bm.tags.length ? ` \`${bm.tags.join('` `')}\`` : '';
      out.push(`- [${bm.title}](${bm.url})${tags}`);
    }
    out.push('');
  }
  return out.join('\n');
}
