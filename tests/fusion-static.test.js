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
const appCss = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const toolbarCss = fs.readFileSync(path.join(root, 'css', 'toolbar.css'), 'utf8');
const experienceCss = fs.readFileSync(path.join(root, 'css', 'experience.css'), 'utf8');
const heroCss = fs.readFileSync(path.join(root, 'css', 'hero.css'), 'utf8');
const typographyCss = fs.readFileSync(path.join(root, 'css', 'typography.css'), 'utf8');
const workflowCss = fs.readFileSync(path.join(root, 'css', 'workflow.css'), 'utf8');
const publishingCss = fs.readFileSync(path.join(root, 'css', 'publishing.css'), 'utf8');
const assetsJs = fs.readFileSync(path.join(root, 'js', 'assets.js'), 'utf8');
const publishingJs = fs.readFileSync(path.join(root, 'js', 'publishing.js'), 'utf8');
const storeJs = fs.readFileSync(path.join(root, 'js', 'workspace-store.js'), 'utf8');
const css = `${appCss}\n${toolbarCss}\n${experienceCss}\n${heroCss}\n${typographyCss}\n${workflowCss}\n${publishingCss}`;
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

test('package and page identify the complete v5.5 release', () => {
    assert.equal(pkg.version, '5.5.0');
    assert.match(html, /融合体验版 v5\.5/);
    assert.match(html, /js\/preflight\.js\?v=5\.5/);
    assert.match(html, /css\/toolbar\.css\?v=5\.5/);
    assert.match(html, /css\/experience\.css\?v=5\.5/);
    assert.match(html, /css\/hero\.css\?v=5\.5/);
    assert.match(pkg.scripts.check, /preflight\.js/);
});

