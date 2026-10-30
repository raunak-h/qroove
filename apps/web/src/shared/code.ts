/** "abc123" -> "ABC-123": the permanent room code, as two easy-to-remember triplets. */
export const formatCode = (slug: string) => {
  const c = slug.toUpperCase();
  return `${c.slice(0, 3)}-${c.slice(3)}`;
};
