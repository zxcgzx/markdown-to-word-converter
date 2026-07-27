'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const workspace = require('../js/workspace-store.js');

function storageMock(seed = {}) {
    const map = new Map(Object.entries(seed));
    return {
        getItem: (key) => map.has(key) ? map.get(key) : null,
        setItem: (key, value) => map.set(key, String(value)),
        removeItem: (key) => map.delete(key),
        snapshot: () => Object.fromEntries(map)
    };
}

test('v5.4 fallback store persists documents, versions and image assets together', async () => {
    const storage = storageMock();
    const store = workspace.createStore({ indexedDB: null, storage });
    await store.ready();
    const doc = await store.putDocument({ id: 'doc-1', name: '报告', content: '# 报告' });
    await store.putVersion({ id: 'ver-1', documentId: doc.id, documentName: doc.name, content: doc.content, reason: '手动版本' });
    const asset = await store.putAsset({ id: 'asset-1', documentId: doc.id, name: '图.png', mimeType: 'image/png', dataUrl: 'data:image/png;base64,AQID', width: 2, height: 2 });
    assert.equal((await store.listDocuments()).length, 1);
    assert.equal((await store.listVersions(doc.id)).length, 1);
    assert.equal((await store.listAssets(doc.id)).length, 1);
    assert.equal((await store.getAsset(asset.id)).width, 2);
    const diagnostics = await store.diagnostics();
    assert.equal(diagnostics.backend, 'localStorage-fallback');
    assert.deepEqual({ documents: diagnostics.documents, versions: diagnostics.versions, assets: diagnostics.assets }, { documents: 1, versions: 1, assets: 1 });
});

test('deleting a document cascades its versions and assets', async () => {
    const store = workspace.createStore({ indexedDB: null, storage: storageMock() });
    const doc = await store.putDocument({ id: 'doc-delete', name: '待删除' });
    await store.putVersion({ id: 'ver-delete', documentId: doc.id, content: 'v1' });
    await store.putAsset({ id: 'asset-delete', documentId: doc.id, dataUrl: 'data:image/png;base64,AA==' });
    await store.deleteDocument(doc.id);
    assert.equal(await store.getDocument(doc.id), null);
    assert.equal((await store.listVersions(doc.id)).length, 0);
    assert.equal((await store.listAssets(doc.id)).length, 0);
});

test('workspace backup schema v2 includes assets and imports legacy payloads without assets', async () => {
    const source = workspace.createStore({ indexedDB: null, storage: storageMock() });
    await source.putDocument({ id: 'doc-export', name: '导出文档', content: '正文' });
    await source.putAsset({ id: 'asset-export', documentId: 'doc-export', dataUrl: 'data:image/png;base64,AA==' });
    const payload = await source.exportAll();
    assert.equal(payload.version, 2);
    assert.equal(payload.assets.length, 1);

    const target = workspace.createStore({ indexedDB: null, storage: storageMock() });
    await target.importAll(payload, { replace: true });
    assert.equal((await target.listAssets('doc-export')).length, 1);

    await target.importAll({ schema: 'md2word-workspace-backup', version: 1, documents: [{ id: 'legacy-doc', name: '旧文档' }], versions: [], meta: {} }, { replace: true });
    assert.equal((await target.listDocuments()).length, 1);
    assert.equal((await target.listAssets('legacy-doc')).length, 0);
});



test('legacy IndexedDB reader converts v5.3 records without creating a replacement schema', async () => {
    let closed = false;
    const legacyRecord = {
        id: 'legacy-idb', name: '旧数据库文档', content: 'IDB 内容', view: 'editor', selectionStart: 6,
        versions: [{ id: 'legacy-idb-version', content: '历史', source: 'auto' }]
    };
    const db = {
        objectStoreNames: { contains: (name) => name === 'documents' },
        transaction(name, mode) {
            assert.equal(name, 'documents');
            assert.equal(mode, 'readonly');
            return {
                objectStore() {
                    return {
                        getAll() {
                            const request = {};
                            queueMicrotask(() => { request.result = [legacyRecord]; request.onsuccess(); });
                            return request;
                        }
                    };
                }
            };
        },
        close() { closed = true; }
    };
    const indexedDB = {
        open(name, version) {
            assert.equal(name, 'md2word-workspace-v5.3');
            assert.equal(version, 1);
            const request = { result: db };
            queueMicrotask(() => request.onsuccess());
            return request;
        }
    };
    const migrated = await workspace.readLegacyIndexedDbPayload(indexedDB);
    assert.equal(migrated.source, 'md2word-workspace-v5.3');
    assert.equal(migrated.payload.documents[0].id, 'legacy-idb');
    assert.equal(migrated.payload.documents[0].cursorStart, 6);
    assert.equal(migrated.payload.versions[0].id, 'legacy-idb-version');
    assert.equal(migrated.payload.versions[0].automatic, true);
    assert.equal(closed, true);
});

test('fallback migrates the real v5.3 document map, embedded versions and last-opened document', async () => {
    const legacy = JSON.stringify({
        old: {
            id: 'old', name: '旧草稿', content: '旧内容', view: 'preview', selectionStart: 2, selectionEnd: 4,
            versions: [{ id: 'old-version', reason: 'AI 应用前', source: 'manual', content: '更早内容', selectionStart: 1, selectionEnd: 3 }]
        }
    });
    const storage = storageMock({
        'md2word.workflow.documents.v5.3': legacy,
        'md2word.workflow.current.v5.3': 'old'
    });
    const migrated = workspace.createStore({ indexedDB: null, storage });
    const document = (await migrated.listDocuments())[0];
    assert.equal(document.id, 'old');
    assert.equal(document.cursorStart, 2);
    assert.equal(document.cursorEnd, 4);
    assert.equal(document.viewDesktop, 'preview');
    const versions = await migrated.listVersions('old');
    assert.equal(versions.length, 1);
    assert.equal(versions[0].id, 'old-version');
    assert.equal(versions[0].cursorStart, 1);
    assert.equal(await migrated.getMeta('lastDocumentId'), 'old');
    const marker = await migrated.getMeta('migration.v5.3');
    assert.deepEqual({ documents: marker.documents, versions: marker.versions, assets: marker.assets }, { documents: 1, versions: 1, assets: 0 });
    assert.ok(storage.snapshot()['md2word.workspace.fallback.v5.4']);
});

test('migration keeps newer v5.4 records and remains usable when persistent storage is unavailable', async () => {
    const current = JSON.stringify({ documents: { same: { id: 'same', name: '新版', content: 'v5.4 内容', updatedAt: 200 } }, versions: {}, assets: {}, meta: {} });
    const legacy = JSON.stringify({ same: { id: 'same', name: '旧版', content: 'v5.3 内容', updatedAt: 100 } });
    const storage = storageMock({
        'md2word.workspace.fallback.v5.4': current,
        'md2word.workflow.documents.v5.3': legacy
    });
    const store = workspace.createStore({ indexedDB: null, storage });
    assert.equal((await store.getDocument('same')).content, 'v5.4 内容');
    assert.equal((await store.getMeta('migration.v5.3')).documents, 0);

    const brokenStorage = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); }, removeItem() {} };
    const memory = workspace.createStore({ indexedDB: null, storage: brokenStorage });
    await memory.putDocument({ id: 'memory-doc', name: '临时文档' });
    assert.equal(memory.backendName, 'memory-fallback');
    assert.equal((await memory.listDocuments()).length, 1);
});
