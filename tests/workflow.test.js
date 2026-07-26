'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Workflow = require('../js/workflow.js');

class MemoryStorage {
    constructor() { this.map = new Map(); }
    getItem(key) { return this.map.has(String(key)) ? this.map.get(String(key)) : null; }
    setItem(key, value) { this.map.set(String(key), String(value)); }
    removeItem(key) { this.map.delete(String(key)); }
    clear() { this.map.clear(); }
}

test('normalizes document identity and preserves recoverable editor state', () => {
    const record = Workflow.normalizeDocumentRecord({
        id: 'doc-a',
        name: '  实验:报告?.md  ',
        content: '# 标题',
        createdAt: 100,
        updatedAt: 90,
        selectionStart: -3,
        selectionEnd: 8,
        editorScrollTop: 22,
        previewScrollTop: 33,
        view: 'preview'
    });
    assert.equal(record.id, 'doc-a');
    assert.equal(record.name, '实验-报告-');
    assert.equal(record.fileName, '实验-报告-.md');
    assert.equal(record.updatedAt, 100);
    assert.equal(record.selectionStart, 0);
    assert.equal(record.selectionEnd, 8);
    assert.equal(record.editorScrollTop, 22);
    assert.equal(record.previewScrollTop, 33);
    assert.equal(record.view, 'preview');
});

test('local-storage repository creates, lists, duplicates, versions and deletes documents', async () => {
    const storage = new MemoryStorage();
    const repository = new Workflow.DocumentRepository({ indexedDB: null, localStorage: storage, fallbackKey: 'test.documents' });
    assert.equal(await repository.init(), 'localstorage');

    const created = await repository.create({ name: '报告', content: '# 第一版', updatedAt: 1000 });
    assert.ok(created.id.startsWith('doc-'));
    assert.equal((await repository.list()).length, 1);

    const version = Workflow.createVersionSnapshot(created, '手动保存', 'manual', 1100);
    const withVersion = await repository.addVersion(created.id, version, 20);
    assert.equal(withVersion.versions.length, 1);
    assert.equal(withVersion.versions[0].reason, '手动保存');

    const duplicateVersion = Workflow.createVersionSnapshot(created, '重复内容', 'manual', 1200);
    const deduplicated = await repository.addVersion(created.id, duplicateVersion, 20);
    assert.equal(deduplicated.versions.length, 1, 'same content must not create a duplicate version');

    const duplicate = await repository.duplicate(created.id);
    assert.equal(duplicate.name, '报告 副本');
    assert.equal(duplicate.fileOrigin, 'duplicate');
    assert.equal(duplicate.versions.length, 1);
    assert.equal((await repository.list()).length, 2);

    assert.equal(await repository.remove(created.id), true);
    assert.equal(await repository.get(created.id), null);
    assert.equal((await repository.list()).length, 1);
});

test('repository falls back to memory when persistent storage is unavailable', async () => {
    const repository = new Workflow.DocumentRepository({ indexedDB: null, localStorage: null });
    assert.equal(await repository.init(), 'memory');
    const record = await repository.create({ name: '临时文档', content: '内容' });
    assert.equal((await repository.get(record.id)).content, '内容');
    await repository.clear();
    assert.deepEqual(await repository.list(), []);
});

test('import merge keeps existing documents and renames ID collisions', async () => {
    const repository = new Workflow.DocumentRepository({ indexedDB: null, localStorage: new MemoryStorage(), fallbackKey: 'merge.documents' });
    await repository.init();
    await repository.put({ id: 'same', name: '原文档', content: 'A' });
    const imported = await repository.importAll([{ id: 'same', name: '备份文档', content: 'B' }], { replace: false });
    assert.equal(imported.length, 1);
    assert.notEqual(imported[0].id, 'same');
    assert.match(imported[0].name, /导入$/);
    assert.equal((await repository.list()).length, 2);
});

test('replace import removes old documents and preserves backup IDs', async () => {
    const repository = new Workflow.DocumentRepository({ indexedDB: null, localStorage: new MemoryStorage(), fallbackKey: 'replace.documents' });
    await repository.init();
    await repository.put({ id: 'old', name: '旧文档', content: 'old' });
    const imported = await repository.importAll([{ id: 'new', name: '新文档', content: 'new' }], { replace: true });
    assert.equal(imported[0].id, 'new');
    assert.equal(await repository.get('old'), null);
    assert.equal((await repository.list()).length, 1);
});

