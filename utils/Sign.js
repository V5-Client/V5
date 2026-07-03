class SignClass {
    setLine(line, text) {
        const i = Number(line) - 1;
        if (!Number.isFinite(i) || Math.floor(i) !== i || i < 0 || i > 3) return;

        const messages = this._getField(Client.getMinecraft().screen, 'messages'); // mojmap: messages
        if (!messages) return;

        messages[i] = String(text == null ? '' : text);
    }

    _getField(obj, name) {
        if (!obj) return null;

        for (let c = obj.getClass(); c; c = c.getSuperclass()) {
            try {
                const f = c.getDeclaredField(name);
                f.setAccessible(true);
                return f.get(obj);
            } catch (_) {}
        }
    }
}

export const Sign = new SignClass();
