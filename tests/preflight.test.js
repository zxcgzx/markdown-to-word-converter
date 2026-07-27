'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const preflight = require('../js/preflight.js');

test('returns empty, ready, warning and error readiness states', () => {
    assert.equal(preflight.analyze('', {}).readiness, 'empty');
    assert.equal(preflight.analyze('# 标题\n\n正文', {}).readiness, 'ready');
    assert.equal(preflight.analyze('# 标题\n\n### 跳级标题', {}).readiness, 'warning');
    assert.equal(preflight.analyze('```js\nconst x = 1;', {}).readiness, 'error');
});

test('maps KaTeX render errors back to exact source line and column', () => {
    const markdown = '前文\n\n\\[\\badcommand{x}\\]\n';
    const start = markdown.indexOf('\\[');
    const end = markdown.indexOf('\\]') + 2;
    const report = preflight.analyze(markdown, {
        segments: [{ index: 0, start, end, content: '\\badcommand{x}' }],
        errors: [{ index: 0, start, end, message: 'Undefined control sequence' }]
    });
    assert.equal(report.errorCount, 1);
    assert.equal(report.issues[0].type, 'math-render');
    assert.equal(report.issues[0].line, 3);
    assert.equal(report.issues[0].column, 1);
    assert.equal(report.issues[0].locatable, true);
});

test('treats unclosed math delimiters as blocking errors', () => {
    const markdown = '正文\n\n\\[x_1 + y_1';
    const start = markdown.indexOf('\\[');
    const report = preflight.analyze(markdown, {
        segments: [],
        errors: [],
        warnings: [{ type: 'unclosed', delimiter: '\\[', index: start }]
    });
    assert.equal(report.errorCount, 1);
    assert.equal(report.issues[0].type, 'math-delimiter');
    assert.equal(report.issues[0].start, start);
});

test('warns when complex math will be linearized in Word', () => {
    const markdown = String.raw`\[\frac{a}{b}\]`;
    const report = preflight.analyze(markdown, {
        segments: [{ index: 0, start: 0, end: markdown.length, content: String.raw`\frac{a}{b}` }],
        errors: [], warnings: []
    });
    assert.equal(report.errorCount, 0);
    assert.equal(report.warningCount, 1);
    assert.equal(report.issues[0].type, 'math-linearization');
});

test('detects unclosed fenced code blocks and ignores checks inside closed fences', () => {
    const unclosed = preflight.analyze('```md\n### 标题\n![图]()', {});
    assert.equal(unclosed.errorCount, 1);
    assert.equal(unclosed.issues[0].type, 'code-fence');

    const closed = preflight.analyze('```md\n### 标题\n![图]()\n```', {});
    assert.equal(closed.total, 0);
});

test('warns on heading-level jumps with locatable source positions', () => {
    const report = preflight.analyze('# 一级\n\n### 三级', {});
    assert.equal(report.warningCount, 1);
    assert.equal(report.issues[0].type, 'heading-level');
    assert.equal(report.issues[0].line, 3);
});

test('warns on Markdown tables wider than eight columns', () => {
    const markdown = '|a|b|c|d|e|f|g|h|i|\n|---|---|---|---|---|---|---|---|---|';
    const report = preflight.analyze(markdown, {});
    assert.equal(report.warningCount, 1);
    assert.equal(report.issues[0].type, 'wide-table');
    assert.match(report.issues[0].title, /9 列/);
});

test('reports empty and non-embeddable image targets correctly', () => {
    const empty = preflight.analyze('![空图]()', {});
    assert.equal(empty.errorCount, 1);
    assert.equal(empty.issues[0].type, 'image-empty');

    const external = preflight.analyze('![网络图](https://example.com/a.png)', {});
    assert.equal(external.warningCount, 1);
    assert.equal(external.issues[0].type, 'image-remote');

    const embedded = preflight.analyze('![内嵌](data:image/png;base64,AAAA)', {});
    assert.equal(embedded.total, 0);
});

test('warns on empty links without misclassifying images', () => {
    const report = preflight.analyze('[说明]()\n\n![图片](data:image/png;base64,AAAA)', {});
    assert.equal(report.warningCount, 1);
    assert.equal(report.issues[0].type, 'link-empty');
});

