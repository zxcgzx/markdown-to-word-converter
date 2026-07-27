'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const professional = require(path.join(root, 'js', 'professional.js'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const app = fs.readFileSync(path.join(root, 'js', 'app.js'), 'utf8');
const publishing = fs.readFileSync(path.join(root, 'js', 'publishing.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'professional.css'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

test('v5.5 loads the professional module and its final cascade layer', () => {
    assert.equal(pkg.version, '5.5.0');
    assert.match(html, /css\/professional\.css\?v=5\.5/);
    assert.match(html, /js\/professional\.js\?v=5\.5/);
    assert.ok(html.indexOf('css/publishing.css?v=5.5') < html.indexOf('css/professional.css?v=5.5'));
    assert.ok(html.indexOf('js/publishing.js?v=5.5') < html.indexOf('js/professional.js?v=5.5'));
    assert.ok(html.indexOf('js/professional.js?v=5.5') < html.indexOf('js/app.js?v=5.5'));
    assert.match(pkg.scripts.check, /professional\.js/);
});

test('professional settings normalize presets and keep conservative bounds', () => {
    const value = professional.normalizeSettings({
        professionalStyle: 'academic', coverEnabled: true, tocEnabled: true,
        tocDepth: 99, wordFirstLineChars: 9, wordParagraphAfterPt: -4,
        pageNumberFormat: 'bad', wordTableStyle: 'bad'
    });
    assert.equal(value.professionalStyle, 'academic');
    assert.equal(value.coverEnabled, true);
    assert.equal(value.tocEnabled, true);
    assert.equal(value.tocDepth, 6);
    assert.equal(value.wordFirstLineChars, 4);
    assert.equal(value.wordParagraphAfterPt, 0);
    assert.equal(value.pageNumberFormat, 'current');
    assert.equal(value.wordTableStyle, 'clean');
    assert.ok(Object.isFrozen(value));
});

test('style presets provide Word typography and table color tokens', () => {
    for (const id of ['business', 'formal', 'academic', 'laboratory', 'monochrome', 'sop']) {
        const preset = professional.getPreset(id);
        assert.equal(preset.id, id);
        assert.ok(preset.patch.wordFont);
        assert.ok(preset.patch.wordFontSize >= 9);
        assert.match(preset.colors.heading, /^[0-9A-F]{6}$/);
        assert.match(preset.colors.tableBorder, /^[0-9A-F]{6}$/);
    }
    assert.equal(professional.getPresetPatch('formal').headingNumbering, 'decimal');
});

test('heading numbers support decimal and chapter schemes without mutating source', () => {
    const headings = [
        { level: 1, text: '概述' }, { level: 2, text: '范围' }, { level: 3, text: '边界' },
        { level: 2, text: '方法' }, { level: 1, text: '结果' }
    ];
    const decimal = professional.computeHeadingNumbers(headings, 'decimal');
    assert.deepEqual(decimal.map((item) => item.number), ['1', '1.1', '1.1.1', '1.2', '2']);
    const chapter = professional.computeHeadingNumbers(headings, 'chapter');
    assert.deepEqual(chapter.map((item) => item.number), ['第 1 章', '1.1', '1.1.1', '1.2', '第 2 章']);
    assert.equal(headings[0].number, undefined);
});

test('metadata placeholders and page number formats are deterministic', () => {
    const meta = professional.metadata({ documentTitle: '实验报告', documentAuthor: 'Boning', documentVersion: 'V2.0', documentNumber: 'LAB-02', documentDate: '2026-07-27' });
    assert.equal(professional.substitutePlaceholders('{number} · {title} · {version}', meta), 'LAB-02 · 实验报告 · V2.0');
    const docx = { PageNumber: { CURRENT: 'CURRENT', TOTAL_PAGES: 'TOTAL' } };
    assert.deepEqual(professional.pageNumberTokens({ pageNumberFormat: 'page-current-total' }, docx), ['第 ', 'CURRENT', ' 页 / 共 ', 'TOTAL', ' 页']);
    assert.deepEqual(professional.pageNumberTokens({ pageNumberEnabled: false }, docx), []);
});

test('section and caption markers remain valid Markdown-safe HTML', () => {
    assert.match(professional.createSectionBreakMarker('landscape'), /data-orientation="landscape"/);
    assert.match(professional.createSectionBreakMarker('portrait'), /data-orientation="portrait"/);
    const caption = professional.createCaptionMarker('figure', '<系统图>');
    assert.match(caption, /data-caption-kind="figure"/);
    assert.match(caption, /&lt;系统图&gt;/);
});

test('mixed-orientation section splitting preserves content order and trailing sections', () => {
    const block = (name) => ({ name, matches: () => false });
    const marker = (orientation) => ({ dataset: { orientation }, matches: (selector) => selector.includes('section-break') });
    const result = professional.splitElementsIntoSections([block('a'), marker('landscape'), block('b'), marker('portrait'), block('c')], 'portrait');
    assert.deepEqual(result.map((section) => section.orientation), ['portrait', 'landscape', 'portrait']);
    assert.deepEqual(result.map((section) => section.elements.map((item) => item.name)), [['a'], ['b'], ['c']]);
});

test('Word numbering levels expose six stable levels', () => {
    const levels = professional.getHeadingNumberingLevels({ headingNumbering: 'decimal' }, { LevelFormat: { DECIMAL: 'decimal' }, AlignmentType: { START: 'start' } });
    assert.equal(levels.length, 6);
    assert.equal(levels[0].text, '%1');
    assert.equal(levels[2].text, '%1.%2.%3');
    const chapter = professional.getHeadingNumberingLevels({ headingNumbering: 'chapter' }, {});
    assert.equal(chapter[0].text, '第 %1 章');
});

test('professional delivery UI stays inside the existing drawer and settings dialog', () => {
    for (const id of [
        'professionalToolPanel', 'professionalQuickPreset', 'professionalQuickCover', 'professionalQuickToc',
        'settingsTabProfessional', 'settingsProfessionalSection', 'coverEnabled', 'tocEnabled', 'headingNumbering',
        'headerEnabled', 'pageNumberEnabled', 'wordTableStyle', 'captionMode'
    ]) assert.match(html, new RegExp(`id="${id}"`));
    assert.equal((html.match(/<dialog\b/g) || []).length, 1);
    assert.match(html, /data-action="open-professional"/);
    assert.match(html, /data-action="insert-section-landscape"/);
    assert.match(html, /data-action="insert-caption"/);
});

test('DOCX export is wired for cover, TOC, numbering, headers, links and fixed tables', () => {
    for (const fragment of [
        'new d.TableOfContents', 'new d.Header', 'new d.Footer', 'new d.Bookmark',
        'new d.ExternalHyperlink', 'new d.InternalHyperlink', 'buildDocxNumbering',
        'buildProfessionalDocxSections', 'TableLayoutType?.FIXED', 'repeatTableHeader'
    ]) assert.ok(app.includes(fragment), `missing ${fragment}`);
    assert.match(app, /description: `由浏览器本地生成/);
    assert.match(app, /category: meta\.classification/);
    assert.match(app, /page\.pageNumbers = \{ start: 1 \}/);
});

test('A4 preview includes professional cover, TOC, header/footer and mixed orientations', () => {
    assert.match(publishing, /Md2WordProfessional\?\.preparePreviewBlocks/);
    assert.match(publishing, /md2word-section-break/);
    assert.match(publishing, /mixed|混合方向/);
    assert.match(publishing, /a4-page-header/);
    assert.match(publishing, /a4-page-footer/);
    for (const selector of ['.md2word-cover-preview', '.md2word-toc-preview', '.a4-page-header', '.a4-page-footer']) assert.ok(css.includes(selector));
});

test('A4 full-page cover and TOC do not create a synthetic leading blank page', () => {
    assert.match(publishing, /if \(!current\.length && !allowEmpty\) return;/);
    assert.doesNotMatch(publishing, /if \(!current\.length && pages\.length && !allowEmpty\) return;/);
});

test('page-number fields remain direct paragraph children and cover titlePage does not leak into content', () => {
    assert.match(app, /function createPageFieldChildren\(tokens\)/);
    assert.match(app, /children\.push\(\.\.\.createPageFieldChildren\(pageTokens\)\)/);
    assert.doesNotMatch(app, /new d\.TextRun\(\{[^}]*children:\s*pageTokens/s);
    assert.match(app, /titlePage:\s*!settings\.coverEnabled && index === 0 && settings\.firstPageDifferent/);
});

test('a leading section marker changes orientation without creating an empty section', () => {
    const block = (name) => ({ name, matches: () => false });
    const marker = (orientation) => ({ dataset: { orientation }, matches: (selector) => selector.includes('section-break') });
    const result = professional.splitElementsIntoSections([marker('landscape'), block('wide'), marker('portrait'), block('body')], 'portrait');
    assert.deepEqual(result.map((section) => section.orientation), ['landscape', 'portrait']);
    assert.deepEqual(result.map((section) => section.elements.map((item) => item.name)), [['wide'], ['body']]);
});

test('cover preview stays portrait and internal heading links use bookmark aliases', () => {
    assert.match(publishing, /kind === 'cover'[\s\S]*wordOrientation: 'portrait'/);
    assert.match(app, /function buildHeadingBookmarkMap\(preview, settings\)/);
    assert.match(app, /normalizeInternalAnchor\(href\.slice\(1\)\)/);
    assert.match(app, /if \(anchor\) runs\.push\(new d\.InternalHyperlink/);
    assert.doesNotMatch(app, /bookmarkId\(0, sourceId\)/);
});

test('A4 page numbers restart after the cover and first-page suppression matches DOCX behavior', () => {
    assert.match(publishing, /record\.kind === 'cover' \? null : numberedPageIndex\+\+/);
    assert.match(publishing, /previewPageNumberText\(pageNumberIndex, totalPages, professional\)/);
    assert.match(publishing, /!professional\.coverEnabled && professional\.firstPageDifferent && pageNumberIndex === 0/);
});
