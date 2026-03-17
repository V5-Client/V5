import { BufferedInputStream, FileOutputStream, URL } from './Constants';

const DEFAULT_DOWNLOAD_BUFFER_SIZE = 8192;

function resolveBufferSize(value) {
    const numeric = Number(value);
    if (!isFinite(numeric)) return DEFAULT_DOWNLOAD_BUFFER_SIZE;

    const normalized = Math.floor(numeric);
    return normalized > 0 ? normalized : DEFAULT_DOWNLOAD_BUFFER_SIZE;
}

function closeQuietly(resource) {
    if (!resource) return;
    try {
        resource.close();
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
    }
}

function normalizeUrl(url) {
    let value = String(url);
    if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
    }
    return value;
}

function resolveDestinationPath(destination) {
    if (destination && typeof destination.getAbsolutePath === 'function') {
        return destination.getAbsolutePath();
    }

    return String(destination);
}

export function ensureDirectory(dir) {
    if (!dir) return;
    if (typeof dir.mkdirs !== 'function' || typeof dir.exists !== 'function') return;
    if (!dir.exists()) dir.mkdirs();
}

export function streamDownloadToFile(url, destination, onProgress = null, bufferSize = DEFAULT_DOWNLOAD_BUFFER_SIZE) {
    let input = null;
    let output = null;

    try {
        const connection = new URL(normalizeUrl(url)).openConnection();
        connection.connect();

        const expectedSize = connection.getContentLength();
        input = new BufferedInputStream(connection.getInputStream());
        const destinationFile = destination && typeof destination.getParentFile === 'function' ? destination : new java.io.File(String(destination));
        const parent = destinationFile.getParentFile ? destinationFile.getParentFile() : null;
        ensureDirectory(parent);
        output = new FileOutputStream(resolveDestinationPath(destinationFile));

        const normalizedBufferSize = resolveBufferSize(bufferSize);
        const data = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, normalizedBufferSize);
        let total = 0;
        let count;
        let lastReported = -1;

        while ((count = input.read(data)) !== -1) {
            output.write(data, 0, count);
            total += count;

            if (expectedSize > 0 && onProgress) {
                const percent = Math.floor((total / expectedSize) * 100);
                if (percent >= lastReported + 10) {
                    lastReported = percent;
                    onProgress(percent);
                }
            }
        }

        output.flush();
    } finally {
        closeQuietly(output);
        closeQuietly(input);
    }
}

export function streamDownloadToFileAsync(url, destination, options = {}) {
    options = options || {};
    const { onProgress = null, onError = null, onComplete = null, bufferSize = DEFAULT_DOWNLOAD_BUFFER_SIZE } = options;

    const t = new java.lang.Thread(() => {
        try {
            streamDownloadToFile(url, destination, onProgress, bufferSize);
            if (onComplete) onComplete();
        } catch (e) {
            if (onError) onError(e);
            else console.error('V5 Caught error' + e + e.stack);
        }
    });

    t.setDaemon(true);
    t.start();
    return t;
}

export function downloadFile(url, destination, options = {}) {
    options = options || {};
    const { onProgress = null, onComplete = null, onError = null, bufferSize = DEFAULT_DOWNLOAD_BUFFER_SIZE } = options;

    return streamDownloadToFileAsync(url, destination, {
        onProgress,
        onComplete,
        bufferSize,
        onError: (e) => {
            if (typeof onError === 'function') {
                onError(e);
                return;
            }

            console.error('V5 Caught error' + e + e.stack);
        },
    });
}

export function findFileRecursive(rootDir, fileName) {
    if (!rootDir || typeof rootDir.listFiles !== 'function') return null;
    const files = rootDir.listFiles();
    if (!files) return null;

    for (const file of files) {
        if (file.isDirectory()) {
            const nested = findFileRecursive(file, fileName);
            if (nested) return nested;
            continue;
        }

        if (file.getName() === fileName) return file;
    }

    return null;
}

export function deleteRecursive(target) {
    if (!target || !target.exists()) return;

    if (target.isDirectory()) {
        const children = target.listFiles();
        if (children) {
            for (let i = 0; i < children.length; i++) {
                deleteRecursive(children[i]);
            }
        }
    }

    try {
        target.delete();
    } catch (e) {
        console.error('V5 Caught error' + e + e.stack);
    }
}
