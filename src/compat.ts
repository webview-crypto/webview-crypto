export function subtle(): SubtleCrypto {
  return crypto.subtle || (crypto as any).webkitSubtle;
}
