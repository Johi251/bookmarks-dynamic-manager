import assert from 'node:assert/strict';

/** Derselbe Importweg wird im echten Browser und im Windows-WebView geprüft. */
export async function verifyImport(page) {
  const html = (name) => `<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><p><DT><A HREF="https://example.com/${name}">${name}</A></DL>`;
  const open = async () => {
    await page.getByRole('button',{name:'Import',exact:true}).click();
    await page.getByRole('button',{name:'Lesezeichen-HTML (Browser)',exact:true}).click();
  };
  const dialog = page.getByRole('dialog',{name:'Import',exact:true});
  await open();
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'),dialog.getByRole('button',{name:'Lesezeichen-HTML auswählen',exact:true}).click()]);
  await chooser.setFiles({name:'bookmarks.htm',mimeType:'text/html',buffer:Buffer.from(html('import-file-picker'))});
  await dialog.getByText(/Import fertig: 1 neu übernommen/).waitFor();
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.getByRole('link',{name:'import-file-picker',exact:true}).waitFor();
  await open();
  const transfer = await page.evaluateHandle((text) => {
    const data=new DataTransfer();
    data.items.add(new File([text],'bookmarks.html',{type:'text/html'}));
    return data;
  },html('import-file-drop'));
  await dialog.locator('.dropzone').dispatchEvent('dragover',{dataTransfer:transfer});
  await dialog.locator('.dropzone').dispatchEvent('drop',{dataTransfer:transfer});
  await transfer.dispose();
  await dialog.getByText(/Import fertig: 1 neu übernommen/).waitFor();
  await dialog.getByRole('button',{name:'Schließen',exact:true}).click();
  await page.getByRole('link',{name:'import-file-drop',exact:true}).waitFor();
  await page.reload();
  await page.getByRole('link',{name:'import-file-picker',exact:true}).waitFor();
  await page.getByRole('link',{name:'import-file-drop',exact:true}).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('import-file-picker'));
  console.log('PASS: Dateiauswahl öffnet; .htm-Auswahl und HTML5-Datei-Drop importieren und bleiben nach Neuladen erhalten.');
}
