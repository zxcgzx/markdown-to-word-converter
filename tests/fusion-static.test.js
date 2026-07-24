'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');

function collectIds(source) {
    const ids = [];
    const re = /\bid=(?:"([^"]+)"|'([^']+)')/g;
    let match;
    while ((match = re.exec(source))) ids.push(match[1] || match[2]);
    return ids;
}

function extractFunctionBody(source, name, nextName) {
    const start = source.indexOf(`function ${name}(`);
    assert.notEqual(start, -1, `missing function ${name}`);
    const end = nextName ? source.indexOf(`function ${nextName}(`, start + 1) : source.length;
    assert.notEqual(end, -1, `missing next function ${nextName}`);
    return source.slice(start, end);
}

test('keeps the familiar password gate, user identity and four visual themes', () => {
    for (const id of [
        'passwordOverlay', 'passwordForm', 'passwordInput', 'pasteShareCodeButton',
        'app', 'userStatus', 'themeButton', 'settingsButton', 'markdownInput', 'preview'
    ]) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    for (const label of ['暖阳琥珀', '经典浅林', '现代黑金', '极光幻彩']) {
        assert.ok(html.includes(label), `missing theme label ${label}`);
    }
    for (const selector of [
        '.password-overlay', '.password-modal', '.hero-header',
        ':root[data-theme="forest"]', ':root[data-theme="noir"]', ':root[data-theme="aurora"]'
    ]) {
        assert.ok(css.includes(selector), `missing ${selector}`);
    }
});

