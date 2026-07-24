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

test('renders after sanitizing Markdown, preserving KaTeX output', () => {
    const marked = {
        parse(value) {
            // Simulate Marked wrapping a display token in a paragraph.
            return `<p>${value.trim()}</p>`;
        }
    };
    const katex = {
        renderToString(value, options) {
            return `<span class="katex-stub" data-display="${options.displayMode}">${math.escapeHtml(value)}</span>`;
        }
    };
    const sanitize = (html) => html.replace(/<script[\s\S]*?<\/script>/gi, '');
    const input = `\\[${chemical}\\]`;
    const result = math.renderMarkdownWithMath(input, { marked, katex, sanitize }, { nonce: 'RENDER' });
    assert.equal(result.mathCount, 1);
    assert.equal(result.errors.length, 0);
    assert.ok(result.html.includes('katex-stub'));
    assert.ok(result.html.includes('math-display'));
    assert.ok(!result.html.includes('MD2WMATH'));
});

test('falls back visibly when KaTeX rejects a formula', () => {
    const marked = { parse: (value) => `<p>${value}</p>` };
    const katex = { renderToString: () => { throw new Error('bad formula'); } };
    const result = math.renderMarkdownWithMath('$bad$', { marked, katex, sanitize: (html) => html }, { nonce: 'ERR' });
    assert.equal(result.errors.length, 1);
    assert.ok(result.html.includes('math-error'));
    assert.ok(result.html.includes('bad'));
});

test('converts the chemical formula to editable Word text runs with subscripts', () => {
    const runs = math.latexToWordSegments(chemical);
    const plain = runs.map((run) => run.text).join('');
    assert.equal(plain, '玻片–O–Si–(CH2)3–S–S–(CH2)2–NH–CO–C(Br)(CH3)2');
    const subscripts = runs.filter((run) => run.subScript).map((run) => run.text);
    assert.deepEqual(subscripts, ['2', '3', '2', '2', '3', '2']);
});

test('supports multiline $$ blocks and inline dollars without treating currency as math', () => {
    const input = '价格 $5 与 $10，不是公式。\n\n$$\na^2+b^2=c^2\n$$\n以及 $x_1$。';
    const result = math.extractMathSegments(input, { nonce: 'DOLLAR' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.segments[0].display, true);
    assert.equal(result.segments[1].content, 'x_1');
});
