import { crc32, deflateRawSync } from 'node:zlib';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

export function directoryFiles(root, prefix = '') {
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    if (entry.isSymbolicLink()) throw new Error('Links gehören nicht ins Downloadpaket.');
    return entry.isDirectory() ? directoryFiles(path, `${prefix}${entry.name}/`) : [{ name: prefix + entry.name, data: readFileSync(path) }];
  });
}

/** ZIP ohne Plattformprogramme; UTF-8 und Schrägstriche funktionieren auch auf macOS/Linux. */
export function zipFiles(files, output) {
  if (files.length > 65535) throw new Error('Paket zu groß für dieses ZIP-Format.');
  const local = [], central = [], names = new Set();
  let offset = 0;
  for (const file of files) {
    const nameText = file.name.replace(/\\/g, '/');
    if (nameText.startsWith('/') || nameText.split('/').some((p) => !p || p === '..' || p.includes(':')) || names.has(nameText)) throw new Error('Ungültiger oder doppelter ZIP-Pfad.');
    names.add(nameText);
    const name = Buffer.from(nameText), data = Buffer.from(file.data), compressed = deflateRawSync(data), crc = crc32(data);
    if (name.length > 65535 || offset + compressed.length > 0xffffffff) throw new Error('ZIP überschreitet Formatgrenzen.');
    const head = Buffer.alloc(30);
    head.writeUInt32LE(0x04034b50); head.writeUInt16LE(20, 4); head.writeUInt16LE(0x800, 6); head.writeUInt16LE(8, 8); head.writeUInt16LE(33, 12);
    head.writeUInt32LE(crc, 14); head.writeUInt32LE(compressed.length, 18); head.writeUInt32LE(data.length, 22); head.writeUInt16LE(name.length, 26);
    local.push(head, name, compressed);
    const item = Buffer.alloc(46);
    item.writeUInt32LE(0x02014b50); item.writeUInt16LE(20, 4); item.writeUInt16LE(20, 6); item.writeUInt16LE(0x800, 8); item.writeUInt16LE(8, 10); item.writeUInt16LE(33, 14);
    item.writeUInt32LE(crc, 16); item.writeUInt32LE(compressed.length, 20); item.writeUInt32LE(data.length, 24); item.writeUInt16LE(name.length, 28); item.writeUInt32LE(offset, 42);
    central.push(item, name); offset += head.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  mkdirSync(dirname(output), { recursive: true });
  writeFileSync(output, Buffer.concat([...local, directory, end]));
  console.log('ZIP erstellt:', relative(process.cwd(), output));
}