test('the sticky top bar is grouped as file, edit, view and output with Word as the only primary action', () => {
    assert.match(html, /class="quick-toolbar"/);
    for (const group of ['toolbar-file', 'toolbar-edit', 'toolbar-view', 'toolbar-output']) {
        assert.match(html, new RegExp(`class="[^"]*${group}`));
    }
    for (const label of ['文件', '编辑', '视图', '输出']) {
        assert.match(html, new RegExp(`<span class="toolbar-label[^>]*>${label}</span>`));
    }
    const primaryClasses = [...html.matchAll(/class="([^"]*\bprimary-button\b[^"]*)"/g)];
    assert.equal(primaryClasses.length, 1);
    assert.match(html, /id="downloadWordButton"[^>]*data-action="download-word"/);
    assert.match(css, /\.quick-toolbar\s*\{[^}]*position:\s*sticky/si);
    assert.match(css, /#downloadWordButton\s*\{/);
});

test('starts blank and exposes examples and draft restore only inside the empty preview', () => {
    assert.match(appJs, /restoreDraftOnStart:\s*false/);
    assert.match(appJs, /class="preview-empty-actions"/);
    assert.match(appJs, /data-action="load-formula-example"/);
    assert.match(appJs, /data-action="restore-draft"/);
    const initialize = extractFunctionBody(appJs, 'initialize', 'cacheDom');
    assert.doesNotMatch(initialize, /loadFormulaExample\s*\(/);
    assert.doesNotMatch(html, /<textarea[^>]*id="markdownInput"[^>]*>\s*[^<\s]/s);
});

test('uses an outline dropdown and contains no legacy floating minimap', () => {
    assert.match(html, /id="outlineSelect"/);
    assert.match(appJs, /function buildOutline\s*\(/);
    assert.doesNotMatch(`${html}\n${appJs}`, /previewMinimap|minimapPosition|mini-map/i);
});

test('supports remembered draggable split sizing and optional proportional scroll sync', () => {
    assert.match(html, /id="splitter"/);
    assert.match(html, /id="syncScrollToggle"/);
    assert.match(appJs, /split:\s*'md2word\.personal\.split\.v3'/);
    assert.match(appJs, /setPointerCapture/);
    assert.match(appJs, /persistSplitPosition\(\{\s*desktopPercent:/);
    assert.match(appJs, /persistSplitPosition\(\{\s*mobilePercent:/);
    assert.match(appJs, /function syncScrollFrom\s*\(/);
    assert.match(appJs, /setScrollRatio\(target,\s*getScrollRatio\(source\)\)/);
});

test('formula status reports counts, errors, repairs and expandable details', () => {
    for (const id of ['mathStatus', 'mathStatusText', 'formulaInspector', 'formulaInspectorContent', 'applyMathNormalization']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    assert.match(appJs, /`公式 \$\{count\} · 错误 \$\{errors\} · 修复 \$\{fixes\}`/);
    assert.match(appJs, /渲染失败/);
    assert.match(appJs, /边界修复/);
    assert.match(css, /\.formula-inspector\s*\{/);
    assert.match(css, /\.diagnostic-item\.warning/);
});

test('common tools stay inline while low-frequency options use one settings dialog', () => {
    assert.match(html, /id="toolDrawer"/);
    assert.match(html, /id="tableToolPanel"/);
    assert.match(html, /id="aiToolPanel"/);
    assert.match(html, /id="settingsDialog"/);
    const dialogs = [...html.matchAll(/<dialog\b/g)];
    assert.equal(dialogs.length, 1);
    for (const removed of ['aiDialog', 'tableDialog', 'diagnosticsDialog', 'shortcutDialog']) {
        assert.doesNotMatch(html, new RegExp(`id=["']${removed}["']`));
    }
    assert.match(css, /\.tool-drawer\s*\{/);
    assert.match(css, /\.settings-sections\s*\{/);
});

test('mobile sticky bar exposes only Open, view switch and Word download', () => {
    assert.match(html, /mobile-essential mobile-open/);
    assert.match(html, /mobile-essential mobile-download/);
    assert.match(html, /toolbar-edit mobile-hide/);
    assert.match(css, /@media \(max-width:\s*680px\)[\s\S]*?\.hero-utilities,[\s\S]*?\.mobile-hide\s*\{\s*display:\s*none\s*!important/);
    assert.match(css, /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    assert.match(css, /手机顶部只保留：打开、视图切换、下载 Word/);
});

test('non-error feedback stays in the compact status bar and only errors create toast cards', () => {
    assert.match(html, /id="renderStatus"/);
    assert.match(html, /id="statusMessage"/);
    assert.doesNotMatch(html, /今日剩余|配额|quota/i);
    const toastBody = extractFunctionBody(appJs, 'toast', null);
    assert.match(toastBody, /if \(type !== 'error'\)/);
    assert.match(toastBody, /setStatusMessage/);
    assert.match(toastBody, /document\.createElement\('div'\)/);
    assert.match(css, /\.status-message\s*\{/);
});

test('DOCX export parses math separately into editable subscript and superscript runs', () => {
    assert.match(appJs, /Md2WordMath\.decodeMathSource/);
    assert.match(appJs, /Md2WordMath\.latexToWordSegments/);
    assert.match(appJs, /subScript:\s*Boolean\(segment\.subScript\)/);
    assert.match(appJs, /superScript:\s*Boolean\(segment\.superScript\)/);
    assert.doesNotMatch(appJs, /请.{0,8}手动添加公式/);
});

test('HTML IDs are unique and every direct byId reference exists', () => {
    const ids = collectIds(html);
    const seen = new Set();
    const duplicates = [];
    for (const id of ids) {
        if (seen.has(id)) duplicates.push(id);
        seen.add(id);
    }
    assert.deepEqual(duplicates, []);

    const references = new Set();
    for (const match of appJs.matchAll(/byId\((?:'([^']+)'|"([^"]+)")\)/g)) {
        references.add(match[1] || match[2]);
    }
    const missing = [...references].filter((id) => !seen.has(id)).sort();
    assert.deepEqual(missing, []);
});

test('access configuration still exposes the three familiar local passwords', () => {
    const source = fs.readFileSync(path.join(root, 'js', 'access-config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox, { filename: 'access-config.js' });
    const users = sandbox.window.MD2WORD_ACCESS.users;
    assert.equal(users.basic123.level, 'basic');
    assert.equal(users['517517'].level, 'advanced');
    assert.equal(users.lingling.level, 'super_admin');
});