test('inline code shields headings, images and links from checks', () => {
    const report = preflight.analyze('正文 `### 标题 ![图]() [链接]()`', {});
    assert.equal(report.total, 0);
});

test('lineColumn and length-preserving inline-code stripping are deterministic', () => {
    assert.deepEqual(preflight.lineColumn('a\nbc', 3), { line: 2, column: 2 });
    const input = '前 `![图]()` 后';
    const stripped = preflight.stripInlineCodePreserveLength(input);
    assert.equal(stripped.length, input.length);
    assert.ok(!stripped.includes('!['));
});

test('deduplicates the same issue and orders errors before warnings', () => {
    const markdown = '\\[x\n\n### 跳级';
    const report = preflight.analyze(markdown, {
        warnings: [
            { delimiter: '\\[', index: 0 },
            { delimiter: '\\[', index: 0 }
        ],
        errors: [], segments: []
    });
    assert.equal(report.issues.filter((issue) => issue.type === 'math-delimiter').length, 1);
    assert.equal(report.issues[0].severity, 'error');
});

test('global render failures with null offsets are not incorrectly locatable at character zero', () => {
    const report = preflight.analyze('正文', {
        segments: [],
        errors: [{ start: null, end: null, message: 'KaTeX 未加载' }]
    });
    assert.equal(report.errorCount, 1);
    assert.equal(report.issues[0].start, null);
    assert.equal(report.issues[0].end, null);
    assert.equal(report.issues[0].line, null);
    assert.equal(report.issues[0].locatable, false);
});

test('inline-code masking preserves UTF-16 offsets when code contains emoji', () => {
    const markdown = '前 `😀` 后 [链接]()';
    const stripped = preflight.stripInlineCodePreserveLength(markdown);
    assert.equal(stripped.length, markdown.length);
    const report = preflight.analyze(markdown, {});
    assert.equal(report.warningCount, 1);
    const expectedStart = markdown.indexOf('[链接]');
    assert.equal(report.issues[0].start, expectedStart);
    assert.equal(markdown.slice(report.issues[0].start, report.issues[0].end), '[链接]()');
});

test('a fenced-code line with trailing text does not close the block', () => {
    const markdown = [
        '```text',
        '```not-a-close',
        '### 代码里的标题',
        '![代码里的空图片]()',
        '```',
        '# 正常标题'
    ].join('\n');
    const report = preflight.analyze(markdown, {});
    assert.equal(report.errorCount, 0);
    assert.equal(report.warningCount, 0);
    assert.deepEqual(report.issues, []);
});

test('recognizes local asset references as embeddable and diagnoses unstable image sources', () => {
    const asset = preflight.analyze('<img src="data:image/gif;base64,R0lGODlhAQABAAAAACwAAAAAAQABAAA=" data-md2word-asset="asset-1" data-md2word-asset-src="md2word-assets/asset-1">', {});
    assert.equal(asset.total, 0);
    assert.equal(preflight.classifyImageTarget('md2word-assets/asset-1').kind, 'asset');

    const relative = preflight.analyze('![相对图](images/chart.png)', {});
    assert.equal(relative.warningCount, 1);
    assert.equal(relative.issues[0].type, 'image-relative');

    const blob = preflight.analyze('![临时图](blob:https://example.com/id)', {});
    assert.equal(blob.errorCount, 1);
    assert.equal(blob.issues[0].type, 'image-blob');

    const webp = preflight.analyze('![WebP](data:image/webp;base64,AAAA)', {});
    assert.equal(webp.warningCount, 1);
    assert.equal(webp.issues[0].type, 'image-format');
});

test('checks raw HTML image elements without flagging valid local assets', () => {
    const remote = preflight.analyze('<img src="https://example.com/figure.png" alt="图">', {});
    assert.equal(remote.warningCount, 1);
    assert.equal(remote.issues[0].type, 'image-remote');
    assert.equal(remote.issues[0].locatable, true);

    const local = preflight.analyze('<img src="md2word-assets/asset-2" data-md2word-asset="asset-2">', {});
    assert.equal(local.total, 0);
});
