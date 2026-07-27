'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('index.html');
const app = read('js/app.js');
const assets = read('js/assets.js');
const publishing = read('js/publishing.js');
const store = read('js/workspace-store.js');
const css = read('css/publishing.css');
const pkg = JSON.parse(read('package.json'));

test('v5.4 loads the publishing and asset modules with cache-busted resources', () => {
    assert.equal(pkg.version, '5.4.0');
    for (const resource of ['css/publishing.css?v=5.4', 'js/workspace-store.js?v=5.4', 'js/assets.js?v=5.4', 'js/publishing.js?v=5.4', 'js/app.js?v=5.4']) {
        assert.ok(html.includes(resource), `missing ${resource}`);
    }
    for (const script of ['workspace-store.js', 'assets.js', 'publishing.js']) assert.ok(pkg.scripts.check.includes(script));
});

test('A4 and web preview modes coexist with page status and manual refresh', () => {
    for (const id of ['previewModeSwitch', 'a4Preview', 'pagePreviewStatus', 'previewRefreshButton']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /data-preview-mode="web"/);
    assert.match(html, /data-preview-mode="a4"/);
    assert.match(publishing, /function buildA4Preview/);
    assert.match(publishing, /function getDocxPageProperties/);
    assert.match(css, /\.a4-page\s*\{/);
    assert.match(css, /\.a4-page-content\s*\{/);
    assert.match(app, /previewPerformanceMode/);
    assert.match(app, /预览已暂停 · 点击刷新/);
});

test('image paste, drag, asset management and export embedding are connected', () => {
    for (const id of ['assetToolPanel', 'assetList', 'imageFileInput', 'imageDropOverlay', 'imageUrlInput', 'imageWidthMode', 'dataAssetCount']) assert.match(html, new RegExp(`id="${id}"`));
    for (const action of ['open-assets', 'choose-image-files', 'import-image-url', 'cleanup-assets']) assert.match(html, new RegExp(`data-action="${action}"`));
    assert.match(assets, /function onPaste/);
    assert.match(assets, /function onDrop/);
    assert.match(assets, /function preparePreviewForExport/);
    assert.match(assets, /function duplicateDocumentAssets/);
    assert.match(app, /Md2WordAssets\.preparePreviewForExport/);
    assert.match(app, /new d\.ImageRun/);
    assert.match(store, /createObjectStore\('assets'/);
});

test('paper settings, templates and explicit page breaks are exposed without extra dialogs', () => {
    for (const id of ['wordPaperSize', 'wordOrientation', 'wordMarginTopCm', 'wordMarginRightCm', 'wordMarginBottomCm', 'wordMarginLeftCm', 'templateToolPanel', 'templateList']) assert.match(html, new RegExp(`id="${id}"`));
    assert.match(html, /data-action="insert-page-break"/);
    assert.match(html, /Alt \+ P/);
    assert.match(publishing, /const TEMPLATES/);
    assert.match(publishing, /PAGE_BREAK_HTML/);
    assert.match(app, /element\.classList\.contains\('md2word-page-break'\)/);
    const dialogCount = (html.match(/<dialog\b/g) || []).length;
    assert.equal(dialogCount, 1);
});

test('v5.4 avoids duplicate page-break action dispatch and merges page plus asset checks', () => {
    const delegatedStart = app.indexOf('const handlers = {');
    const delegatedEnd = app.indexOf('};', delegatedStart);
    const handlerMap = app.slice(delegatedStart, delegatedEnd);
    assert.doesNotMatch(handlerMap, /'insert-page-break'/);
    assert.doesNotMatch(handlerMap, /'open-assets'/);
    assert.match(app, /const pageIssues =/);
    assert.match(app, /const assetIssues =/);
    assert.match(app, /Md2WordAssets\.resolvePreviewAssets/);
});

test('explicit page breaks preserve trailing and consecutive blank pages in A4 preview', () => {
    assert.match(publishing, /let forcedBreakAtEnd = false/);
    assert.match(publishing, /flush\(\{ allowEmpty: true \}\)/);
    assert.match(publishing, /current\.length \|\| !pages\.length \|\| forcedBreakAtEnd/);
});

test('Word images are capped to the configured printable page width', () => {
    assert.match(app, /Md2WordPublishing\.pageGeometry\(state\.settings\)/);
    assert.match(app, /geometry && geometry\.contentWidthPx/);
    assert.match(app, /const width = clamp\(requestedWidth, 40, maximumWidth\)/);
});
