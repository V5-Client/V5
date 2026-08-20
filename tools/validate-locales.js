const fs = require('fs');
const path = require('path');

const langDir = path.join(__dirname, '..', 'assets', 'lang');
const files = fs
    .readdirSync(langDir)
    .filter((file) => file.endsWith('.json'))
    .sort();
const locales = Object.fromEntries(files.map((file) => [file.slice(0, -5), JSON.parse(fs.readFileSync(path.join(langDir, file), 'utf8'))]));
const english = locales.en_us;
if (!english) throw new Error('Missing canonical locale assets/lang/en_us.json');

const placeholders = (value) =>
    new Set(
        String(value)
            .match(/\{([A-Za-z0-9_.-]+)\}/g)
            ?.map((token) => token.slice(1, -1)) || []
    );
const colorCodes = (value) => String(value).match(/&(?:#[0-9A-Fa-f]{6}|[0-9A-FK-ORa-fk-or])/g) || [];
const commandTokens = (value) => String(value).match(/\/(?:v5|visit|call|is|tab|anvil)\b/gi) || [];
let errors = 0;

for (const key of Object.keys(english)) {
    if (key.startsWith('descriptions.') && key.split('.').length !== 2) {
        console.error(`[unstable] ${key}: description keys must be descriptions.<semanticId>`);
        errors++;
    }
    if (key.startsWith('messages.') && (key.split('.').length < 3 || key.includes('_'))) {
        console.error(`[unstable] ${key}: message keys must be messages.<feature>.<semanticId>`);
        errors++;
    }
}

for (const [locale, translations] of Object.entries(locales)) {
    if (locale === 'en_us') continue;
    for (const key of Object.keys(translations)) {
        if (!(key in english)) {
            console.error(`[unknown] ${locale}: ${key}`);
            errors++;
        }
    }
    for (const key of Object.keys(english)) {
        if (!(key in translations)) continue;
        const expected = [...placeholders(english[key])].sort().join(',');
        const actual = [...placeholders(translations[key])].sort().join(',');
        if (expected !== actual) {
            console.error(`[placeholders] ${locale}: ${key} expected {${expected}} got {${actual}}`);
            errors++;
        }
        const expectedColors = colorCodes(english[key]).join(',');
        const actualColors = colorCodes(translations[key]).join(',');
        if (expectedColors !== actualColors) {
            console.error(`[colors] ${locale}: ${key} expected [${expectedColors}] got [${actualColors}]`);
            errors++;
        }
        const expectedCommands = commandTokens(english[key]).join(',').toLowerCase();
        const actualCommands = commandTokens(translations[key]).join(',').toLowerCase();
        if (expectedCommands !== actualCommands) {
            console.error(`[commands] ${locale}: ${key} expected [${expectedCommands}] got [${actualCommands}]`);
            errors++;
        }
    }
}

const sourceFiles = [];
const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory() && entry.name !== '.git') visit(entryPath);
        else if (entry.isFile() && entry.name.endsWith('.js')) sourceFiles.push(entryPath);
    }
};
visit(path.join(__dirname, '..'));

const knownKeys = new Set(Object.keys(english));
for (const file of sourceFiles) {
    const source = fs.readFileSync(file, 'utf8');
    const keys = [
        ...source.matchAll(/\bt\(['"]([^'"]+)['"]/g),
        ...source.matchAll(/\.message\(['"](messages\.[^'"]+)['"]/g),
        ...source.matchAll(/\.message\(\s*\{\s*key:\s*['"]([^'"]+)['"]/g),
    ].map((match) => match[1]);
    for (const key of keys) {
        if (!knownKeys.has(key)) {
            console.error(`[unknown] ${path.relative(path.join(__dirname, '..'), file)}: ${key}`);
            errors++;
        }
    }

    const relative = path.relative(path.join(__dirname, '..'), file);
    const literalComponent =
        /\b(?:this\.)?add(?:Direct)?(?:Toggle|Slider|RangeSlider|MultiToggle|ColorPicker|TextInput|Button|Popup|Separator)\(\s*['"]([^'"]+)['"]/g;
    for (const match of source.matchAll(literalComponent)) {
        if (relative === 'utils/ModuleBase.js') continue;
        if (!match[1].includes('.')) {
            console.error(`[literal] ${relative}: component titles must use translation keys: ${match[1]}`);
            errors++;
        }
    }

    const literalMessage = /\b(?:this\.message|chat|notificationManager\.add|ChatLib\.chat)\(\s*['"]([^'"]+)['"]\s*\)/g;
    for (const match of source.matchAll(literalMessage)) {
        if (!match[1].includes('.') && !match[1].startsWith('&')) {
            console.error(`[literal] ${relative}: display messages must use translation keys: ${match[1]}`);
            errors++;
        }
    }
}

if (errors) process.exitCode = 1;
console.log(`Validated ${files.length} locales and ${knownKeys.size} English keys.`);
