'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const workflow = fs.readFileSync(path.join(root, 'js', 'workflow.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'workflow.css'), 'utf8');

function hasId(id) {
    assert.match(html, new RegExp(`id=["']${id}["']`), `missing #${id}`);
}

test('v5.3 loads the workflow module and dedicated presentation layer before app startup', () => {
    const order = [
        'css/typography.css?v=5.3', 'css/workflow.css?v=5.3',
        'js/preflight.js?v=5.3', 'js/workflow.js?v=5.3', 'js/app.js?v=5.3'
    ].map((fragment) => {
        const index = html.indexOf(fragment);
        assert.notEqual(index, -1, `missing ${fragment}`);
        return index;
    });
    assert.deepEqual([...order].sort((a, b) => a - b), order);
    assert.match(workflow, /class DocumentRepository/);
    assert.match(app, /new window\.Md2WordWorkflow\.DocumentRepository\(\)/);
});

test('document center and version history are inline tools rather than new modal layers', () => {
    for (const id of [
        'documentCenterToolPanel', 'documentStoreSummary', 'documentSearchInput', 'documentList',
        'versionHistoryToolPanel', 'versionHistoryTitle', 'versionHistorySummary', 'versionHistoryList'
    ]) hasId(id);
    assert.match(html, /data-action="open-document-center"/);
    assert.match(html, /data-action="create-version"/);
    assert.match(app, /function openDocumentCenter\s*\(/);
    assert.match(app, /function renderDocumentList\s*\(/);
    assert.match(app, /function createVersionCheckpoint\s*\(/);
    assert.match(app, /function restoreVersion\s*\(/);
    assert.match(css, /\.document-list,[\s\S]*?\.version-history-list/);
    assert.equal((html.match(/<dialog\b/g) || []).length, 1, 'workflow must not add modal stacking');
});

test('destructive edits capture explicit records so async version writes cannot save the next document', () => {
    assert.match(app, /function captureCurrentDocumentRecord\s*\(/);
    assert.match(app, /function persistCapturedVersion\s*\(/);
    assert.match(app, /capturedRecord\s*\}\)\s*\.catch/);
    assert.match(app, /versions:\s*existing && Array\.isArray\(existing\.versions\)/);
    assert.match(app, /record = await state\.documentRepository\.get\(documentId\) \|\| record/);
});

test('smart paste is enabled by default, reversible and user-configurable', () => {
    hasId('smartPasteToggle');
    assert.match(app, /smartPaste:\s*true/);
    assert.match(app, /addEventListener\('paste', onSmartPaste\)/);
    assert.match(app, /detectSmartPaste/);
    assert.match(app, /takeDocumentSnapshot\('智能粘贴前的内容'\)/);
    assert.match(app, /tone:\s*'smart'/);
    assert.match(css, /\.status-message\[data-tone="smart"\]/);
});

test('the brand hero supports automatic compact work mode without hiding core actions', () => {
    hasId('heroCollapseButton');
    hasId('heroCollapseLabel');
    hasId('heroBehaviorSelect');
    assert.match(app, /heroBehavior:\s*'auto'/);
    assert.match(app, /function updateHeroState\s*\(/);
    assert.match(app, /shell\.classList\.toggle\('hero-compact', compact\)/);
    assert.match(css, /\.app-shell\.hero-compact \.hero-header\.hero-header-premium/);
    assert.match(css, /\.app-shell\.hero-compact \.hero-action-dock/);
});

test('backup, restore, diagnostics and full workspace clearing live in one data settings category', () => {
    for (const id of [
        'settingsTabData', 'settingsDataSection', 'dataStorageMode', 'dataDocumentCount',
        'dataVersionCount', 'dataStorageUsage', 'dependencyStatusList', 'backupFileInput',
        'includeApiKeyBackup', 'backupImportMode', 'clearWorkspaceDataButton'
    ]) hasId(id);
    for (const action of ['export-workspace-backup', 'import-workspace-backup', 'copy-diagnostic-report', 'clear-workspace-data']) {
        assert.match(html, new RegExp(`data-action="${action}"`));
    }
    assert.match(app, /function exportWorkspaceBackup\s*\(/);
    assert.match(app, /function importWorkspaceBackup\s*\(/);
    assert.match(app, /function buildDiagnosticText\s*\(/);
    assert.match(app, /function clearWorkspaceData\s*\(/);
    assert.match(app, /if \(ai && !\(dom\.includeApiKeyBackup/);
});

test('successful Word export has a non-blocking receipt and remains the only primary action', () => {
    for (const id of ['exportReceipt', 'exportReceiptTitle', 'exportReceiptDetail', 'exportReceiptMeta']) hasId(id);
    assert.match(app, /function showExportReceipt\s*\(/);
    assert.match(app, /function copyLastExportFileName\s*\(/);
    assert.match(app, /warningCount:\s*report\.warningCount/);
    assert.match(css, /\.export-receipt\s*\{/);
    const primaryButtons = [...html.matchAll(/<button\b[^>]*class="([^"]*)"[^>]*>/g)]
        .filter((match) => match[1].split(/\s+/).includes('primary-button'));
    assert.equal(primaryButtons.length, 1);
});

test('empty preview offers recent documents and a direct path into the document center', () => {
    assert.match(app, /class="preview-recent-documents"/);
    assert.match(app, /recentDocuments[\s\S]*?slice\(0, 3\)/);
    assert.match(app, /data-action="open-document" data-document-id/);
    assert.match(css, /\.preview-recent-documents\s*\{/);
});

test('manual version creation respects the document currently shown in history', () => {
    assert.match(app, /'create-version':\s*createVersionForActiveContext/);
    assert.match(app, /async function createVersionForActiveContext\s*\(/);
    assert.match(app, /state\.versionDocumentId !== state\.currentDocumentId/);
});

test('autosave can succeed through the document repository when localStorage is unavailable', () => {
    assert.match(app, /const legacySaved = localStorageSet\(STORAGE\.autosave/);
    assert.match(app, /if \(!legacySaved && !saved\)/);
    assert.match(app, /draftPersistence = saved && state\.documentStorageMode === 'memory'/);
    assert.match(app, /草稿仅在本页临时保留/);
});

test('settings and mobile actions use the shared SVG icon language instead of action emoji', () => {
    for (const id of ['icon-settings', 'icon-palette', 'icon-keyboard', 'icon-user', 'icon-database']) {
        assert.match(html, new RegExp(`<symbol id="${id}"`));
    }
    assert.doesNotMatch(html, /⚙️ 统一设置|⚙️ 设置与账户|🎨 界面与草稿|📄 Word 导出|🤖 AI 修复|⌨️ 快捷键|👤 账户与会话/);
    assert.doesNotMatch(css, /content:\s*["'](?:📁|📄 Word)["']/);
});

test('automatic history waits for both idle time and the five-minute checkpoint interval', () => {
    assert.match(app, /const minimumInterval = 5 \* 60 \* 1000/);
    assert.match(app, /const delay = Math\.max\(45000, minimumInterval - elapsed\)/);
    assert.match(app, /if \(changed\) createVersionCheckpoint\('自动版本', 'automatic'\)/);
});