test('smart paste removes only Markdown-like outer fences', () => {
    const markdown = '```markdown\n# 标题\n\n- 列表\n```';
    const result = Workflow.detectSmartPaste({ text: markdown });
    assert.equal(result.handled, true);
    assert.equal(result.type, 'outer-markdown-fence');
    assert.equal(result.text, '# 标题\n\n- 列表');

    const code = Workflow.detectSmartPaste({ text: '```javascript\nconsole.log(1)\n```' });
    assert.equal(code.handled, false);
    assert.match(code.text, /console\.log/);
});

test('smart paste converts a consistent TSV clipboard into a Markdown table', () => {
    const result = Workflow.detectSmartPaste({ text: '名称\t数量\n样品 A\t3\n样品 B\t5' });
    assert.equal(result.handled, true);
    assert.equal(result.type, 'tabular');
    assert.equal(result.text, '| 名称 | 数量 |\n| --- | --- |\n| 样品 A | 3 |\n| 样品 B | 5 |');
});

test('smart paste leaves ordinary prose unchanged and normalizes CRLF only when enabled', () => {
    const plain = Workflow.detectSmartPaste({ text: '普通文本，保持不变。' });
    assert.equal(plain.handled, false);
    const normalized = Workflow.detectSmartPaste({ text: '第一行\r\n第二行' });
    assert.equal(normalized.handled, true);
    assert.equal(normalized.type, 'line-endings');
    assert.equal(normalized.text, '第一行\n第二行');
});

test('basic HTML conversion safely removes scripts and keeps readable text without DOMParser', () => {
    const output = Workflow.htmlToMarkdownBasic('<p>正文<strong>重点</strong></p><script>alert(1)</script>');
    assert.doesNotMatch(output, /<[^>]+>|alert\(1\)/);
    assert.match(output, /正文重点/);
});

test('workspace backups round-trip documents, settings and optional AI configuration', () => {
    const backup = Workflow.buildBackup({
        appVersion: '5.3',
        documents: [{ id: 'doc-1', name: '报告', content: '# 内容' }],
        currentDocumentId: 'doc-1',
        settings: { smartPaste: true },
        ai: { provider: 'custom', key: '' },
        metadata: { storageMode: 'indexeddb' }
    });
    assert.equal(backup.format, Workflow.BACKUP_FORMAT);
    const parsed = Workflow.parseBackup(JSON.stringify(backup));
    assert.equal(parsed.documents.length, 1);
    assert.equal(parsed.documents[0].name, '报告');
    assert.equal(parsed.currentDocumentId, 'doc-1');
    assert.equal(parsed.settings.smartPaste, true);
    assert.throws(() => Workflow.parseBackup('{"format":"other","version":1}'), /备份格式不受支持/);
});

test('diagnostic report summarizes storage, document, formula and dependency state', () => {
    const report = Workflow.buildDiagnosticReport({
        appVersion: '5.3', storageMode: 'indexeddb', documentCount: 3, versionCount: 7,
        documentName: '实验报告', characterCount: 1200, mathCount: 4, mathErrors: 1,
        preflightErrors: 1, preflightWarnings: 2,
        dependencies: [{ name: 'KaTeX', ready: true, detail: '公式渲染' }, { name: 'docx.js', ready: false }]
    });
    assert.match(report, /版本：5\.3/);
    assert.match(report, /文档数量：3/);
    assert.match(report, /历史版本：7/);
    assert.match(report, /公式错误：1/);
    assert.match(report, /KaTeX: ready/);
    assert.match(report, /docx\.js: missing/);
});

test('normalizes a filename extension even when surrounding whitespace is present', () => {
    assert.equal(Workflow.normalizeName('  研究记录.md  '), '研究记录');
    assert.equal(Workflow.normalizeName('  数据汇总.DOCX  '), '数据汇总');
});

test('IndexedDB writes resolve only after the readwrite transaction completes', async () => {
    let transaction;
    const repository = new Workflow.DocumentRepository({ indexedDB: null, localStorage: null });
    repository.mode = 'indexeddb';
    repository.db = {
        transaction() {
            transaction = {
                error: null,
                objectStore() {
                    return {
                        put(value) {
                            const request = { result: value, error: null };
                            queueMicrotask(() => request.onsuccess && request.onsuccess());
                            return request;
                        }
                    };
                }
            };
            return transaction;
        }
    };

    let resolved = false;
    const pending = repository.put({ id: 'durable', name: '事务完成', content: '内容' }).then((record) => {
        resolved = true;
        return record;
    });
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(resolved, false, 'request success alone must not report a durable write');
    transaction.oncomplete();
    const record = await pending;
    assert.equal(resolved, true);
    assert.equal(record.id, 'durable');
});
