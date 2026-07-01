/**
 * Generates a random room ID in the format xxxx-xxxx-xxxx
 * Used by dashboard buttons and other room creation flows.
 */
export function generateRoomId() {
  const c = 'abcdefghijklmnopqrstuvwxyz';
  const s: string[] = [];
  for (let i = 0; i < 3; i++) {
    let x = '';
    for (let j = 0; j < 4; j++) x += c[Math.floor(Math.random() * c.length)];
    s.push(x);
  }
  return s.join('-');
}