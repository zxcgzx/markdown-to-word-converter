'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const math = require('../js/math-engine.js');

const chemical = String.raw`\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2\text{–NH–CO–C(Br)(CH}_3)_2`;

test('extracts \\[...\\] before Markdown can consume the escapes', () => {
    const input = `在化学逻辑上是可以成立的：\n\n\\[\n${chemical}\n\\]\n`;
    const result = math.extractMathSegments(input, { nonce: 'TEST' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].display, true);
    assert.equal(result.segments[0].content, chemical);
    assert.equal(result.segments[0].start, input.indexOf('\\['));
    assert.equal(result.segments[0].end, input.indexOf('\\]') + 2);
    assert.ok(result.protectedMarkdown.includes('MD2WMATHTESTD0END'));
    assert.ok(!result.protectedMarkdown.includes('\\['));
});

test('repairs the loose standalone [ ... ] form from the broken preview', () => {
    const input = `审核结论\n\n[\n${chemical}\n]\n`;
    const normalized = math.normalizeLooseDisplayMath(input);
    assert.equal(normalized.fixes, 1);
    assert.ok(normalized.text.includes('\\['));
    const result = math.extractMathSegments(input, { nonce: 'LOOSE' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.looseDelimiterFixes, 1);
});

test('does not reinterpret ordinary bracketed prose as TeX', () => {
    const input = '说明：\n[\n这只是普通说明文字\n]\n';
    const normalized = math.normalizeLooseDisplayMath(input);
    assert.equal(normalized.fixes, 0);
    assert.equal(normalized.text, input);
});

test('ignores formulas inside fenced and inline code', () => {
    const input = String.raw`正文 $x_1$\n\n\`\`\`text\n\\[x_2\\]\n\`\`\`\n\n代码 \`$x_3$\``;
    const result = math.extractMathSegments(input, { nonce: 'CODE' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].content, 'x_1');
});

test('handles closing parentheses inside a \\(...\\) formula', () => {
    const input = String.raw`前文 \(f(x) = (x+1)^2\) 后文`;
    const result = math.extractMathSegments(input, { nonce: 'PAREN' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].content, 'f(x) = (x+1)^2');
});

test('renders after sanitizing Markdown and exposes source metadata', () => {
    const marked = { parse: (value) => `<p>${value.trim()}</p>` };
    const katex = {
        renderToString(value, options) {
            return `<span class="katex-stub" data-display="${options.displayMode}">${math.escapeHtml(value)}</span>`;
        }
    };
    const input = `\\[${chemical}\\]`;
    const result = math.renderMarkdownWithMath(input, { marked, katex, sanitize: (html) => html }, { nonce: 'RENDER' });
    assert.equal(result.mathCount, 1);
    assert.equal(result.errors.length, 0);
    assert.match(result.html, /class="math-node math-display"/);
    assert.match(result.html, /data-math-index="0"/);
    assert.match(result.html, /data-math-start="0"/);
    assert.match(result.html, new RegExp(`data-math-end="${input.length}"`));
    assert.ok(!result.html.includes('MD2WMATH'));
});

test('KaTeX failures remain visible, keyboard-focusable and locatable', () => {
    const marked = { parse: (value) => `<p>${value}</p>` };
    const katex = { renderToString: () => { throw new Error('bad formula'); } };
    const input = '前 $bad$ 后';
    const result = math.renderMarkdownWithMath(input, { marked, katex, sanitize: (html) => html }, { nonce: 'ERR' });
    assert.equal(result.errors.length, 1);
    assert.equal(result.errors[0].start, 2);
    assert.equal(result.errors[0].end, 7);
    assert.equal(result.errors[0].raw, '$bad$');
    assert.match(result.html, /math-error/);
    assert.match(result.html, /role="button"/);
    assert.match(result.html, /tabindex="0"/);
    assert.match(result.html, /data-math-start="2"/);
    assert.match(result.html, /data-math-end="7"/);
});

test('converts the chemical formula to editable Word text runs with subscripts', () => {
    const runs = math.latexToWordSegments(chemical);
    const plain = runs.map((run) => run.text).join('');
    assert.equal(plain, '玻片–O–Si–(CH2)3–S–S–(CH2)2–NH–CO–C(Br)(CH3)2');
    const subscripts = runs.filter((run) => run.subScript).map((run) => run.text);
    assert.deepEqual(subscripts, ['2', '3', '2', '2', '3', '2']);
});

test('supports superscripts and common symbols for editable Word output', () => {
    const runs = math.latexToWordSegments(String.raw`x^2 + y_{max} = \alpha`);
    assert.ok(runs.some((run) => run.text === '2' && run.superScript));
    assert.ok(runs.some((run) => run.text === 'max' && run.subScript));
    assert.ok(runs.map((run) => run.text).join('').includes('α'));
});

test('supports multiline $$ blocks and inline dollars without treating currency as math', () => {
    const input = '价格 $5 与 $10，不是公式。\n\n$$\na^2+b^2=c^2\n$$\n以及 $x_1$。';
    const result = math.extractMathSegments(input, { nonce: 'DOLLAR' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.segments[0].display, true);
    assert.equal(result.segments[1].content, 'x_1');
});

test('reports unclosed display and parenthesis delimiters with source offsets', () => {
    const input = 'A \\[x\nB \\(y';
    const result = math.extractMathSegments(input, { nonce: 'UNCLOSED' });
    assert.equal(result.warnings.length, 2);
    assert.deepEqual(result.warnings.map((item) => item.delimiter), ['\\[', '\\(']);
    assert.deepEqual(result.warnings.map((item) => item.index), [2, 8]);
});

test('decodeMathSource accepts a rendered element-like object', () => {
    const encoded = encodeURIComponent(String.raw`x_1`);
    const element = { getAttribute(name) { return name === 'data-math-source' ? encoded : ''; } };
    assert.equal(math.decodeMathSource(element), 'x_1');
});

test('loose display-math repair keeps exact source ranges despite inserted backslashes', () => {
    const input = `前文\n  [  \n${chemical}\n  ]  \n后文`;
    const result = math.extractMathSegments(input, { nonce: 'MAP' });
    assert.equal(result.looseDelimiterFixes, 1);
    assert.equal(result.segments.length, 1);
    const expectedStart = input.indexOf('[');
    const expectedEnd = input.indexOf(']  \n') + 1;
    const segment = result.segments[0];
    assert.equal(segment.start, expectedStart);
    assert.equal(segment.end, expectedEnd);
    assert.equal(segment.raw, input.slice(expectedStart, expectedEnd));
    assert.ok(segment.normalizedEnd > segment.end);
    assert.equal(input.slice(segment.start, segment.end), segment.raw);
});

test('multiple repaired loose formulas each retain their own original source range', () => {
    const input = `[\n${chemical}\n]\n中间文字\n[\n${chemical}\n]\n结束`;
    const result = math.extractMathSegments(input, { nonce: 'MULTIMAP' });
    assert.equal(result.looseDelimiterFixes, 2);
    assert.equal(result.segments.length, 2);
    const firstStart = input.indexOf('[');
    const firstEnd = input.indexOf(']') + 1;
    const secondStart = input.indexOf('[', firstEnd);
    const secondEnd = input.indexOf(']', secondStart) + 1;
    assert.deepEqual(result.segments.map(({ start, end }) => [start, end]), [
        [firstStart, firstEnd],
        [secondStart, secondEnd]
    ]);
    assert.equal(result.segments[1].raw, input.slice(secondStart, secondEnd));
});

test('a KaTeX failure in repaired loose math points to the original bracket block only', () => {
    const input = '标题\n\n[\n\\badcommand{x_1}\n]\n\n结尾';
    const marked = { parse: (value) => `<p>${value}</p>` };
    const katex = { renderToString: () => { throw new Error('Undefined control sequence'); } };
    const result = math.renderMarkdownWithMath(input, { marked, katex, sanitize: (html) => html }, { nonce: 'LOOSEERR' });
    assert.equal(result.errors.length, 1);
    const expectedStart = input.indexOf('[');
    const expectedEnd = input.indexOf(']') + 1;
    assert.equal(result.errors[0].start, expectedStart);
    assert.equal(result.errors[0].end, expectedEnd);
    assert.equal(result.errors[0].raw, input.slice(expectedStart, expectedEnd));
    assert.match(result.html, new RegExp(`data-math-start="${expectedStart}"`));
    assert.match(result.html, new RegExp(`data-math-end="${expectedEnd}"`));
});

test('loose formula repair stays disabled until a real closing code fence', () => {
    const input = [
        '```text',
        '```not-a-close',
        '[',
        chemical,
        ']',
        '```'
    ].join('\n');
    const normalized = math.normalizeLooseDisplayMath(input);
    assert.equal(normalized.fixes, 0);
    assert.equal(normalized.text, input);
    const result = math.extractMathSegments(input, { nonce: 'FENCESTRICT' });
    assert.equal(result.looseDelimiterFixes, 0);
    assert.equal(result.segments.length, 0);
});
