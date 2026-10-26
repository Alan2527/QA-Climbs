import { inflateRawSync } from 'node:zlib';

/**
 * El texto de un .docx (word/document.xml sin etiquetas), sin dependencias: un .docx es un zip,
 * se recorre su directorio central y se descomprime solo ese archivo. Si no es un .docx valido
 * devuelve '' (lo decide quien lo use: un documento ajeno que no baja tampoco muestra nada).
 */
export function textoDelDocx(buffer: Buffer): string {
  const fin = buffer.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (fin < 0) return '';
  const entradas = buffer.readUInt16LE(fin + 10);
  let p = buffer.readUInt32LE(fin + 16);
  for (let i = 0; i < entradas && buffer.readUInt32LE(p) === 0x02014b50; i++) {
    const metodo = buffer.readUInt16LE(p + 10);
    const comprimido = buffer.readUInt32LE(p + 20);
    const largoNombre = buffer.readUInt16LE(p + 28);
    const largoExtra = buffer.readUInt16LE(p + 30);
    const largoComentario = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nombre = buffer.toString('utf8', p + 46, p + 46 + largoNombre);
    if (nombre === 'word/document.xml') {
      const inicio = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
      const datos = buffer.subarray(inicio, inicio + comprimido);
      const xml = (metodo === 8 ? inflateRawSync(datos) : datos).toString('utf8');
      return xml.replace(/<w:tab\/>/g, ' ').replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
    }
    p += 46 + largoNombre + largoExtra + largoComentario;
  }
  return '';
}