test('keeps the familiar password gate, user identity and four visual themes', () => {
    for (const id of [
        'passwordOverlay', 'passwordForm', 'passwordInput', 'pasteShareCodeButton',
        'rememberDeviceToggle', 'shareCodePanel', 'authThemeButton',
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
    assert.match(html, /class="quick-toolbar" data-layout="command-deck"/);
    assert.match(toolbarCss, /\.quick-toolbar\[data-layout="command-deck"\]\s*\{[\s\S]*?position:\s*sticky;/);
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
    assert.match(appJs, /`公式 \$\{count\} · 渲染错误 \$\{errors\} · 自动修复 \$\{fixes\}`/);
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
    assert.match(preflightJs, /image-remote/);
    assert.match(preflightJs, /wide-table/);
    assert.match(css, /#downloadWordButton\.export-warning/);
    assert.match(css, /\.export-check-list\s*\{/);
});

test('narrow desktop tools move into a discoverable More menu', () => {
    assert.match(html, /id="toolbarMoreMenu"/);
    assert.match(html, /class="toolbar-more-popover"/);
    for (const action of ['save-markdown', 'copy-rich', 'open-table', 'run-ai-direct', 'clear-document']) {
        assert.match(html, new RegExp(`toolbar-more-popover[\\s\\S]*data-action="${action}"`));
    }
    assert.match(toolbarCss, /@media \(max-width:\s*1180px\) and \(min-width:\s*901px\)[\s\S]*?\.toolbar-more\s*\{\s*display:\s*block;/);
    assert.match(toolbarCss, /\.toolbar-more-popover\s*\{/);
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
    assert.match(html, /toolbar-edit-row mobile-hide/);
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
    assert.match(html, /融合体验版 v5\.5/);
    assert.doesNotMatch(appJs, /请.{0,8}手动添加公式/);
});

test('v5.4 login is a focused brand-and-auth composition rather than a card wall', () => {
    for (const id of [
        'authStoryTitle', 'authThemeButton', 'authThemeText', 'rememberDeviceToggle',
        'capsLockHint', 'shareCodePanel', 'shareCodeInput', 'importShareCodeButton',
        'authSubmitButton', 'authSubmitLabel'
    ]) assert.match(html, new RegExp(`id=["']${id}["']`));
    for (const copy of ['把复杂 Markdown', '公式优先解析', '导出前完整检查', '可编辑 Word 内容', '欢迎回来']) {
        assert.ok(html.includes(copy), `missing login copy: ${copy}`);
    }
    assert.doesNotMatch(html, /password-share-card|password-tips-card|password-feature-grid/);
    assert.match(experienceCss, /\.password-layout\.auth-layout\s*\{[\s\S]*?grid-template-columns:/);
    assert.match(experienceCss, /@media \(max-width:\s*680px\)[\s\S]*?min-height:\s*100dvh/);
    assert.match(experienceCss, /\.auth-capability-list\s*\{/);
});

test('remembered access, inline share codes, Caps Lock and login states are implemented', () => {
    assert.match(appJs, /rememberedAccess:\s*'md2word\.fusion\.remembered\.v5\.2'/);
    assert.match(appJs, /function readRememberedAccess\s*\(/);
    assert.match(appJs, /function writeRememberedAccess\s*\(/);
    assert.match(appJs, /function clearRememberedAccess\s*\(/);
    assert.match(appJs, /function parseSharedAccess\s*\(/);
    assert.match(appJs, /该分享码已于 \$\{expires\} 过期/);
    assert.match(appJs, /function updateCapsLockHint\s*\(/);
    assert.match(appJs, /getModifierState\('CapsLock'\)/);
    assert.match(appJs, /setAuthSubmitState\('loading'\)/);
    assert.match(appJs, /setAuthSubmitState\('success'\)/);
    assert.match(experienceCss, /\.password-btn\[data-state="loading"\]/);
    assert.match(experienceCss, /\.password-btn\[data-state="success"\]/);
});

test('v5.4 provides a keyboard command palette and a reversible focus mode', () => {
    for (const id of [
        'commandButton', 'commandPalette', 'commandPaletteInput', 'commandPaletteList',
        'commandPaletteCount', 'focusModeButton', 'focusModeExitButton'
    ]) assert.match(html, new RegExp(`id=["']${id}["']`));
    assert.match(appJs, /function openCommandPalette\s*\(/);
    assert.match(appJs, /function renderCommandPalette\s*\(/);
    assert.match(appJs, /function executePaletteCommand\s*\(/);
    assert.match(appJs, /modifier && key === 'k'/);
    assert.match(appJs, /modifier && event\.shiftKey && key === 'f'/);
    assert.match(appJs, /function setFocusMode\s*\(/);
    assert.match(appJs, /document\.body\.classList\.toggle\('focus-mode'/);
    assert.match(experienceCss, /\.command-palette-card\s*\{/);
    assert.match(experienceCss, /body\.focus-mode \.hero-header/);
    assert.match(experienceCss, /body\.focus-mode \.workspace\s*\{/);
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

test('access configuration keeps the three familiar local passwords and adds a v5.2 remembered-device key', () => {
    const source = fs.readFileSync(path.join(root, 'js', 'access-config.js'), 'utf8');
    const sandbox = { window: {} };
    vm.runInNewContext(source, sandbox, { filename: 'access-config.js' });
    const config = sandbox.window.MD2WORD_ACCESS;
    assert.match(config.sessionKey, /v5\.1$/);
    assert.match(config.rememberedKey, /v5\.2$/);
    assert.equal(config.users.basic123.level, 'basic');
    assert.equal(config.users['517517'].level, 'advanced');
    assert.equal(config.users.lingling.level, 'super_admin');
});

test('focus mode overrides Command Deck important display rules', () => {
    assert.match(experienceCss, /body\.focus-mode \.quick-toolbar\[data-layout="command-deck"\] \.toolbar-edit-row,[\s\S]*?\.document-name-field\s*\{[\s\S]*?display:\s*none\s*!important/);
});

test('the command palette traps keyboard focus while open', () => {
    assert.match(appJs, /function trapCommandPaletteFocus\s*\(/);
    assert.match(appJs, /state\.commandPaletteOpen[^\n]*event\.key !== 'Tab'/);
    assert.match(appJs, /if \(trapCommandPaletteFocus\(event\)\) return/);
});


test('v5.4 adds conservative bare-inline TeX recovery and visible repair controls', () => {
    assert.match(mathJs, /function isProbablyBareInlineLatex/);
    assert.match(mathJs, /repairBareInline/);
    assert.match(mathJs, /escapeLikelyPercentSigns/);
    assert.match(appJs, /自动识别裸行内公式/);
    assert.match(appJs, /自动修正公式百分号/);
    assert.match(html, /智能修复缺失的公式边界/);
    assert.match(html, /写回标准公式边界/);
});

test('hidden Markdown file picker keeps an accessible name', () => {
    assert.match(html, /<input\b[^>]*id="fileInput"[^>]*aria-label="选择 Markdown 文件"[^>]*hidden>/);
});
