import { BufferedInputStream, FileOutputStream, URL } from './Constants';
import { finiteNumber } from './Math';
import { executeAsync, scheduleClient } from './ThreadExecutor';

const DEFAULT_DOWNLOAD_BUFFER_SIZE = 8192;

function resolveBufferSize(value) {
    const normalized = Math.floor(finiteNumber(value, DEFAULT_DOWNLOAD_BUFFER_SIZE));
    return normalized > 0 ? normalized : DEFAULT_DOWNLOAD_BUFFER_SIZE;
}

function closeQuietly(resource) {
    if (!resource) return;
    try {
        resource.close();
    } catch (e) {
        console.error(e);
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
    return destination && typeof destination.getAbsolutePath === 'function' ? destination.getAbsolutePath() : String(destination);
}

function ensureDirectory(dir) {
    if (!dir) return;
    if (typeof dir.mkdirs !== 'function' || typeof dir.exists !== 'function') return;
    if (!dir.exists()) dir.mkdirs();
}

export function streamDownloadToFile(url, destination, onProgress = null, bufferSize = DEFAULT_DOWNLOAD_BUFFER_SIZE) {
    let input = null;
    let output = null;

    try {
        const connection = new URL(normalizeUrl(url)).openConnection();
        connection.setConnectTimeout(5000);
        connection.setReadTimeout(5000);
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

export function downloadFile(url, destination, options = {}) {
    options = options || {};
    const { onProgress = null, onError = null, onComplete = null, bufferSize = DEFAULT_DOWNLOAD_BUFFER_SIZE } = options;

    return executeAsync((generation) => {
        try {
            streamDownloadToFile(url, destination, onProgress ? (percent) => scheduleClient(() => onProgress(percent), 0, generation) : null, bufferSize);
            if (onComplete) scheduleClient(onComplete, 0, generation);
        } catch (e) {
            if (onError) scheduleClient(() => onError(e), 0, generation);
            else console.error(e);
        }
    });
}
