'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const mathJs = fs.readFileSync(path.join(root, 'js', 'math-engine.js'), 'utf8');
const preflightJs = fs.readFileSync(path.join(root, 'js', 'preflight.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

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

function findOpeningTags(source, tagName) {
    const regex = new RegExp(`<${tagName}\\b[^>]*>`, 'gi');
    return [...source.matchAll(regex)].map((match) => match[0]);
}

test('package and page identify the complete v5.1 release', () => {
    assert.equal(pkg.version, '5.1.0');
    assert.match(html, /融合体验版 v5\.1/);
    assert.match(html, /js\/preflight\.js/);
    assert.match(pkg.scripts.check, /preflight\.js/);
});

test('keeps the familiar password gate, user identity and four visual themes', () => {
    for (const id of [
        'passwordOverlay', 'passwordForm', 'passwordInput', 'pasteShareCodeButton',
        'app', 'userStatus', 'themeButton', 'settingsButton', 'markdownInput', 'preview'
    ]) assert.match(html, new RegExp(`id=["']${id}["']`));

    for (const label of ['暖阳琥珀', '经典浅林', '现代黑金', '极光幻彩']) {
        assert.ok(html.includes(label), `missing theme label ${label}`);
    }
    for (const selector of [
        '.password-overlay', '.password-modal', '.hero-header',
        ':root[data-theme="forest"]', ':root[data-theme="noir"]', ':root[data-theme="aurora"]'
    ]) assert.ok(css.includes(selector), `missing ${selector}`);
});

test('the sticky top bar is grouped as file, edit, view and output with Word as the only primary action', () => {
    assert.match(html, /class="quick-toolbar"/);
    for (const group of ['toolbar-file', 'toolbar-edit', 'toolbar-view', 'toolbar-output']) {
        assert.match(html, new RegExp(`class="[^"]*${group}`));
    }
    for (const label of ['文件', '编辑', '视图', '输出']) {
        assert.match(html, new RegExp(`<span class="toolbar-label[^"]*"[^>]*>${label}</span>`));
    }
    const buttons = findOpeningTags(html, 'button');
    const primaryButtons = buttons.filter((tag) => /class="[^"]*\bprimary-button\b/.test(tag));
    assert.equal(primaryButtons.length, 1);
    assert.match(primaryButtons[0], /id="downloadWordButton"/);
    assert.match(primaryButtons[0], /data-action="download-word"/);
    assert.match(css, /\.quick-toolbar\s*\{[^}]*position:\s*sticky/si);
});

test('document name is editable and Markdown/browser save states are distinct', () => {
    for (const id of ['documentNameInput', 'saveStatus', 'fileSaveStatus']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    assert.match(appJs, /function onDocumentNameInput\s*\(/);
    assert.match(appJs, /Markdown 文件：/);
    assert.match(appJs, /浏览器草稿：/);
    const autosave = extractFunctionBody(appJs, 'saveAutosave', 'restorePendingDraft');
    assert.doesNotMatch(autosave, /state\.dirty\s*=\s*false/);
    const saveFile = extractFunctionBody(appJs, 'saveMarkdownFile', 'downloadBlob');
    assert.match(saveFile, /state\.dirty\s*=\s*false/);
    assert.match(saveFile, /state\.documentName/);
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

test('supports remembered draggable split sizing and independent mobile/desktop views', () => {
    assert.match(html, /id="splitter"/);
    assert.match(html, /id="syncScrollToggle"/);
    assert.match(appJs, /viewDesktop:\s*'md2word\.personal\.view\.desktop\.v5\.1'/);
    assert.match(appJs, /viewMobile:\s*'md2word\.personal\.view\.mobile\.v5\.1'/);
    assert.match(appJs, /const fallback = mode === 'mobile' \? 'editor' : 'split'/);
    assert.match(appJs, /setPointerCapture/);
    assert.match(appJs, /persistSplitPosition\(\{\s*desktopPercent:/);
    assert.match(appJs, /persistSplitPosition\(\{\s*mobilePercent:/);
    assert.match(appJs, /function syncScrollFrom\s*\(/);
});

test('formula status reports clearer labels and every error can locate source', () => {
    for (const id of ['mathStatus', 'mathStatusText', 'formulaInspector', 'formulaInspectorContent', 'applyMathNormalization']) {
        assert.match(html, new RegExp(`id=["']${id}["']`));
    }
    assert.match(appJs, /`公式 \$\{count\} · 渲染错误 \$\{errors\} · 边界修复 \$\{fixes\}`/);
    assert.match(appJs, /function locateSourceRange\s*\(/);
    assert.match(appJs, /data-action="locate-source"/);
    assert.match(appJs, /setSelectionRange\(safeStart, safeEnd\)/);
    assert.match(mathJs, /data-math-start/);
    assert.match(mathJs, /role="button" tabindex="0"/);
    assert.match(css, /\.source-pulse\s*\{/);
    assert.match(css, /\.diagnostic-locate\s*\{/);
});

test('export preflight is inline, locatable and controls Word readiness', () => {
    for (const id of [
        'exportCheckToolPanel', 'exportCheckSummary', 'exportCheckDetail', 'exportCheckList',
        'exportReadinessChip', 'forceExportButton', 'exportIssueBadge'
    ]) assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(appJs, /function buildExportReport\s*\(/);
    assert.match(appJs, /function updateExportReadiness\s*\(/);
    assert.match(appJs, /function openExportCheck\s*\(/);
    assert.match(appJs, /function renderExportCheck\s*\(/);
    assert.match(appJs, /downloadWord\(\{ force: true \}\)/);
    assert.match(appJs, /if \(!options\.force && report\.issues\.length\)/);
    assert.match(preflightJs, /math-render/);
    assert.match(preflightJs, /code-fence/);
    assert.match(preflightJs, /image-external/);
    assert.match(preflightJs, /wide-table/);
    assert.match(css, /#downloadWordButton\.export-warning/);
    assert.match(css, /\.export-check-list\s*\{/);
});

test('narrow desktop tools move into a discoverable More menu', () => {
    assert.match(html, /id="toolbarMoreMenu"/);
    assert.match(html, /class="toolbar-more-popover"/);
    for (const action of ['save-markdown', 'open-table', 'run-ai-direct', 'clear-document']) {
        assert.match(html, new RegExp(`toolbar-more-popover[\\s\\S]*data-action="${action}"`));
    }
    assert.match(css, /@media \(min-width:\s*681px\) and \(max-width:\s*1180px\)[\s\S]*?\.compact-toolbar-hide\s*\{\s*display:\s*none\s*!important/);
    assert.match(css, /\.toolbar-more-popover\s*\{/);
    assert.match(appJs, /function closeToolbarMoreMenu\s*\(/);
});

test('common tools stay inline while low-frequency options use one categorized settings dialog', () => {
    assert.match(html, /id="toolDrawer"/);
    assert.match(html, /id="tableToolPanel"/);
    assert.match(html, /id="aiToolPanel"/);
    assert.match(html, /id="settingsDialog"/);
    assert.equal(findOpeningTags(html, 'dialog').length, 1);
    for (const section of ['interface', 'word', 'ai', 'shortcuts', 'account']) {
        assert.match(html, new RegExp(`data-settings-tab="${section}"`));
        assert.match(html, new RegExp(`data-settings-panel="${section}"`));
    }
    assert.match(appJs, /function activateSettingsTab\s*\(/);
    assert.match(css, /\.settings-layout\s*\{/);
    assert.match(css, /\.settings-nav\s*\{/);
});

test('mobile sticky bar exposes only Open, view switch and Word download', () => {
    assert.match(html, /mobile-essential mobile-open/);
    assert.match(html, /mobile-essential mobile-download/);
    assert.match(html, /toolbar-edit mobile-hide/);
    assert.match(css, /@media \(max-width:\s*680px\)[\s\S]*?\.hero-utilities,[\s\S]*?\.mobile-hide\s*\{\s*display:\s*none\s*!important/);
    assert.match(css, /grid-template-columns:\s*auto minmax\(0,\s*1fr\) auto/);
    assert.match(css, /\.status-bar\s*\{[\s\S]*?position:\s*sticky;[\s\S]*?bottom:\s*0/);
    assert.match(css, /#downloadWordButton::after\s*\{\s*content:\s*none/);
});

test('non-error feedback stays in the compact status bar and only errors create toast cards', () => {
    assert.match(html, /id="renderStatus"/);
    assert.match(html, /id="statusMessage"/);
    assert.doesNotMatch(html, /今日剩余|配额|quota/i);
    const toastBody = extractFunctionBody(appJs, 'toast', null);
    assert.match(toastBody, /if \(type !== 'error'\)/);
    assert.match(toastBody, /setStatusMessage/);
    assert.match(toastBody, /document\.createElement\('div'\)/);
});

test('DOCX export parses math separately into editable subscript and superscript runs', () => {
    assert.match(appJs, /Md2WordMath\.decodeMathSource/);
    assert.match(appJs, /Md2WordMath\.latexToWordSegments/);
    assert.match(appJs, /subScript:\s*Boolean\(segment\.subScript\)/);
    assert.match(appJs, /superScript:\s*Boolean\(segment\.superScript\)/);
    assert.match(appJs, /融合体验版 v5\.1/);
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
    for (const match of appJs.matchAll(/byId\((?:'([^']+)'|"([^"]+)")\)/g)) references.add(match[1] || match[2]);
    const missing = [...references].filter((id) => !seen.has(id)).sort();
    assert.deepEqual(missing, []);
});

test('access configuration still exposes the three familiar local passwords with a v5.1 session key', () => {
    const source = fs.readFileSync(path.join(root, 'js', 'access-config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox, { filename: 'access-config.js' });
    const config = sandbox.window.MD2WORD_ACCESS;
    assert.match(config.sessionKey, /v5\.1$/);
    assert.equal(config.users.basic123.level, 'basic');
    assert.equal(config.users['517517'].level, 'advanced');
    assert.equal(config.users.lingling.level, 'super_admin');
});
