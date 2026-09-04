// Cor determinística por nome — a mesma pessoa sempre tem a mesma cor de
// avatar, sem precisar guardar isso em lugar nenhum.
export function avatarColor(name) {
  const str = String(name || "?");
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 58%, 46%)`;
}

export function initial(name) {
  return String(name || "?").trim().slice(0, 1).toUpperCase();
}
