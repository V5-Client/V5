export function setSignLine(line, text) {
    const index = Number(line) - 1;
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    Client.setSignLine(index, String(text ?? ''));
}
