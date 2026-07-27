(function (root, factory) {
    'use strict';
    const api = factory(root || globalThis);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordWorkspaceStore = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const DB_NAME = 'md2word.workspace.v5.4';
    const DB_VERSION = 2;
    const FALLBACK_KEY = 'md2word.workspace.fallback.v5.4';
    const LEGACY_DB_NAME = 'md2word-workspace-v5.3';
    const LEGACY_STORE_NAME = 'documents';
    const LEGACY_CURRENT_DOCUMENT_KEY = 'md2word.workflow.current.v5.3';
    const LEGACY_MIGRATION_META_KEY = 'migration.v5.3';
    const LEGACY_FALLBACK_KEYS = Object.freeze(['md2word.workflow.documents.v5.3', 'md2word.workspace.fallback.v5.3']);
    const MAX_VERSIONS_PER_DOCUMENT = 30;
    const MAX_ASSETS_PER_DOCUMENT = 200;

    const now = () => Date.now();
    const makeId = (prefix = 'item') => {
        try {
            if (root.crypto && typeof root.crypto.randomUUID === 'function') return `${prefix}-${root.crypto.randomUUID()}`;
        } catch (_error) { /* fallback below */ }
        return `${prefix}-${now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
    };
    const clone = (value) => {
        if (value == null) return value;
        try {
            if (typeof structuredClone === 'function') return structuredClone(value);
        } catch (_error) { /* JSON fallback */ }
        return JSON.parse(JSON.stringify(value));
    };

    function normalizeDocument(input = {}) {
        const timestamp = now();
        const name = String(input.name || input.documentName || '未命名').trim().slice(0, 80) || '未命名';
        const createdAt = Number(input.createdAt) || timestamp;
        const updatedAt = Number(input.updatedAt) || timestamp;
        return {
            id: String(input.id || makeId('doc')),
            name,
            fileName: String(input.fileName || `${name}.md`),
            content: String(input.content || ''),
            createdAt,
            updatedAt,
            lastOpenedAt: Number(input.lastOpenedAt) || updatedAt,
            fileOrigin: String(input.fileOrigin || 'draft'),
            fileSyncedAt: Number(input.fileSyncedAt) || null,
            fileDirty: typeof input.fileDirty === 'boolean' ? input.fileDirty : true,
            cursorStart: Math.max(0, Number(input.cursorStart) || 0),
            cursorEnd: Math.max(0, Number(input.cursorEnd) || 0),
            editorScrollTop: Math.max(0, Number(input.editorScrollTop) || 0),
            previewScrollTop: Math.max(0, Number(input.previewScrollTop) || 0),
            viewDesktop: ['editor', 'split', 'preview'].includes(input.viewDesktop) ? input.viewDesktop : 'split',
            viewMobile: ['editor', 'split', 'preview'].includes(input.viewMobile) ? input.viewMobile : 'editor',
            splitDesktop: Number.isFinite(Number(input.splitDesktop)) ? Number(input.splitDesktop) : 50,
            splitMobile: Number.isFinite(Number(input.splitMobile)) ? Number(input.splitMobile) : 50,
            favorite: Boolean(input.favorite),
            schemaVersion: 2
        };
    }

    function normalizeVersion(input = {}) {
        const timestamp = now();
        const content = String(input.content || '');
        return {
            id: String(input.id || makeId('ver')),
            documentId: String(input.documentId || ''),
            documentName: String(input.documentName || input.name || '未命名').trim().slice(0, 80) || '未命名',
            content,
            reason: String(input.reason || '自动快照').trim().slice(0, 120) || '自动快照',
            createdAt: Number(input.createdAt) || timestamp,
            automatic: input.automatic !== false,
            cursorStart: Math.max(0, Number(input.cursorStart) || 0),
            cursorEnd: Math.max(0, Number(input.cursorEnd) || 0),
            size: Number(input.size) || content.length,
            schemaVersion: 2
        };
    }

    function normalizeAsset(input = {}) {
        const timestamp = now();
        const dataUrl = String(input.dataUrl || input.data || '');
        const name = String(input.name || input.fileName || '图片').trim().slice(0, 160) || '图片';
        const mimeType = String(input.mimeType || (dataUrl.match(/^data:([^;,]+)/i) || [])[1] || 'image/png').toLowerCase();
        return {
            id: String(input.id || makeId('asset')),
            documentId: String(input.documentId || ''),
            name,
            alt: String(input.alt || name.replace(/\.[^.]+$/, '') || '图片').trim().slice(0, 240),
            mimeType,
            dataUrl,
            sourceUrl: String(input.sourceUrl || '').slice(0, 4096),
            width: Math.max(0, Number(input.width) || 0),
            height: Math.max(0, Number(input.height) || 0),
            size: Math.max(0, Number(input.size) || Math.ceil(dataUrl.length * 0.75)),
            createdAt: Number(input.createdAt) || timestamp,
            updatedAt: Number(input.updatedAt) || timestamp,
            schemaVersion: 2
        };
    }

    function createMemoryStorage() {
        const map = new Map();
        return {
            getItem: (key) => map.has(key) ? map.get(key) : null,
            setItem: (key, value) => map.set(key, String(value)),
            removeItem: (key) => map.delete(key)
        };
    }

    function canUseStorage(storage, key) {
        if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') return false;
        const probe = `${key}.probe.${Math.random().toString(36).slice(2)}`;
        try {
            storage.setItem(probe, '1');
            if (storage.removeItem) storage.removeItem(probe);
            return true;
        } catch (_error) {
            try { if (storage.removeItem) storage.removeItem(probe); } catch (_ignored) { /* ignore */ }
            return false;
        }
    }

    function emptyFallbackData() {
        return { documents: {}, versions: {}, assets: {}, meta: {} };
    }

    function normalizeLegacyWorkspace(input, source = 'v5.3') {
        const parsed = typeof input === 'string' ? JSON.parse(input) : input;
        if (!parsed || typeof parsed !== 'object') return null;

        let documentEntries = [];
        let separateVersions = [];
        let separateAssets = [];
        let legacyMeta = {};

        if (Array.isArray(parsed.documents)) documentEntries = parsed.documents.map((item) => [item && item.id, item]);
        else if (parsed.documents && typeof parsed.documents === 'object') documentEntries = Object.entries(parsed.documents);
        else if (parsed.format === 'md2word-workspace-backup' && Array.isArray(parsed.documents)) documentEntries = parsed.documents.map((item) => [item && item.id, item]);
        else {
            documentEntries = Object.entries(parsed).filter(([, item]) => item && typeof item === 'object' && ('content' in item || 'name' in item || 'versions' in item));
        }

        if (Array.isArray(parsed.versions)) separateVersions = parsed.versions;
        else if (parsed.versions && typeof parsed.versions === 'object') separateVersions = Object.values(parsed.versions);
        if (Array.isArray(parsed.assets)) separateAssets = parsed.assets;
        else if (parsed.assets && typeof parsed.assets === 'object') separateAssets = Object.values(parsed.assets);
        if (parsed.meta && typeof parsed.meta === 'object') legacyMeta = clone(parsed.meta);

        const documents = [];
        const versions = [];
        const documentIds = new Set();
        const versionIds = new Set();

        for (const [entryId, rawValue] of documentEntries) {
            if (!rawValue || typeof rawValue !== 'object') continue;
            const raw = { ...rawValue, id: rawValue.id || entryId };
            const document = normalizeDocument({
                ...raw,
                cursorStart: raw.cursorStart ?? raw.selectionStart,
                cursorEnd: raw.cursorEnd ?? raw.selectionEnd,
                viewDesktop: raw.viewDesktop || raw.view,
                viewMobile: raw.viewMobile || 'editor',
                fileOrigin: raw.fileOrigin || `${source}-migration`
            });
            if (!document.id || documentIds.has(document.id)) continue;
            documentIds.add(document.id);
            documents.push(document);
            if (Array.isArray(raw.versions)) {
                raw.versions.forEach((legacyVersion, index) => {
                    if (!legacyVersion || typeof legacyVersion !== 'object') return;
                    const version = normalizeVersion({
                        ...legacyVersion,
                        id: legacyVersion.id || makeId('ver'),
                        documentId: document.id,
                        documentName: legacyVersion.documentName || document.name,
                        cursorStart: legacyVersion.cursorStart ?? legacyVersion.selectionStart,
                        cursorEnd: legacyVersion.cursorEnd ?? legacyVersion.selectionEnd,
                        automatic: typeof legacyVersion.automatic === 'boolean'
                            ? legacyVersion.automatic
                            : ['auto', 'automatic'].includes(String(legacyVersion.source || '').toLowerCase()),
                        createdAt: Number(legacyVersion.createdAt) || document.updatedAt - index
                    });
                    if (!versionIds.has(version.id)) { versionIds.add(version.id); versions.push(version); }
                });
            }
        }

        for (const raw of separateVersions) {
            if (!raw || typeof raw !== 'object') continue;
            const version = normalizeVersion({
                ...raw,
                cursorStart: raw.cursorStart ?? raw.selectionStart,
                cursorEnd: raw.cursorEnd ?? raw.selectionEnd,
                automatic: typeof raw.automatic === 'boolean' ? raw.automatic : ['auto', 'automatic'].includes(String(raw.source || '').toLowerCase())
            });
            if (version.documentId && documentIds.has(version.documentId) && !versionIds.has(version.id)) {
                versionIds.add(version.id);
                versions.push(version);
            }
        }

        const assets = separateAssets.map(normalizeAsset).filter((asset) => asset.documentId && documentIds.has(asset.documentId) && asset.dataUrl);
        if (!documents.length && !versions.length && !assets.length) return null;
        return {
            schema: 'md2word-workspace-backup', version: 2, exportedAt: now(),
            documents, versions, assets,
            meta: { ...legacyMeta, migrationSource: source }
        };
    }

    function mergeLegacyPayloads(payloads) {
        const documents = new Map();
        const versions = new Map();
        const assets = new Map();
        const sources = [];
        for (const item of payloads.filter(Boolean)) {
            if (item.source) sources.push(item.source);
            for (const document of item.payload.documents || []) {
                const current = documents.get(document.id);
                if (!current || Number(document.updatedAt) >= Number(current.updatedAt)) documents.set(document.id, normalizeDocument(document));
            }
            for (const version of item.payload.versions || []) if (!versions.has(version.id)) versions.set(version.id, normalizeVersion(version));
            for (const asset of item.payload.assets || []) if (!assets.has(asset.id)) assets.set(asset.id, normalizeAsset(asset));
        }
        return {
            payload: {
                schema: 'md2word-workspace-backup', version: 2, exportedAt: now(),
                documents: Array.from(documents.values()), versions: Array.from(versions.values()), assets: Array.from(assets.values()), meta: {}
            },
            sources: Array.from(new Set(sources))
        };
    }

    function readLegacyFallbackPayloads(storage) {
        if (!storage || typeof storage.getItem !== 'function') return [];
        const results = [];
        for (const key of LEGACY_FALLBACK_KEYS) {
            try {
                const raw = storage.getItem(key);
                if (!raw) continue;
                const payload = normalizeLegacyWorkspace(raw, key);
                if (payload) results.push({ source: key, payload });
            } catch (_error) { /* corrupt legacy data must not block startup */ }
        }
        return results;
    }

    function readLegacyIndexedDbPayload(indexedDBApi) {
        if (!indexedDBApi || typeof indexedDBApi.open !== 'function') return Promise.resolve(null);
        return new Promise((resolve) => {
            let settled = false;
            let createdDuringProbe = false;
            const finish = (value) => { if (!settled) { settled = true; resolve(value); } };
            let request;
            try { request = indexedDBApi.open(LEGACY_DB_NAME, 1); }
            catch (_error) { finish(null); return; }
            request.onupgradeneeded = () => {
                createdDuringProbe = true;
                try { request.transaction.abort(); } catch (_error) { /* best effort */ }
            };
            request.onerror = () => finish(null);
            request.onblocked = () => finish(null);
            request.onsuccess = () => {
                const db = request.result;
                if (createdDuringProbe || !db.objectStoreNames.contains(LEGACY_STORE_NAME)) { try { db.close(); } catch (_error) {} finish(null); return; }
                let tx;
                try { tx = db.transaction(LEGACY_STORE_NAME, 'readonly'); }
                catch (_error) { try { db.close(); } catch (_ignored) {} finish(null); return; }
                const getAllRequest = tx.objectStore(LEGACY_STORE_NAME).getAll();
                getAllRequest.onsuccess = () => {
                    const payload = normalizeLegacyWorkspace({ documents: getAllRequest.result || [] }, LEGACY_DB_NAME);
                    try { db.close(); } catch (_error) {}
                    finish(payload ? { source: LEGACY_DB_NAME, payload } : null);
                };
                getAllRequest.onerror = () => { try { db.close(); } catch (_error) {} finish(null); };
                tx.onabort = () => { try { db.close(); } catch (_error) {} finish(null); };
                tx.onerror = () => { try { db.close(); } catch (_error) {} finish(null); };
            };
        });
    }

    async function migrateLegacyWorkspace(backend, options = {}) {
        let marker = null;
        try { marker = await backend.getMeta(LEGACY_MIGRATION_META_KEY); } catch (_error) { /* retry migration */ }
        if (marker && marker.completed) return marker;

        const collected = readLegacyFallbackPayloads(options.storage);
        const indexedPayload = await readLegacyIndexedDbPayload(options.indexedDBApi);
        if (indexedPayload) collected.push(indexedPayload);
        const merged = mergeLegacyPayloads(collected);
        const existing = await backend.listDocuments({ limit: 10000 });
        const existingIds = new Set(existing.map((document) => document.id));
        const documents = merged.payload.documents.filter((document) => !existingIds.has(document.id));
        const importedIds = new Set(documents.map((document) => document.id));
        const versions = merged.payload.versions.filter((version) => importedIds.has(version.documentId));
        const assets = merged.payload.assets.filter((asset) => importedIds.has(asset.documentId));

        if (documents.length) {
            await backend.importAll({ ...merged.payload, documents, versions, assets }, { replace: false });
        }

        let legacyCurrentId = '';
        try { legacyCurrentId = String(options.storage?.getItem?.(LEGACY_CURRENT_DOCUMENT_KEY) || ''); } catch (_error) { legacyCurrentId = ''; }
        const availableIds = new Set([...existingIds, ...importedIds]);
        if (legacyCurrentId && availableIds.has(legacyCurrentId)) {
            try { await backend.setMeta('lastDocumentId', legacyCurrentId); } catch (_error) { /* optional */ }
        }

        const result = {
            completed: true,
            migratedAt: now(),
            sources: merged.sources,
            documents: documents.length,
            versions: versions.length,
            assets: assets.length,
            lastDocumentId: legacyCurrentId && availableIds.has(legacyCurrentId) ? legacyCurrentId : null
        };
        try { await backend.setMeta(LEGACY_MIGRATION_META_KEY, result); } catch (_error) { /* migration data is already imported */ }
        return result;
    }

    function createFallbackBackend(storage, key = FALLBACK_KEY) {
        const persistent = canUseStorage(storage, key);
        const target = persistent ? storage : createMemoryStorage();
        const name = persistent ? 'localStorage-fallback' : 'memory-fallback';
        const read = () => {
            try {
                const parsed = JSON.parse(target.getItem(key) || '{}');
                return {
                    documents: parsed.documents && typeof parsed.documents === 'object' ? parsed.documents : {},
                    versions: parsed.versions && typeof parsed.versions === 'object' ? parsed.versions : {},
                    assets: parsed.assets && typeof parsed.assets === 'object' ? parsed.assets : {},
                    meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : {}
                };
            } catch (_error) {
                return emptyFallbackData();
            }
        };
        const write = (data) => {
            try { target.setItem(key, JSON.stringify(data)); }
            catch (_error) { throw new Error('浏览器本地存储不可用或空间不足'); }
        };
        async function pruneVersions(documentId) {
            const data = read();
            const matches = Object.values(data.versions).filter((item) => item.documentId === documentId).sort((a, b) => b.createdAt - a.createdAt);
            matches.slice(MAX_VERSIONS_PER_DOCUMENT).forEach((item) => delete data.versions[item.id]);
            write(data);
        }
        return {
            name,
            async getDocument(id) { return clone(read().documents[id] || null); },
            async putDocument(input) {
                const data = read();
                const previous = input.id ? data.documents[input.id] : null;
                const doc = normalizeDocument({ ...(previous || {}), ...input });
                data.documents[doc.id] = doc;
                write(data);
                return clone(doc);
            },
            async listDocuments(options = {}) {
                const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
                return Object.values(read().documents)
                    .filter((doc) => !query || `${doc.name}\n${doc.content}`.toLocaleLowerCase('zh-CN').includes(query))
                    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
                    .slice(0, Math.max(1, Number(options.limit) || 200)).map((item) => normalizeDocument(item));
            },
            async deleteDocument(id) {
                const data = read();
                delete data.documents[id];
                Object.keys(data.versions).forEach((versionId) => { if (data.versions[versionId].documentId === id) delete data.versions[versionId]; });
                Object.keys(data.assets).forEach((assetId) => { if (data.assets[assetId].documentId === id) delete data.assets[assetId]; });
                write(data);
                return true;
            },
            async putVersion(input, options = {}) {
                const data = read();
                const version = normalizeVersion(input);
                if (!version.documentId) throw new Error('版本缺少文档 ID');
                const latest = Object.values(data.versions).filter((item) => item.documentId === version.documentId).sort((a, b) => b.createdAt - a.createdAt)[0];
                if (!options.force && latest && latest.content === version.content && latest.reason === version.reason) return clone(latest);
                data.versions[version.id] = version;
                write(data);
                await pruneVersions(version.documentId);
                return clone(version);
            },
            async listVersions(documentId, options = {}) {
                return Object.values(read().versions).filter((item) => item.documentId === documentId)
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, Math.max(1, Number(options.limit) || MAX_VERSIONS_PER_DOCUMENT)).map((item) => normalizeVersion(item));
            },
            async getVersion(id) { const item = read().versions[id]; return item ? normalizeVersion(item) : null; },
            async deleteVersion(id) { const data = read(); delete data.versions[id]; write(data); return true; },
            async getAsset(id) { const item = read().assets[id]; return item ? normalizeAsset(item) : null; },
            async putAsset(input) {
                const data = read();
                const previous = input.id ? data.assets[input.id] : null;
                const asset = normalizeAsset({ ...(previous || {}), ...input, updatedAt: now() });
                if (!asset.documentId) throw new Error('图片素材缺少文档 ID');
                const count = Object.values(data.assets).filter((item) => item.documentId === asset.documentId && item.id !== asset.id).length;
                if (count >= MAX_ASSETS_PER_DOCUMENT) throw new Error(`单个文档最多保存 ${MAX_ASSETS_PER_DOCUMENT} 个图片素材`);
                data.assets[asset.id] = asset;
                write(data);
                return clone(asset);
            },
            async listAssets(documentId, options = {}) {
                const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
                return Object.values(read().assets).filter((item) => item.documentId === documentId && (!query || `${item.name}\n${item.alt}`.toLocaleLowerCase('zh-CN').includes(query)))
                    .sort((a, b) => b.updatedAt - a.updatedAt).slice(0, Math.max(1, Number(options.limit) || MAX_ASSETS_PER_DOCUMENT)).map((item) => normalizeAsset(item));
            },
            async deleteAsset(id) { const data = read(); delete data.assets[id]; write(data); return true; },
            async deleteAssetsByDocument(documentId) {
                const data = read(); let removed = 0;
                Object.keys(data.assets).forEach((id) => { if (data.assets[id].documentId === documentId) { delete data.assets[id]; removed += 1; } });
                write(data); return removed;
            },
            async getMeta(keyName) { return clone(read().meta[keyName]); },
            async setMeta(keyName, value) { const data = read(); data.meta[keyName] = clone(value); write(data); return clone(value); },
            async exportAll() {
                const data = read();
                return {
                    schema: 'md2word-workspace-backup', version: 2, exportedAt: now(),
                    documents: Object.values(data.documents).map((item) => normalizeDocument(item)),
                    versions: Object.values(data.versions).map((item) => normalizeVersion(item)),
                    assets: Object.values(data.assets).map((item) => normalizeAsset(item)),
                    meta: clone(data.meta)
                };
            },
            async importAll(payload, options = {}) {
                if (!payload || payload.schema !== 'md2word-workspace-backup') throw new Error('不支持的文档中心备份格式');
                const data = options.replace ? emptyFallbackData() : read();
                (payload.documents || []).forEach((item) => { const doc = normalizeDocument(item); data.documents[doc.id] = doc; });
                (payload.versions || []).forEach((item) => { const version = normalizeVersion(item); if (version.documentId) data.versions[version.id] = version; });
                (payload.assets || []).forEach((item) => { const asset = normalizeAsset(item); if (asset.documentId && asset.dataUrl) data.assets[asset.id] = asset; });
                if (payload.meta && typeof payload.meta === 'object') data.meta = { ...data.meta, ...clone(payload.meta) };
                write(data);
                for (const id of Object.keys(data.documents)) await pruneVersions(id);
                return { documents: Object.keys(data.documents).length, versions: Object.keys(data.versions).length, assets: Object.keys(data.assets).length };
            },
            async clearAll() { write(emptyFallbackData()); return true; },
            async diagnostics() {
                const data = read();
                const payload = JSON.stringify(data);
                return {
                    backend: name,
                    documents: Object.keys(data.documents).length,
                    versions: Object.keys(data.versions).length,
                    assets: Object.keys(data.assets).length,
                    approximateBytes: payload.length * 2
                };
            }
        };
    }

    function requestToPromise(request) {
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败'));
        });
    }
    function transactionDone(tx) {
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error || new Error('IndexedDB 事务失败'));
            tx.onabort = () => reject(tx.error || new Error('IndexedDB 事务已中止'));
        });
    }

    function openDatabase(indexedDBApi) {
        return new Promise((resolve, reject) => {
            const request = indexedDBApi.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains('documents')) {
                    const store = db.createObjectStore('documents', { keyPath: 'id' });
                    store.createIndex('updatedAt', 'updatedAt');
                }
                if (!db.objectStoreNames.contains('versions')) {
                    const store = db.createObjectStore('versions', { keyPath: 'id' });
                    store.createIndex('documentId', 'documentId');
                    store.createIndex('createdAt', 'createdAt');
                }
                if (!db.objectStoreNames.contains('assets')) {
                    const store = db.createObjectStore('assets', { keyPath: 'id' });
                    store.createIndex('documentId', 'documentId');
                    store.createIndex('updatedAt', 'updatedAt');
                }
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败'));
            request.onblocked = () => reject(new Error('IndexedDB 被其他页面阻塞'));
        });
    }

    function createIndexedBackend(db) {
        const getAll = async (storeName) => {
            const tx = db.transaction(storeName, 'readonly');
            const result = await requestToPromise(tx.objectStore(storeName).getAll());
            await transactionDone(tx);
            return result || [];
        };
        async function pruneVersions(documentId) {
            const versions = (await getAll('versions')).filter((item) => item.documentId === documentId).sort((a, b) => b.createdAt - a.createdAt);
            if (versions.length <= MAX_VERSIONS_PER_DOCUMENT) return;
            const tx = db.transaction('versions', 'readwrite');
            versions.slice(MAX_VERSIONS_PER_DOCUMENT).forEach((item) => tx.objectStore('versions').delete(item.id));
            await transactionDone(tx);
        }
        return {
            name: 'indexedDB',
            async getDocument(id) {
                const tx = db.transaction('documents', 'readonly');
                const result = await requestToPromise(tx.objectStore('documents').get(id));
                await transactionDone(tx);
                return result ? normalizeDocument(result) : null;
            },
            async putDocument(input) {
                let previous = null;
                if (input.id) {
                    const readTx = db.transaction('documents', 'readonly');
                    previous = await requestToPromise(readTx.objectStore('documents').get(input.id));
                    await transactionDone(readTx);
                }
                const doc = normalizeDocument({ ...(previous || {}), ...input });
                const tx = db.transaction('documents', 'readwrite');
                tx.objectStore('documents').put(doc);
                await transactionDone(tx);
                return clone(doc);
            },
            async listDocuments(options = {}) {
                const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
                return (await getAll('documents'))
                    .filter((doc) => !query || `${doc.name}\n${doc.content}`.toLocaleLowerCase('zh-CN').includes(query))
                    .sort((a, b) => Number(b.favorite) - Number(a.favorite) || b.updatedAt - a.updatedAt)
                    .slice(0, Math.max(1, Number(options.limit) || 200)).map(normalizeDocument);
            },
            async deleteDocument(id) {
                const tx = db.transaction(['documents', 'versions', 'assets'], 'readwrite');
                tx.objectStore('documents').delete(id);
                const versions = await requestToPromise(tx.objectStore('versions').getAll());
                versions.filter((item) => item.documentId === id).forEach((item) => tx.objectStore('versions').delete(item.id));
                const assets = await requestToPromise(tx.objectStore('assets').getAll());
                assets.filter((item) => item.documentId === id).forEach((item) => tx.objectStore('assets').delete(item.id));
                await transactionDone(tx);
                return true;
            },
            async putVersion(input, options = {}) {
                const version = normalizeVersion(input);
                if (!version.documentId) throw new Error('版本缺少文档 ID');
                const current = await this.listVersions(version.documentId);
                if (!options.force && current[0] && current[0].content === version.content && current[0].reason === version.reason) return current[0];
                const tx = db.transaction('versions', 'readwrite');
                tx.objectStore('versions').put(version);
                await transactionDone(tx);
                await pruneVersions(version.documentId);
                return clone(version);
            },
            async listVersions(documentId, options = {}) {
                return (await getAll('versions')).filter((item) => item.documentId === documentId)
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, Math.max(1, Number(options.limit) || MAX_VERSIONS_PER_DOCUMENT)).map(normalizeVersion);
            },
            async getVersion(id) {
                const tx = db.transaction('versions', 'readonly');
                const result = await requestToPromise(tx.objectStore('versions').get(id));
                await transactionDone(tx);
                return result ? normalizeVersion(result) : null;
            },
            async deleteVersion(id) { const tx = db.transaction('versions', 'readwrite'); tx.objectStore('versions').delete(id); await transactionDone(tx); return true; },
            async getAsset(id) {
                const tx = db.transaction('assets', 'readonly');
                const result = await requestToPromise(tx.objectStore('assets').get(id));
                await transactionDone(tx);
                return result ? normalizeAsset(result) : null;
            },
            async putAsset(input) {
                const asset = normalizeAsset({ ...input, updatedAt: now() });
                if (!asset.documentId) throw new Error('图片素材缺少文档 ID');
                const existing = await this.listAssets(asset.documentId, { limit: MAX_ASSETS_PER_DOCUMENT + 1 });
                if (!existing.some((item) => item.id === asset.id) && existing.length >= MAX_ASSETS_PER_DOCUMENT) throw new Error(`单个文档最多保存 ${MAX_ASSETS_PER_DOCUMENT} 个图片素材`);
                const tx = db.transaction('assets', 'readwrite');
                tx.objectStore('assets').put(asset);
                await transactionDone(tx);
                return clone(asset);
            },
            async listAssets(documentId, options = {}) {
                const query = String(options.query || '').trim().toLocaleLowerCase('zh-CN');
                return (await getAll('assets')).filter((item) => item.documentId === documentId && (!query || `${item.name}\n${item.alt}`.toLocaleLowerCase('zh-CN').includes(query)))
                    .sort((a, b) => b.updatedAt - a.updatedAt)
                    .slice(0, Math.max(1, Number(options.limit) || MAX_ASSETS_PER_DOCUMENT)).map(normalizeAsset);
            },
            async deleteAsset(id) { const tx = db.transaction('assets', 'readwrite'); tx.objectStore('assets').delete(id); await transactionDone(tx); return true; },
            async deleteAssetsByDocument(documentId) {
                const assets = (await getAll('assets')).filter((item) => item.documentId === documentId);
                if (!assets.length) return 0;
                const tx = db.transaction('assets', 'readwrite');
                assets.forEach((item) => tx.objectStore('assets').delete(item.id));
                await transactionDone(tx);
                return assets.length;
            },
            async getMeta(keyName) {
                const tx = db.transaction('meta', 'readonly');
                const result = await requestToPromise(tx.objectStore('meta').get(keyName));
                await transactionDone(tx);
                return result ? clone(result.value) : null;
            },
            async setMeta(keyName, value) {
                const tx = db.transaction('meta', 'readwrite');
                tx.objectStore('meta').put({ key: keyName, value: clone(value), updatedAt: now() });
                await transactionDone(tx);
                return clone(value);
            },
            async exportAll() {
                const [documents, versions, assets, metaRows] = await Promise.all([getAll('documents'), getAll('versions'), getAll('assets'), getAll('meta')]);
                const meta = {};
                metaRows.forEach((row) => { meta[row.key] = clone(row.value); });
                return {
                    schema: 'md2word-workspace-backup', version: 2, exportedAt: now(),
                    documents: documents.map(normalizeDocument), versions: versions.map(normalizeVersion), assets: assets.map(normalizeAsset), meta
                };
            },
            async importAll(payload, options = {}) {
                if (!payload || payload.schema !== 'md2word-workspace-backup') throw new Error('不支持的文档中心备份格式');
                const tx = db.transaction(['documents', 'versions', 'assets', 'meta'], 'readwrite');
                if (options.replace) {
                    tx.objectStore('documents').clear();
                    tx.objectStore('versions').clear();
                    tx.objectStore('assets').clear();
                    tx.objectStore('meta').clear();
                }
                (payload.documents || []).forEach((item) => tx.objectStore('documents').put(normalizeDocument(item)));
                (payload.versions || []).forEach((item) => { const version = normalizeVersion(item); if (version.documentId) tx.objectStore('versions').put(version); });
                (payload.assets || []).forEach((item) => { const asset = normalizeAsset(item); if (asset.documentId && asset.dataUrl) tx.objectStore('assets').put(asset); });
                if (payload.meta && typeof payload.meta === 'object') Object.entries(payload.meta).forEach(([key, value]) => tx.objectStore('meta').put({ key, value: clone(value), updatedAt: now() }));
                await transactionDone(tx);
                for (const doc of payload.documents || []) await pruneVersions(String(doc.id || ''));
                return this.diagnostics();
            },
            async clearAll() {
                const tx = db.transaction(['documents', 'versions', 'assets', 'meta'], 'readwrite');
                tx.objectStore('documents').clear();
                tx.objectStore('versions').clear();
                tx.objectStore('assets').clear();
                tx.objectStore('meta').clear();
                await transactionDone(tx);
                return true;
            },
            async diagnostics() {
                const [documents, versions, assets] = await Promise.all([getAll('documents'), getAll('versions'), getAll('assets')]);
                return {
                    backend: 'indexedDB', documents: documents.length, versions: versions.length, assets: assets.length,
                    approximateBytes: JSON.stringify({ documents, versions, assets }).length * 2
                };
            }
        };
    }

    function createStore(options = {}) {
        let backend = null;
        let readyPromise = null;
        let lastError = null;
        let indexedDBApi = options.indexedDB;
        let storage = options.storage;
        if (indexedDBApi === undefined) { try { indexedDBApi = root.indexedDB; } catch (_error) { indexedDBApi = null; } }
        if (storage === undefined) { try { storage = root.localStorage; } catch (_error) { storage = null; } }
        const ensureBackend = async () => {
            if (backend) return backend;
            if (!readyPromise) {
                readyPromise = (async () => {
                    if (indexedDBApi && typeof indexedDBApi.open === 'function') {
                        try { backend = createIndexedBackend(await openDatabase(indexedDBApi)); }
                        catch (error) { lastError = error; }
                    }
                    if (!backend) backend = createFallbackBackend(storage, options.fallbackKey || FALLBACK_KEY);
                    try { await migrateLegacyWorkspace(backend, { indexedDBApi, storage }); }
                    catch (error) { lastError = lastError || error; }
                    return backend;
                })();
            }
            return readyPromise;
        };
        const call = async (method, ...args) => (await ensureBackend())[method](...args);
        return {
            ready: ensureBackend,
            makeId,
            get backendName() { return backend ? backend.name : 'pending'; },
            get lastError() { return lastError; },
            getDocument: (...args) => call('getDocument', ...args),
            putDocument: (...args) => call('putDocument', ...args),
            listDocuments: (...args) => call('listDocuments', ...args),
            deleteDocument: (...args) => call('deleteDocument', ...args),
            putVersion: (...args) => call('putVersion', ...args),
            listVersions: (...args) => call('listVersions', ...args),
            getVersion: (...args) => call('getVersion', ...args),
            deleteVersion: (...args) => call('deleteVersion', ...args),
            getAsset: (...args) => call('getAsset', ...args),
            putAsset: (...args) => call('putAsset', ...args),
            listAssets: (...args) => call('listAssets', ...args),
            deleteAsset: (...args) => call('deleteAsset', ...args),
            deleteAssetsByDocument: (...args) => call('deleteAssetsByDocument', ...args),
            getMeta: (...args) => call('getMeta', ...args),
            setMeta: (...args) => call('setMeta', ...args),
            exportAll: (...args) => call('exportAll', ...args),
            importAll: (...args) => call('importAll', ...args),
            clearAll: (...args) => call('clearAll', ...args),
            diagnostics: async () => ({ ...(await call('diagnostics')), lastError: lastError ? String(lastError.message || lastError) : '' })
        };
    }

    const defaultStore = createStore();
    return Object.freeze({
        ready: (...args) => defaultStore.ready(...args),
        makeId,
        get backendName() { return defaultStore.backendName; },
        get lastError() { return defaultStore.lastError; },
        getDocument: (...args) => defaultStore.getDocument(...args),
        putDocument: (...args) => defaultStore.putDocument(...args),
        listDocuments: (...args) => defaultStore.listDocuments(...args),
        deleteDocument: (...args) => defaultStore.deleteDocument(...args),
        putVersion: (...args) => defaultStore.putVersion(...args),
        listVersions: (...args) => defaultStore.listVersions(...args),
        getVersion: (...args) => defaultStore.getVersion(...args),
        deleteVersion: (...args) => defaultStore.deleteVersion(...args),
        getAsset: (...args) => defaultStore.getAsset(...args),
        putAsset: (...args) => defaultStore.putAsset(...args),
        listAssets: (...args) => defaultStore.listAssets(...args),
        deleteAsset: (...args) => defaultStore.deleteAsset(...args),
        deleteAssetsByDocument: (...args) => defaultStore.deleteAssetsByDocument(...args),
        getMeta: (...args) => defaultStore.getMeta(...args),
        setMeta: (...args) => defaultStore.setMeta(...args),
        exportAll: (...args) => defaultStore.exportAll(...args),
        importAll: (...args) => defaultStore.importAll(...args),
        clearAll: (...args) => defaultStore.clearAll(...args),
        diagnostics: (...args) => defaultStore.diagnostics(...args),
        createStore,
        normalizeDocument,
        normalizeVersion,
        normalizeAsset,
        normalizeLegacyWorkspace, mergeLegacyPayloads, readLegacyFallbackPayloads, readLegacyIndexedDbPayload, migrateLegacyWorkspace,
        constants: Object.freeze({ DB_NAME, DB_VERSION, FALLBACK_KEY, LEGACY_DB_NAME, LEGACY_STORE_NAME, LEGACY_CURRENT_DOCUMENT_KEY, LEGACY_MIGRATION_META_KEY, LEGACY_FALLBACK_KEYS, MAX_VERSIONS_PER_DOCUMENT, MAX_ASSETS_PER_DOCUMENT })
    });
}));
