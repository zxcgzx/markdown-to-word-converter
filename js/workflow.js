(function (root, factory) {
    'use strict';
    const api = factory(root || globalThis);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordWorkflow = api;
})(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const BACKUP_FORMAT = 'md2word-workspace-backup';
    const BACKUP_VERSION = 1;
    const DEFAULT_DB_NAME = 'md2word-workspace-v5.3';
    const DEFAULT_STORE_NAME = 'documents';
    const DEFAULT_FALLBACK_KEY = 'md2word.workflow.documents.v5.3';

    function now() {
        return Date.now();
    }

    function createId(prefix = 'doc') {
        if (root.crypto && typeof root.crypto.randomUUID === 'function') {
            return `${prefix}-${root.crypto.randomUUID()}`;
        }
        const random = Math.random().toString(36).slice(2, 10);
        return `${prefix}-${now().toString(36)}-${random}`;
    }

    function normalizeName(value, fallback = '未命名') {
        const cleaned = String(value || '')
            .trim()
            .replace(/\.(?:md|markdown|txt|docx)$/i, '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
        return cleaned || fallback;
    }

    function normalizeVersion(version, index = 0) {
        const createdAt = Number(version && version.createdAt) || now();
        return {
            id: String(version && version.id || createId('ver')),
            reason: String(version && version.reason || '历史版本').slice(0, 80),
            source: String(version && version.source || 'manual'),
            content: String(version && version.content || ''),
            documentName: normalizeName(version && version.documentName),
            createdAt,
            selectionStart: Math.max(0, Number(version && version.selectionStart) || 0),
            selectionEnd: Math.max(0, Number(version && version.selectionEnd) || 0),
            order: Number(version && version.order) || index
        };
    }

    function normalizeDocumentRecord(record = {}) {
        const createdAt = Number(record.createdAt) || now();
        const updatedAt = Math.max(createdAt, Number(record.updatedAt) || createdAt);
        const name = normalizeName(record.name || record.documentName || record.fileName);
        const versions = Array.isArray(record.versions)
            ? record.versions.map(normalizeVersion).sort((a, b) => b.createdAt - a.createdAt)
            : [];
        return {
            id: String(record.id || createId('doc')),
            name,
            fileName: `${name}.md`,
            content: String(record.content || ''),
            createdAt,
            updatedAt,
            lastOpenedAt: Number(record.lastOpenedAt) || updatedAt,
            fileOrigin: String(record.fileOrigin || 'new'),
            fileSyncedAt: record.fileSyncedAt == null ? null : Number(record.fileSyncedAt),
            fileDirty: record.fileDirty !== false,
            selectionStart: Math.max(0, Number(record.selectionStart) || 0),
            selectionEnd: Math.max(0, Number(record.selectionEnd) || 0),
            editorScrollTop: Math.max(0, Number(record.editorScrollTop) || 0),
            previewScrollTop: Math.max(0, Number(record.previewScrollTop) || 0),
            view: ['editor', 'split', 'preview'].includes(record.view) ? record.view : 'split',
            versions,
            metadata: record.metadata && typeof record.metadata === 'object' ? { ...record.metadata } : {}
        };
    }

    function createVersionSnapshot(record, reason = '手动版本', source = 'manual', createdAt = now()) {
        const normalized = normalizeDocumentRecord(record);
        return normalizeVersion({
            id: createId('ver'),
            reason,
            source,
            content: normalized.content,
            documentName: normalized.name,
            createdAt,
            selectionStart: normalized.selectionStart,
            selectionEnd: normalized.selectionEnd
        });
    }

    function clone(value) {
        if (typeof structuredClone === 'function') {
            try { return structuredClone(value); } catch (_error) { /* fall through */ }
        }
        return JSON.parse(JSON.stringify(value));
    }

    class DocumentRepository {
        constructor(options = {}) {
            this.dbName = options.dbName || DEFAULT_DB_NAME;
            this.storeName = options.storeName || DEFAULT_STORE_NAME;
            this.fallbackKey = options.fallbackKey || DEFAULT_FALLBACK_KEY;
            if (Object.prototype.hasOwnProperty.call(options, 'indexedDB')) this.indexedDB = options.indexedDB;
            else {
                try { this.indexedDB = root.indexedDB; } catch (_error) { this.indexedDB = null; }
            }
            if (Object.prototype.hasOwnProperty.call(options, 'localStorage')) this.localStorage = options.localStorage;
            else {
                try { this.localStorage = root.localStorage; } catch (_error) { this.localStorage = null; }
            }
            this.mode = 'uninitialized';
            this.db = null;
            this.memory = new Map();
        }

        async init() {
            if (this.mode !== 'uninitialized') return this.mode;
            if (this.indexedDB && typeof this.indexedDB.open === 'function') {
                try {
                    this.db = await this.openDatabase();
                    this.mode = 'indexeddb';
                    return this.mode;
                } catch (_error) {
                    this.db = null;
                }
            }
            if (this.canUseLocalStorage()) {
                this.mode = 'localstorage';
                return this.mode;
            }
            this.mode = 'memory';
            return this.mode;
        }

        canUseLocalStorage() {
            if (!this.localStorage || typeof this.localStorage.getItem !== 'function') return false;
            try {
                const probe = `${this.fallbackKey}.probe`;
                this.localStorage.setItem(probe, '1');
                this.localStorage.removeItem(probe);
                return true;
            } catch (_error) {
                return false;
            }
        }

        openDatabase() {
            return new Promise((resolve, reject) => {
                const request = this.indexedDB.open(this.dbName, 1);
                request.onupgradeneeded = () => {
                    const database = request.result;
                    if (!database.objectStoreNames.contains(this.storeName)) {
                        const store = database.createObjectStore(this.storeName, { keyPath: 'id' });
                        store.createIndex('updatedAt', 'updatedAt', { unique: false });
                        store.createIndex('lastOpenedAt', 'lastOpenedAt', { unique: false });
                    }
                };
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error || new Error('IndexedDB open failed'));
                request.onblocked = () => reject(new Error('IndexedDB open blocked'));
            });
        }

        async ensureReady() {
            if (this.mode === 'uninitialized') await this.init();
        }

        readFallbackMap() {
            if (this.mode === 'memory') return new Map(this.memory);
            try {
                const raw = this.localStorage.getItem(this.fallbackKey);
                const parsed = raw ? JSON.parse(raw) : {};
                return new Map(Object.entries(parsed && typeof parsed === 'object' ? parsed : {}));
            } catch (_error) {
                return new Map();
            }
        }

        writeFallbackMap(map) {
            if (this.mode === 'memory') {
                this.memory = new Map(map);
                return;
            }
            const object = Object.fromEntries(map.entries());
            this.localStorage.setItem(this.fallbackKey, JSON.stringify(object));
        }

        idbRequest(method, value) {
            return new Promise((resolve, reject) => {
                const readonly = method === 'get' || method === 'getAll';
                const transaction = this.db.transaction(this.storeName, readonly ? 'readonly' : 'readwrite');
                const store = transaction.objectStore(this.storeName);
                const request = method === 'getAll'
                    ? store.getAll()
                    : method === 'clear'
                        ? store.clear()
                        : store[method](value);
                let result;
                let settled = false;
                const fail = (error) => {
                    if (settled) return;
                    settled = true;
                    reject(error);
                };
                request.onsuccess = () => {
                    result = request.result;
                    if (readonly && !settled) {
                        settled = true;
                        resolve(result);
                    }
                };
                request.onerror = () => fail(request.error || new Error(`IndexedDB ${method} failed`));
                transaction.oncomplete = () => {
                    if (!readonly && !settled) {
                        settled = true;
                        resolve(result);
                    }
                };
                transaction.onerror = () => fail(transaction.error || new Error(`IndexedDB transaction failed`));
                transaction.onabort = () => fail(transaction.error || new Error(`IndexedDB ${method} aborted`));
            });
        }

        async list() {
            await this.ensureReady();
            let records;
            if (this.mode === 'indexeddb') records = await this.idbRequest('getAll');
            else records = Array.from(this.readFallbackMap().values());
            return records.map(normalizeDocumentRecord).sort((a, b) => b.updatedAt - a.updatedAt);
        }

        async get(id) {
            await this.ensureReady();
            if (!id) return null;
            let record;
            if (this.mode === 'indexeddb') record = await this.idbRequest('get', String(id));
            else record = this.readFallbackMap().get(String(id));
            return record ? normalizeDocumentRecord(record) : null;
        }

        async put(record) {
            await this.ensureReady();
            const normalized = normalizeDocumentRecord(record);
            if (this.mode === 'indexeddb') await this.idbRequest('put', normalized);
            else {
                const map = this.readFallbackMap();
                map.set(normalized.id, normalized);
                this.writeFallbackMap(map);
            }
            return clone(normalized);
        }

        async create(data = {}) {
            return this.put({ ...data, id: data.id || createId('doc'), createdAt: data.createdAt || now(), updatedAt: data.updatedAt || now() });
        }

        async remove(id) {
            await this.ensureReady();
            if (!id) return false;
            if (this.mode === 'indexeddb') await this.idbRequest('delete', String(id));
            else {
                const map = this.readFallbackMap();
                const existed = map.delete(String(id));
                this.writeFallbackMap(map);
                return existed;
            }
            return true;
        }

        async clear() {
            await this.ensureReady();
            if (this.mode === 'indexeddb') await this.idbRequest('clear');
            else this.writeFallbackMap(new Map());
        }

        async duplicate(id, suffix = '副本') {
            const source = await this.get(id);
            if (!source) return null;
            const name = normalizeName(`${source.name} ${suffix}`);
            return this.create({
                ...source,
                id: createId('doc'),
                name,
                fileName: `${name}.md`,
                createdAt: now(),
                updatedAt: now(),
                lastOpenedAt: now(),
                fileOrigin: 'duplicate',
                fileSyncedAt: null,
                fileDirty: true,
                versions: [createVersionSnapshot(source, '创建副本时', 'duplicate')]
            });
        }

        async addVersion(id, snapshot, maxVersions = 20) {
            const record = await this.get(id);
            if (!record) return null;
            const version = normalizeVersion(snapshot || createVersionSnapshot(record));
            const existing = record.versions || [];
            if (existing[0] && existing[0].content === version.content && existing[0].documentName === version.documentName) {
                return clone(record);
            }
            record.versions = [version, ...existing].slice(0, Math.max(1, Number(maxVersions) || 20));
            record.updatedAt = Math.max(record.updatedAt, version.createdAt);
            return this.put(record);
        }

        async exportAll() {
            return this.list();
        }

        async importAll(records, options = {}) {
            await this.ensureReady();
            const normalized = Array.isArray(records) ? records.map(normalizeDocumentRecord) : [];
            if (options.replace) await this.clear();
            const imported = [];
            for (const record of normalized) {
                let next = record;
                if (!options.replace && await this.get(record.id)) {
                    next = { ...record, id: createId('doc'), name: normalizeName(`${record.name} 导入`) };
                    next.fileName = `${next.name}.md`;
                }
                imported.push(await this.put(next));
            }
            return imported;
        }

        close() {
            if (this.db && typeof this.db.close === 'function') this.db.close();
            this.db = null;
        }
    }

    function convertRowsToMarkdown(rows) {
        if (!Array.isArray(rows) || !rows.length) return '';
        const width = Math.max(...rows.map((row) => row.length));
        const normalized = rows.map((row) => Array.from({ length: width }, (_, index) => String(row[index] == null ? '' : row[index]).trim().replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>')));
        const header = normalized[0];
        const divider = Array.from({ length: width }, () => '---');
        return [header, divider, ...normalized.slice(1)].map((row) => `| ${row.join(' | ')} |`).join('\n');
    }

    function parseDelimitedLine(line, delimiter) {
        if (delimiter === '\t') return line.split('\t');
        const result = [];
        let current = '';
        let quoted = false;
        for (let index = 0; index < line.length; index += 1) {
            const char = line[index];
            if (char === '"') {
                if (quoted && line[index + 1] === '"') { current += '"'; index += 1; }
                else quoted = !quoted;
            } else if (char === delimiter && !quoted) {
                result.push(current);
                current = '';
            } else current += char;
        }
        result.push(current);
        return result;
    }

    function looksLikeTabular(text) {
        const lines = String(text || '').trim().split(/\r?\n/).filter((line) => line.trim());
        if (lines.length < 2 || lines.length > 500) return false;
        const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : null;
        if (!delimiter) return false;
        const counts = lines.map((line) => line.split('\t').length);
        return counts[0] >= 2 && counts.every((count) => count === counts[0]);
    }

    function tabularTextToMarkdown(text) {
        const lines = String(text || '').trim().split(/\r?\n/).filter((line) => line.trim());
        if (!lines.length) return '';
        const delimiter = lines.some((line) => line.includes('\t')) ? '\t' : ',';
        return convertRowsToMarkdown(lines.map((line) => parseDelimitedLine(line, delimiter)));
    }

    function stripOuterMarkdownFence(text) {
        const source = String(text || '');
        const match = source.match(/^\s*(```|~~~)\s*([^\n\r]*)\r?\n([\s\S]*?)\r?\n\1\s*$/);
        if (!match) return null;
        const language = String(match[2] || '').trim().toLowerCase();
        const content = match[3];
        const allowedLanguage = !language || ['md', 'markdown', 'mdown', 'mkd', 'text', 'txt', 'plaintext'].includes(language);
        if (!allowedLanguage) return null;
        if (!language && !/(^|\n)\s{0,3}(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|>\s|\|.+\|)|\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)/m.test(content)) return null;
        return content.replace(/^\n+|\n+$/g, '');
    }

    function normalizeInlineText(value) {
        return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n');
    }

    function htmlToMarkdownBasic(html) {
        const source = String(html || '').trim();
        if (!source) return '';
        if (!root.DOMParser) {
            const safeSource = source
                .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
                .replace(/<!--(?:[\s\S]*?)-->/g, '');
            return normalizeInlineText(
                safeSource.replace(/<br\s*\/?\s*>/gi, '\n').replace(/<[^>]+>/g, '')
            );
        }
        const document = new root.DOMParser().parseFromString(source, 'text/html');

        function walk(node, context = {}) {
            if (node.nodeType === 3) return node.nodeValue || '';
            if (node.nodeType !== 1) return '';
            const tag = node.tagName.toLowerCase();
            const children = () => Array.from(node.childNodes).map((child) => walk(child, context)).join('');
            if (['script', 'style', 'meta', 'link', 'noscript'].includes(tag)) return '';
            if (tag === 'br') return '\n';
            if (/^h[1-6]$/.test(tag)) return `${'#'.repeat(Number(tag[1]))} ${children().trim()}\n\n`;
            if (tag === 'strong' || tag === 'b') return `**${children()}**`;
            if (tag === 'em' || tag === 'i') return `*${children()}*`;
            if (tag === 'del' || tag === 's') return `~~${children()}~~`;
            if (tag === 'code' && node.parentElement && node.parentElement.tagName.toLowerCase() === 'pre') return children();
            if (tag === 'code') return `\`${children().replace(/`/g, '\\`')}\``;
            if (tag === 'pre') return `\n\n\`\`\`\n${node.textContent || ''}\n\`\`\`\n\n`;
            if (tag === 'blockquote') return `${children().trim().split(/\r?\n/).map((line) => `> ${line}`).join('\n')}\n\n`;
            if (tag === 'a') {
                const label = children().trim() || node.getAttribute('href') || '';
                const href = node.getAttribute('href') || '';
                return href ? `[${label}](${href})` : label;
            }
            if (tag === 'img') {
                const alt = node.getAttribute('alt') || '图片';
                const src = node.getAttribute('src') || '';
                return src ? `![${alt}](${src})` : '';
            }
            if (tag === 'li') {
                const parentTag = node.parentElement ? node.parentElement.tagName.toLowerCase() : '';
                const prefix = parentTag === 'ol' ? `${Array.from(node.parentElement.children).indexOf(node) + 1}. ` : '- ';
                return `${prefix}${children().trim()}\n`;
            }
            if (tag === 'ul' || tag === 'ol') return `\n${children()}\n`;
            if (tag === 'table') {
                const rows = Array.from(node.querySelectorAll('tr')).map((row) => Array.from(row.querySelectorAll('th,td')).map((cell) => cell.textContent || ''));
                return rows.length ? `\n${convertRowsToMarkdown(rows)}\n\n` : '';
            }
            if (['p', 'div', 'section', 'article', 'header', 'footer'].includes(tag)) return `${children().trim()}\n\n`;
            return children();
        }

        return normalizeInlineText(Array.from(document.body.childNodes).map((node) => walk(node)).join(''))
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }

    function detectSmartPaste(payload = {}, options = {}) {
        const text = String(payload.text || '');
        const html = String(payload.html || '');
        if (!text && !html) return { handled: false, type: 'empty', text: '' };

        const stripped = stripOuterMarkdownFence(text);
        if (stripped != null && stripped !== text) {
            return { handled: true, type: 'outer-markdown-fence', text: stripped, message: '已移除最外层 Markdown 代码围栏' };
        }

        if (looksLikeTabular(text)) {
            return { handled: true, type: 'tabular', text: tabularTextToMarkdown(text), message: '已将剪贴板表格转换为 Markdown' };
        }

        if (html && /<(?:p|div|h[1-6]|strong|b|em|i|ul|ol|li|table|a|blockquote|pre|code)\b/i.test(html)) {
            const markdown = htmlToMarkdownBasic(html);
            const plain = normalizeInlineText(text).trim();
            if (markdown && markdown !== plain) {
                return { handled: true, type: 'rich-html', text: markdown, message: '已将富文本转换为 Markdown' };
            }
        }

        if (options.normalizeLineEndings !== false && /\r\n/.test(text)) {
            return { handled: true, type: 'line-endings', text: text.replace(/\r\n/g, '\n'), message: '已统一换行格式' };
        }
        return { handled: false, type: 'plain-text', text };
    }

    function buildBackup(payload = {}) {
        const documents = Array.isArray(payload.documents) ? payload.documents.map(normalizeDocumentRecord) : [];
        return {
            format: BACKUP_FORMAT,
            version: BACKUP_VERSION,
            exportedAt: new Date().toISOString(),
            appVersion: String(payload.appVersion || ''),
            documents,
            currentDocumentId: payload.currentDocumentId || null,
            settings: payload.settings && typeof payload.settings === 'object' ? clone(payload.settings) : {},
            ai: payload.ai && typeof payload.ai === 'object' ? clone(payload.ai) : null,
            metadata: payload.metadata && typeof payload.metadata === 'object' ? clone(payload.metadata) : {}
        };
    }

    function parseBackup(input) {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (!parsed || parsed.format !== BACKUP_FORMAT || Number(parsed.version) !== BACKUP_VERSION) {
            throw new Error('备份格式不受支持');
        }
        return buildBackup(parsed);
    }

    function buildDiagnosticReport(data = {}) {
        const dependencies = Array.isArray(data.dependencies) ? data.dependencies : [];
        const lines = [
            `Markdown 转 Word 诊断报告`,
            `版本：${data.appVersion || 'unknown'}`,
            `生成时间：${new Date().toISOString()}`,
            `浏览器：${data.userAgent || ''}`,
            `存储模式：${data.storageMode || 'unknown'}`,
            `文档数量：${Number(data.documentCount || 0)}`,
            `历史版本：${Number(data.versionCount || 0)}`,
            `当前文档：${data.documentName || '未命名'}`,
            `字符数：${Number(data.characterCount || 0)}`,
            `公式数量：${Number(data.mathCount || 0)}`,
            `公式错误：${Number(data.mathErrors || 0)}`,
            `导出检查：${Number(data.preflightErrors || 0)} 错误 / ${Number(data.preflightWarnings || 0)} 提醒`,
            '',
            '依赖状态：'
        ];
        dependencies.forEach((item) => lines.push(`- ${item.name}: ${item.ready ? 'ready' : 'missing'}${item.detail ? ` (${item.detail})` : ''}`));
        return lines.join('\n');
    }

    return Object.freeze({
        BACKUP_FORMAT,
        BACKUP_VERSION,
        DEFAULT_DB_NAME,
        DEFAULT_STORE_NAME,
        DEFAULT_FALLBACK_KEY,
        createId,
        normalizeName,
        normalizeVersion,
        normalizeDocumentRecord,
        createVersionSnapshot,
        DocumentRepository,
        convertRowsToMarkdown,
        looksLikeTabular,
        tabularTextToMarkdown,
        stripOuterMarkdownFence,
        htmlToMarkdownBasic,
        detectSmartPaste,
        buildBackup,
        parseBackup,
        buildDiagnosticReport
    });
});
