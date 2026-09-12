import { executeAsync } from './ThreadExecutor';
import { Promise } from './Promise';

const URL = Java.type('java.net.URL');
const BufferedReader = Java.type('java.io.BufferedReader');
const InputStreamReader = Java.type('java.io.InputStreamReader');
const OutputStreamWriter = Java.type('java.io.OutputStreamWriter');
const GZIPInputStream = Java.type('java.util.zip.GZIPInputStream');

export default function requestV2(options) {
    if (typeof options === 'string') options = { url: options };

    return new Promise((resolve, reject) => {
        executeAsync(() => {
            let connection;
            try {
                connection = new URL(options.url).openConnection();
                connection.setRequestMethod((options.method || 'GET').toUpperCase());
                connection.setConnectTimeout(options.connectTimeout ?? options.timeout ?? 0);
                connection.setReadTimeout(options.readTimeout ?? options.timeout ?? 0);
                connection.setInstanceFollowRedirects(options.followRedirect ?? true);
                connection.setRequestProperty('Accept-Encoding', 'gzip');

                Object.keys(options.headers || {}).forEach((header) => connection.setRequestProperty(header, options.headers[header]));

                if (options.body !== undefined) {
                    connection.setDoOutput(true);
                    connection.setRequestProperty('Content-Type', 'application/json; charset=UTF-8');
                    const writer = new OutputStreamWriter(connection.getOutputStream());
                    writer.write(typeof options.body === 'object' ? JSON.stringify(options.body) : String(options.body));
                    writer.close();
                }

                const statusCode = connection.getResponseCode();
                let stream = statusCode > 299 ? connection.getErrorStream() : connection.getInputStream();
                if (connection.getContentEncoding() === 'gzip') stream = new GZIPInputStream(stream);

                const reader = new BufferedReader(new InputStreamReader(stream));
                let body = '';
                let line;
                while ((line = reader.readLine()) !== null) body += line;
                reader.close();

                if (options.json) body = JSON.parse(body);
                if (statusCode > 299) return reject(body);
                if (!options.resolveWithFullResponse) return resolve(body);

                const headers = {};
                const headerFields = connection.getHeaderFields();
                headerFields.keySet().forEach((name) => {
                    if (name !== null) headers[name] = headerFields.get(name).get(0);
                });
                resolve({ statusCode, statusMessage: connection.getResponseMessage(), headers, body });
            } catch (error) {
                reject(error);
            } finally {
                connection?.disconnect();
            }
        });
    });
}
