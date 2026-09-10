/** Remove standalone editorial bracket residue, without altering prose or page indexes. */
export function cleanReaderText(text: string): string {
  return text.split(/\n\s*\n/).map(p => p.trim()).filter(p => p && !/^[\[\]]+$/.test(p)).join("\n\n");
}
