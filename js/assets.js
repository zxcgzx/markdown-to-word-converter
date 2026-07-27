(function (root, factory) {
    'use strict';
    const api = factory(root || globalThis);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordAssets = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const ASSET_PREFIX = 'md2word-assets/';
    const ASSET_PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=';
    const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
    const MAX_STORED_BYTES = 10 * 1024 * 1024;
    const DEFAULT_MAX_DIMENSION = 2200;
    const SUPPORTED_DOCX_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/gif']);
    const state = {
        initialized: false,
        store: null,
        resolving: false,
        resolvePromise: null,
        pendingResolve: null,
        assets: [],
        dragDepth: 0,
        lastDocumentId: null
    };
    const dom = {};

    const $ = (id) => root.document ? root.document.getElementById(id) : null;
    const q = (selector, scope) => (scope || root.document).querySelector(selector);
    const qa = (selector, scope) => Array.from((scope || root.document).querySelectorAll(selector));
    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const escapeAttribute = (value) => escapeHtml(value).replace(/`/g, '&#96;');
    const formatBytes = (bytes) => {
        const value = Number(bytes) || 0;
        if (value < 1024) return `${value} B`;
        if (value < 1024 * 1024) return `${(value / 1024).toFixed(value < 10240 ? 1 : 0)} KB`;
        return `${(value / 1024 / 1024).toFixed(1)} MB`;
    };
    const sanitizeAlt = (value) => String(value || '图片').replace(/[\r\n<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || '图片';
    const sanitizeFileName = (value) => String(value || '图片').replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim().slice(0, 150) || '图片';

    function assetUrl(id) {
        return `${ASSET_PREFIX}${encodeURIComponent(String(id || ''))}`;
    }

    function parseAssetId(value) {
        const source = String(value || '');
        const index = source.indexOf(ASSET_PREFIX);
        if (index < 0) return '';
        const raw = source.slice(index + ASSET_PREFIX.length).split(/[?#\s"')]/)[0];
        try { return decodeURIComponent(raw); } catch (_error) { return raw; }
    }

    function makeAssetReference(asset, options = {}) {
        const id = typeof asset === 'string' ? asset : asset && asset.id;
        if (!id) throw new Error('图片素材缺少 ID');
        const alt = sanitizeAlt(options.alt || (asset && asset.alt) || (asset && asset.name) || '图片');
        const widthMode = ['small', 'medium', 'fit', 'original'].includes(options.widthMode) ? options.widthMode : 'fit';
        const width = widthMode === 'small' ? 320 : widthMode === 'medium' ? 480 : widthMode === 'fit' ? 680 : 0;
        const widthAttr = width ? ` width="${width}"` : '';
        return `<img src="${ASSET_PLACEHOLDER}" alt="${escapeAttribute(alt)}" data-md2word-asset="${escapeAttribute(id)}" data-md2word-asset-src="${assetUrl(id)}" data-width-mode="${widthMode}"${widthAttr}>`;
    }

    function extractAssetIds(markdown) {
        const ids = new Set();
        const source = String(markdown || '');
        const urlRe = /md2word-assets\/([^\s"')>?#]+)/g;
        const attrRe = /data-md2word-asset\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))/gi;
        let match;
        while ((match = urlRe.exec(source))) {
            try { ids.add(decodeURIComponent(match[1])); } catch (_error) { ids.add(match[1]); }
        }
        while ((match = attrRe.exec(source))) ids.add(match[1] || match[2] || match[3]);
        return Array.from(ids).filter(Boolean);
    }

    function replaceAssetId(markdown, oldId, newId) {
        const encodedOld = encodeURIComponent(String(oldId));
        const encodedNew = encodeURIComponent(String(newId));
        return String(markdown || '').split(`${ASSET_PREFIX}${encodedOld}`).join(`${ASSET_PREFIX}${encodedNew}`)
            .split(`${ASSET_PREFIX}${oldId}`).join(`${ASSET_PREFIX}${encodedNew}`)
            .replace(new RegExp(`data-md2word-asset=(['"])${escapeRegExp(oldId)}\\1`, 'g'), (_match, quote) => `data-md2word-asset=${quote}${newId}${quote}`);
    }

    function removeAssetReferences(markdown, id) {
        const source = String(markdown || '');
        const encoded = escapeRegExp(encodeURIComponent(String(id)));
        const raw = escapeRegExp(String(id));
        const urlPattern = `(?:${escapeRegExp(ASSET_PREFIX)}(?:${encoded}|${raw}))`;
        return source
            .replace(new RegExp(`^[ \\t]*<img\\b[^>]*(?:src=(['"])[^'"]*${urlPattern}[^'"]*\\1|data-md2word-asset=(['"])(?:${raw})\\2)[^>]*>\\s*$`, 'gmi'), '')
            .replace(new RegExp(`!\\[[^\\]]*\\]\\(${urlPattern}(?:\\s+['"][^'"]*['"])?\\)`, 'gi'), '')
            .replace(/\n{3,}/g, '\n\n');
    }

    function escapeRegExp(value) {
        return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function dataUrlToBytes(dataUrl) {
        const match = String(dataUrl || '').match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
        if (!match) throw new Error('图片数据格式无效');
        const encoded = match[3] || '';
        if (match[2]) {
            if (typeof root.atob !== 'function') return Uint8Array.from(Buffer.from(encoded, 'base64'));
            const binary = root.atob(encoded);
            const bytes = new Uint8Array(binary.length);
            for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
            return bytes;
        }
        return new TextEncoder().encode(decodeURIComponent(encoded));
    }

    function blobToDataUrl(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(reader.error || new Error('读取图片失败'));
            reader.readAsDataURL(blob);
        });
    }

    function loadImage(dataUrl) {
        return new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = 'async';
            image.onload = () => resolve(image);
            image.onerror = () => reject(new Error('浏览器无法解码该图片'));
            image.src = dataUrl;
        });
    }

    function canvasToBlob(canvas, mimeType, quality) {
        return new Promise((resolve, reject) => {
            canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('图片转换失败')), mimeType, quality);
        });
    }

    async function normalizeImageBlob(blob, name = '图片', options = {}) {
        if (!blob || !String(blob.type || '').startsWith('image/')) throw new Error('请选择图片文件');
        if (blob.size > (Number(options.maxSourceBytes) || MAX_SOURCE_BYTES)) throw new Error(`单张原图不能超过 ${formatBytes(Number(options.maxSourceBytes) || MAX_SOURCE_BYTES)}`);
        const inputDataUrl = await blobToDataUrl(blob);
        const image = await loadImage(inputDataUrl);
        const maxDimension = Math.max(800, Number(options.maxDimension) || DEFAULT_MAX_DIMENSION);
        const maxSide = Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height);
        const needsResize = maxSide > maxDimension;
        const sourceMime = String(blob.type || 'image/png').toLowerCase();
        const needsConversion = !SUPPORTED_DOCX_MIME.has(sourceMime) || sourceMime === 'image/gif' && needsResize;
        let outputBlob = blob;
        let width = image.naturalWidth || image.width || 0;
        let height = image.naturalHeight || image.height || 0;

        if (needsResize || needsConversion) {
            const ratio = needsResize ? Math.min(1, maxDimension / Math.max(1, maxSide)) : 1;
            width = Math.max(1, Math.round(width * ratio));
            height = Math.max(1, Math.round(height * ratio));
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const context = canvas.getContext('2d', { alpha: true });
            if (!context) throw new Error('浏览器不支持图片转换');
            context.drawImage(image, 0, 0, width, height);
            const transparent = sourceMime === 'image/png' || sourceMime === 'image/webp' || sourceMime === 'image/svg+xml';
            const targetMime = transparent ? 'image/png' : 'image/jpeg';
            outputBlob = await canvasToBlob(canvas, targetMime, targetMime === 'image/jpeg' ? 0.9 : undefined);
        }

        if (outputBlob.size > (Number(options.maxStoredBytes) || MAX_STORED_BYTES)) throw new Error(`处理后的图片仍超过 ${formatBytes(Number(options.maxStoredBytes) || MAX_STORED_BYTES)}，请先压缩`);
        const dataUrl = outputBlob === blob ? inputDataUrl : await blobToDataUrl(outputBlob);
        const extension = outputBlob.type === 'image/jpeg' ? '.jpg' : outputBlob.type === 'image/png' ? '.png' : outputBlob.type === 'image/gif' ? '.gif' : '';
        let finalName = sanitizeFileName(name);
        if (extension && !/\.(?:png|jpe?g|gif)$/i.test(finalName)) finalName += extension;
        return {
            name: finalName,
            alt: finalName.replace(/\.[^.]+$/, ''),
            mimeType: outputBlob.type || sourceMime,
            dataUrl,
            width,
            height,
            size: outputBlob.size,
            sourceUrl: String(options.sourceUrl || '')
        };
    }

    function getWorkflowState() {
        try { return root.Md2WordWorkflow && root.Md2WordWorkflow.getState ? root.Md2WordWorkflow.getState() : null; }
        catch (_error) { return null; }
    }

    async function ensureDocumentId() {
        if (root.Md2WordWorkflow && typeof root.Md2WordWorkflow.saveCurrent === 'function') {
            await root.Md2WordWorkflow.saveCurrent({ force: true });
        }
        const workflow = getWorkflowState();
        if (workflow && workflow.currentId) return workflow.currentId;
        throw new Error('请先等待文档中心初始化后再添加图片');
    }

    function notify(message, tone = 'info', duration = 4200) {
        const box = $('statusMessage');
        const text = $('statusMessageText');
        if (!box || !text) return;
        text.textContent = message;
        box.hidden = false;
        box.dataset.tone = tone;
        clearTimeout(notify.timer);
        notify.timer = setTimeout(() => { box.hidden = true; }, duration);
    }

    function showError(title, message) {
        const region = $('toastRegion');
        if (!region) { notify(`${title}：${message}`, 'error', 6000); return; }
        const item = document.createElement('div');
        item.className = 'toast toast-error visible';
        item.innerHTML = `<span class="toast-icon" aria-hidden="true">!</span><div class="toast-content"><div class="toast-title">${escapeHtml(title)}</div><div class="toast-message">${escapeHtml(message)}</div></div><button type="button" class="toast-close" aria-label="关闭">×</button>`;
        q('.toast-close', item).addEventListener('click', () => item.remove());
        region.appendChild(item);
        setTimeout(() => item.remove(), 6500);
    }

    function insertTextAtCursor(text) {
        const input = $('markdownInput');
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || start;
        const prefix = start > 0 && input.value[start - 1] !== '\n' ? '\n' : '';
        const suffix = end < input.value.length && input.value[end] !== '\n' ? '\n' : '';
        input.setRangeText(`${prefix}${text}${suffix}`, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    }

    async function storeNormalizedAsset(normalized, documentId) {
        if (!state.store) throw new Error('图片素材库尚未就绪');
        return state.store.putAsset({ ...normalized, documentId });
    }

    async function importImageFiles(files, options = {}) {
        const list = Array.from(files || []).filter((file) => file && String(file.type || '').startsWith('image/'));
        if (!list.length) throw new Error('没有检测到可用图片');
        const documentId = await ensureDocumentId();
        const inserted = [];
        for (const file of list) {
            const normalized = await normalizeImageBlob(file, file.name || '图片', options);
            const asset = await storeNormalizedAsset(normalized, documentId);
            inserted.push(asset);
        }
        if (options.insert !== false) {
            const widthMode = ['small', 'medium', 'fit', 'original'].includes(options.widthMode) ? options.widthMode : (dom.widthMode ? dom.widthMode.value : 'fit');
            insertTextAtCursor(inserted.map((asset) => makeAssetReference(asset, { widthMode })).join('\n\n'));
        }
        await refreshAssetPanel();
        notify(`已保存并插入 ${inserted.length} 张图片。`);
        return inserted;
    }

    async function fetchWithTimeout(url, options = {}) {
        const controller = typeof AbortController === 'function' ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), Number(options.timeout) || 12000) : null;
        try {
            const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller ? controller.signal : undefined, cache: 'no-store' });
            if (!response.ok) throw new Error(`图片服务器返回 ${response.status}`);
            return await response.blob();
        } finally {
            if (timer) clearTimeout(timer);
        }
    }

    async function importRemoteImage(url, alt = '', options = {}) {
        const sourceUrl = String(url || '').trim();
        if (!/^https?:\/\//i.test(sourceUrl)) throw new Error('请输入以 http:// 或 https:// 开头的图片地址');
        const blob = await fetchWithTimeout(sourceUrl, options);
        if (!String(blob.type || '').startsWith('image/')) throw new Error('该地址返回的不是图片');
        const guessed = sourceUrl.split('/').pop()?.split(/[?#]/)[0] || '网络图片';
        const normalized = await normalizeImageBlob(blob, guessed, { ...options, sourceUrl });
        normalized.alt = sanitizeAlt(alt || normalized.alt);
        const documentId = await ensureDocumentId();
        const asset = await storeNormalizedAsset(normalized, documentId);
        if (options.insert !== false) insertTextAtCursor(makeAssetReference(asset, { alt: normalized.alt, widthMode: options.widthMode || (dom.widthMode ? dom.widthMode.value : 'fit') }));
        await refreshAssetPanel();
        notify('网络图片已下载到本地素材库并插入文档。');
        return asset;
    }

    function insertExternalImage(url, alt = '') {
        const sourceUrl = String(url || '').trim();
        if (!/^https?:\/\//i.test(sourceUrl)) throw new Error('请输入有效的网络图片地址');
        insertTextAtCursor(`![${sanitizeAlt(alt || '网络图片')}](${sourceUrl})`);
        notify('已插入网络图片链接；导出 Word 时会尝试下载并嵌入。', 'warning', 5200);
    }

    async function waitForImageReady(image) {
        if (!image) return;
        if (image.complete && image.naturalWidth > 0) return;
        if (typeof image.decode === 'function') {
            try { await image.decode(); return; } catch (_error) { /* fall through to load/error */ }
        }
        await new Promise((resolve) => {
            const done = () => { image.removeEventListener('load', done); image.removeEventListener('error', done); resolve(); };
            image.addEventListener('load', done, { once: true });
            image.addEventListener('error', done, { once: true });
            setTimeout(done, 2500);
        });
    }

    async function resolvePreviewAssets(scope) {
        if (!state.store) return { resolved: 0, missing: 0 };
        if (state.resolvePromise) return state.resolvePromise;
        const rootNode = scope || $('preview');
        if (!rootNode) return { resolved: 0, missing: 0 };
        state.resolving = true;
        state.resolvePromise = (async () => {
            let resolved = 0;
            let missing = 0;
            const images = qa('img', rootNode).filter((image) => image.dataset.md2wordResolved !== 'true' && (image.dataset.md2wordAsset || parseAssetId(image.getAttribute('src')) || parseAssetId(image.dataset.md2wordAssetSrc)));
            for (const image of images) {
                const id = image.dataset.md2wordAsset || parseAssetId(image.getAttribute('src')) || parseAssetId(image.dataset.md2wordAssetSrc);
                const asset = await state.store.getAsset(id);
                if (!asset || !asset.dataUrl) {
                    image.dataset.assetMissing = 'true';
                    image.dataset.md2wordResolved = 'false';
                    image.alt = image.alt || '图片素材缺失';
                    missing += 1;
                    continue;
                }
                image.dataset.md2wordAsset = id;
                image.dataset.originalSrc = assetUrl(id);
                image.dataset.md2wordAssetSrc = assetUrl(id);
                image.src = asset.dataUrl;
                image.dataset.md2wordResolved = 'true';
                delete image.dataset.assetMissing;
                if (!image.alt) image.alt = asset.alt || asset.name || '图片';
                if (asset.width) image.dataset.naturalWidth = String(asset.width);
                if (asset.height) image.dataset.naturalHeight = String(asset.height);
                await waitForImageReady(image);
                resolved += 1;
            }
            if (resolved || missing) root.document.dispatchEvent(new CustomEvent('md2word:assets-resolved', { detail: { resolved, missing } }));
            return { resolved, missing };
        })();
        try { return await state.resolvePromise; }
        finally { state.resolving = false; state.resolvePromise = null; }
    }

    async function remoteImageToDataUrl(image, options = {}) {
        const src = image.getAttribute('src') || '';
        if (!/^https?:\/\//i.test(src)) return { ok: true, skipped: true };
        try {
            const blob = await fetchWithTimeout(src, options);
            if (!String(blob.type || '').startsWith('image/')) throw new Error('返回内容不是图片');
            const normalized = await normalizeImageBlob(blob, image.alt || '网络图片', { ...options, sourceUrl: src });
            image.dataset.remoteOriginal = src;
            image.src = normalized.dataUrl;
            image.dataset.md2wordResolved = 'true';
            image.dataset.naturalWidth = String(normalized.width || 0);
            image.dataset.naturalHeight = String(normalized.height || 0);
            await waitForImageReady(image);
            return { ok: true, normalized };
        } catch (error) {
            image.dataset.remoteFetchError = String(error.message || error);
            return { ok: false, error };
        }
    }

    async function preparePreviewForExport(scope, options = {}) {
        const rootNode = scope || $('preview');
        const local = await resolvePreviewAssets(rootNode);
        const results = { localResolved: local.resolved, missing: local.missing, remoteResolved: 0, remoteFailed: 0, failures: [] };
        if (options.fetchRemote === false || !rootNode) return results;
        const remoteImages = qa('img[src^="http://"], img[src^="https://"]', rootNode);
        for (const image of remoteImages) {
            const result = await remoteImageToDataUrl(image, options);
            if (result.ok) results.remoteResolved += 1;
            else {
                results.remoteFailed += 1;
                results.failures.push({ src: image.getAttribute('src') || '', message: result.error ? String(result.error.message || result.error) : '下载失败' });
            }
        }
        return results;
    }

    function getAssetIssues(scope, markdown = '') {
        const rootNode = scope || $('preview');
        if (!rootNode) return [];
        const source = String(markdown || '');
        return qa('img[data-asset-missing="true"]', rootNode).map((image, index) => {
            const id = image.dataset.md2wordAsset || parseAssetId(image.dataset.md2wordAssetSrc) || parseAssetId(image.getAttribute('src'));
            const token = id ? (source.indexOf(id) >= 0 ? id : encodeURIComponent(id)) : '';
            const start = token ? source.indexOf(token) : -1;
            return {
                id: `asset-missing-${id || index}`,
                severity: 'error', type: 'image-asset-missing', title: '本地图片素材缺失',
                message: `文档引用的图片素材${id ? `“${id}”` : ''}已不存在。请从素材库重新插入图片，或删除失效引用。`,
                start: start >= 0 ? start : null,
                end: start >= 0 ? start + token.length : null,
                line: null, column: null, locatable: start >= 0
            };
        });
    }

    function schedulePreviewResolve(scope) {
        clearTimeout(state.pendingResolve);
        state.pendingResolve = setTimeout(() => resolvePreviewAssets(scope).catch((error) => console.warn('图片素材解析失败', error)), 20);
    }

    function onPreviewRendered(scope) {
        schedulePreviewResolve(scope || $('preview'));
    }

    async function refreshAssetPanel() {
        if (!state.store || !dom.assetList) return [];
        const workflow = getWorkflowState();
        const documentId = workflow && workflow.currentId;
        state.lastDocumentId = documentId || null;
        if (!documentId) {
            state.assets = [];
            dom.assetList.innerHTML = '';
            dom.assetEmpty.hidden = false;
            dom.assetSummary.textContent = '当前文档尚未建立本地素材库';
            return [];
        }
        state.assets = await state.store.listAssets(documentId, { limit: 200 });
        const content = $('markdownInput') ? $('markdownInput').value : '';
        const usedIds = new Set(extractAssetIds(content));
        dom.assetSummary.textContent = `${state.assets.length} 个素材 · ${state.assets.filter((asset) => usedIds.has(asset.id)).length} 个正在使用`;
        dom.assetEmpty.hidden = state.assets.length > 0;
        dom.assetList.innerHTML = state.assets.map((asset) => {
            const used = usedIds.has(asset.id);
            const dimensions = asset.width && asset.height ? `${asset.width} × ${asset.height}` : '尺寸未知';
            return `<article class="asset-card" data-asset-id="${escapeAttribute(asset.id)}">
                <div class="asset-thumb"><img src="${escapeAttribute(asset.dataUrl)}" alt="${escapeAttribute(asset.alt || asset.name)}" loading="lazy"></div>
                <div class="asset-card-copy"><strong title="${escapeAttribute(asset.name)}">${escapeHtml(asset.name)}</strong><span>${escapeHtml(dimensions)} · ${escapeHtml(formatBytes(asset.size))}</span><small class="${used ? 'is-used' : ''}">${used ? '文档中正在使用' : '未使用'}</small></div>
                <div class="asset-card-actions"><button type="button" class="text-button" data-action="insert-asset" data-asset-id="${escapeAttribute(asset.id)}">插入</button><button type="button" class="text-button danger-text" data-action="delete-asset" data-asset-id="${escapeAttribute(asset.id)}">删除</button></div>
            </article>`;
        }).join('');
        return state.assets;
    }

    function openAssetPanel() {
        const drawer = $('toolDrawer');
        if (!drawer) return;
        drawer.hidden = false;
        $('toolDrawerTitle').textContent = '图片与素材';
        ['tableToolPanel', 'aiToolPanel', 'exportCheckToolPanel', 'templateToolPanel', 'professionalToolPanel'].forEach((id) => { const panel = $(id); if (panel) panel.hidden = true; });
        if (dom.assetPanel) dom.assetPanel.hidden = false;
        refreshAssetPanel().catch((error) => showError('素材库读取失败', error.message || String(error)));
        requestAnimationFrame(() => drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    async function insertExistingAsset(id) {
        const asset = state.assets.find((item) => item.id === id) || await state.store.getAsset(id);
        if (!asset) throw new Error('该图片素材已不存在');
        insertTextAtCursor(makeAssetReference(asset, { widthMode: dom.widthMode ? dom.widthMode.value : 'fit' }));
        notify('图片已插入到光标位置。');
    }

    async function deleteAsset(id) {
        const asset = await state.store.getAsset(id);
        if (!asset) return;
        const input = $('markdownInput');
        const used = input && extractAssetIds(input.value).includes(id);
        const prompt = used
            ? `“${asset.name}”仍在当前文档中使用。删除素材并同时移除文档中的图片引用？`
            : `确认删除图片素材“${asset.name}”？`;
        if (!root.confirm(prompt)) return;
        if (used && input) {
            input.value = removeAssetReferences(input.value, id);
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
        await state.store.deleteAsset(id);
        await refreshAssetPanel();
        notify('图片素材已删除。');
    }

    async function cleanupUnusedAssets() {
        const workflow = getWorkflowState();
        if (!workflow || !workflow.currentId) return;
        const input = $('markdownInput');
        const used = new Set(extractAssetIds(input ? input.value : ''));
        const assets = await state.store.listAssets(workflow.currentId, { limit: 200 });
        const unused = assets.filter((asset) => !used.has(asset.id));
        if (!unused.length) { notify('当前没有未使用的图片素材。'); return; }
        if (!root.confirm(`确认清理 ${unused.length} 个未使用的图片素材？`)) return;
        for (const asset of unused) await state.store.deleteAsset(asset.id);
        await refreshAssetPanel();
        notify(`已清理 ${unused.length} 个未使用素材。`);
    }

    async function duplicateDocumentAssets(sourceDocumentId, targetDocumentId, content) {
        if (!state.store || !sourceDocumentId || !targetDocumentId) return String(content || '');
        const referenced = new Set(extractAssetIds(content));
        if (!referenced.size) return String(content || '');
        const assets = await state.store.listAssets(sourceDocumentId, { limit: 200 });
        let rewritten = String(content || '');
        for (const asset of assets) {
            if (!referenced.has(asset.id)) continue;
            const copy = await state.store.putAsset({ ...asset, id: state.store.makeId('asset'), documentId: targetDocumentId, createdAt: Date.now(), updatedAt: Date.now() });
            rewritten = replaceAssetId(rewritten, asset.id, copy.id);
        }
        return rewritten;
    }

    async function onImageFileInput(event) {
        // Snapshot the FileList before resetting the input. FileList can be live,
        // so clearing the control first would otherwise erase the selected files.
        const files = Array.from(event.target.files || []);
        event.target.value = '';
        if (!files.length) return;
        try { await importImageFiles(files); }
        catch (error) { showError('图片导入失败', error.message || String(error)); }
    }

    function onPaste(event) {
        if (event.defaultPrevented) return;
        const fromFiles = Array.from(event.clipboardData?.files || []);
        const fromItems = Array.from(event.clipboardData?.items || []).map((item) => item.kind === 'file' ? item.getAsFile() : null).filter(Boolean);
        const files = Array.from(new Set([...fromFiles, ...fromItems])).filter((file) => String(file.type || '').startsWith('image/'));
        if (!files.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        importImageFiles(files).catch((error) => showError('粘贴图片失败', error.message || String(error)));
    }

    function onDragEnter(event) {
        const hasImages = Array.from(event.dataTransfer?.items || []).some((item) => item.kind === 'file' && String(item.type || '').startsWith('image/'));
        if (!hasImages) return;
        state.dragDepth += 1;
        document.body.classList.add('image-drag-active');
        if (dom.imageDropOverlay) dom.imageDropOverlay.hidden = false;
    }

    function onDragLeave(event) {
        if (!document.body.classList.contains('image-drag-active')) return;
        state.dragDepth = Math.max(0, state.dragDepth - 1);
        if (!state.dragDepth || event.relatedTarget == null) {
            document.body.classList.remove('image-drag-active');
            if (dom.imageDropOverlay) dom.imageDropOverlay.hidden = true;
        }
    }

    function onDrop(event) {
        const files = Array.from(event.dataTransfer?.files || []).filter((file) => String(file.type || '').startsWith('image/'));
        if (!files.length) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        state.dragDepth = 0;
        document.body.classList.remove('image-drag-active');
        if (dom.imageDropOverlay) dom.imageDropOverlay.hidden = true;
        importImageFiles(files).catch((error) => showError('拖入图片失败', error.message || String(error)));
    }

    async function handleAction(actionButton, event) {
        const action = actionButton.dataset.action;
        if (!['open-assets', 'choose-image-files', 'import-image-url', 'insert-external-image', 'insert-asset', 'delete-asset', 'cleanup-assets', 'refresh-assets'].includes(action)) return false;
        event.preventDefault();
        if (action === 'open-assets') openAssetPanel();
        else if (action === 'choose-image-files') $('imageFileInput')?.click();
        else if (action === 'import-image-url') {
            try { await importRemoteImage(dom.urlInput.value, dom.altInput.value); dom.urlInput.value = ''; dom.altInput.value = ''; }
            catch (error) { showError('网络图片导入失败', `${error.message || error}。部分图片服务器禁止跨域访问，可下载图片后再拖入。`); }
        } else if (action === 'insert-external-image') {
            try { insertExternalImage(dom.urlInput.value, dom.altInput.value); }
            catch (error) { showError('插入失败', error.message || String(error)); }
        } else if (action === 'insert-asset') await insertExistingAsset(actionButton.dataset.assetId);
        else if (action === 'delete-asset') await deleteAsset(actionButton.dataset.assetId);
        else if (action === 'cleanup-assets') await cleanupUnusedAssets();
        else if (action === 'refresh-assets') await refreshAssetPanel();
        return true;
    }

    function cacheDom() {
        Object.assign(dom, {
            assetPanel: $('assetToolPanel'), assetList: $('assetList'), assetEmpty: $('assetEmpty'), assetSummary: $('assetSummary'),
            urlInput: $('imageUrlInput'), altInput: $('imageAltInput'), widthMode: $('imageWidthMode'),
            imageInput: $('imageFileInput'), imageDropOverlay: $('imageDropOverlay')
        });
    }

    async function initialize() {
        if (state.initialized || !root.document) return;
        state.initialized = true;
        cacheDom();
        state.store = root.Md2WordWorkspaceStore || null;
        if (state.store && typeof state.store.ready === 'function') await state.store.ready();
        dom.imageInput?.addEventListener('change', onImageFileInput);
        const input = $('markdownInput');
        input?.addEventListener('paste', onPaste, true);
        const editor = $('editorFrame') || input;
        editor?.addEventListener('dragenter', onDragEnter, true);
        editor?.addEventListener('dragleave', onDragLeave, true);
        editor?.addEventListener('dragover', (event) => {
            if (!document.body.classList.contains('image-drag-active')) return;
            event.preventDefault();
            if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
        }, true);
        editor?.addEventListener('drop', onDrop, true);
        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            Promise.resolve(handleAction(button, event)).catch((error) => showError('图片操作失败', error.message || String(error)));
        }, true);
        document.addEventListener('md2word:document-changed', () => refreshAssetPanel().catch(() => {}));
        const preview = $('preview');
        if (preview && typeof MutationObserver === 'function') {
            const observer = new MutationObserver(() => schedulePreviewResolve(preview));
            observer.observe(preview, { childList: true, subtree: true });
        }
        schedulePreviewResolve(preview);
    }

    if (root.addEventListener) root.addEventListener('DOMContentLoaded', () => initialize().catch((error) => console.error('v5.5 图片素材初始化失败', error)), { once: true });

    return Object.freeze({
        version: '5.5', ASSET_PREFIX, ASSET_PLACEHOLDER, assetUrl, parseAssetId, makeAssetReference, extractAssetIds, replaceAssetId, removeAssetReferences,
        dataUrlToBytes, normalizeImageBlob, importImageFiles, importRemoteImage, insertExternalImage,
        resolvePreviewAssets, preparePreviewForExport, getAssetIssues, onPreviewRendered, refreshAssetPanel, openAssetPanel,
        duplicateDocumentAssets, getState: () => ({ ...state, assets: state.assets.map((asset) => ({ ...asset, dataUrl: asset.dataUrl ? `[${asset.dataUrl.length} chars]` : '' })) })
    });
}));
