'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'typography.css'), 'utf8');
const appJs = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function position(fragment) {
    const index = html.indexOf(fragment);
    assert.notEqual(index, -1, `missing ${fragment}`);
    return index;
}

test('v5.2.3 loads the global typography stylesheet last', () => {
    assert.equal(pkg.version, '5.2.3');
    assert.match(html, /融合体验版 v5\.2\.3/);
    assert.match(html, /css\/typography\.css\?v=5\.2\.3/);
    assert.ok(position('css/hero.css?v=5.2.3') < position('css/typography.css?v=5.2.3'));
    assert.ok(position('css/typography.css?v=5.2.3') < position('js/access-config.js?v=5.2.3'));
});

test('the system exposes eight semantic UI levels and an independent document scale', () => {
    for (const token of [
        '--type-display', '--type-page-title', '--type-section-title', '--type-card-title',
        '--type-body-large', '--type-body', '--type-label', '--type-caption'
    ]) assert.match(css, new RegExp(`${token}:`));
    for (const token of ['--doc-h1', '--doc-h2', '--doc-h3', '--doc-h4', '--doc-h5', '--doc-h6', '--doc-body', '--doc-code']) {
        assert.match(css, new RegExp(`${token}:`));
    }
});

test('font families use system and CJK fallbacks without a new font CDN', () => {
    for (const token of ['--font-ui', '--font-display', '--font-document', '--font-mono']) {
        assert.match(css, new RegExp(`${token}:`));
    }
    assert.match(css, /PingFang SC/);
    assert.match(css, /HarmonyOS Sans SC/);
    assert.match(css, /Microsoft YaHei UI/);
    assert.match(css, /Cascadia Code/);
    assert.doesNotMatch(html, /fonts\.googleapis|use\.typekit|fontsource/i);
});

test('effective typography restricts the public weight system to 400 500 600 and 700', () => {
    assert.match(css, /--weight-regular:\s*400/);
    assert.match(css, /--weight-medium:\s*500/);
    assert.match(css, /--weight-semibold:\s*600/);
    assert.match(css, /--weight-bold:\s*700/);
    assert.doesNotMatch(css, /font-weight:\s*(?:[89]\d\d|7[1-9]\d|6[1-9]\d|5[1-9]\d)/);
});

test('auth, hero, toolbar, workspace, editor and preview all consume semantic tokens', () => {
    const expectations = [
        [/\.auth-story h1\s*\{[\s\S]*?font-size:\s*var\(--type-display\)/, 'auth display'],
        [/\.hero-title-main\s*\{[\s\S]*?font-size:\s*var\(--type-page-title\)/, 'hero title'],
        [/\.toolbar-label\s*\{[\s\S]*?font-size:\s*var\(--type-caption\)/, 'toolbar label'],
        [/\.panel-heading h2\s*\{[\s\S]*?font-size:\s*var\(--type-body-large\)/, 'panel title'],
        [/#markdownInput\s*\{[\s\S]*?font-family:\s*var\(--font-mono\)/, 'editor'],
        [/\.preview\s*\{[\s\S]*?font-family:\s*var\(--font-document\)[\s\S]*?font-size:\s*var\(--doc-body\)/, 'preview']
    ];
    for (const [pattern, label] of expectations) assert.match(css, pattern, label);
});

test('preview has a complete document hierarchy instead of inheriting interface sizes', () => {
    for (const [selector, token] of [
        ['h1', '--doc-h1'], ['h2', '--doc-h2'], ['h3', '--doc-h3'],
        ['h4', '--doc-h4'], ['h5', '--doc-h5'], ['h6', '--doc-h6']
    ]) {
        assert.match(css, new RegExp(`\\.preview ${selector}\\s*\\{[\\s\\S]*?font-size:\\s*var\\(${token}\\)`));
    }
    assert.match(css, /\.preview p,[\s\S]*?max-width:\s*78ch/);
    assert.match(css, /\.preview pre,[\s\S]*?font-family:\s*var\(--font-mono\)/);
});

test('three density modes change spacing and target size without changing type tokens', () => {
    for (const mode of ['compact', 'standard', 'spacious']) {
        assert.match(css, new RegExp(`:root\\[data-density="${mode}"\\]`));
        assert.match(html, new RegExp(`name="uiDensity" value="${mode}"`));
    }
    assert.match(html, /密度只调整间距和控件尺寸，不改变全局字体等级与文档字号/);
    assert.match(appJs, /uiDensity:\s*'standard'/);
    assert.match(appJs, /document\.documentElement\.dataset\.density/);
    assert.match(appJs, /input\[name="uiDensity"\]:checked/);
});

test('numeric status and shortcut text use tabular or monospaced figures', () => {
    assert.match(css, /font-variant-numeric:\s*tabular-nums/);
    assert.match(css, /\.command-item-shortcut/);
    assert.match(css, /#charCount/);
    assert.match(css, /#mathStatusText/);
});

test('responsive rules preserve hierarchy and reflow down to phone widths', () => {
    assert.match(css, /@media \(max-width:\s*1120px\)/);
    assert.match(css, /@media \(max-width:\s*820px\)/);
    assert.match(css, /@media \(max-width:\s*680px\)/);
    assert.match(css, /@media \(max-width:\s*420px\)/);
    assert.match(css, /text-size-adjust:\s*100%/);
    assert.match(css, /\.density-options\s*\{[\s\S]*?grid-template-columns:\s*1fr/);
});
