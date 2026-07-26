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


test('rescues the screenshot bare parenthesized TeX and escapes its numeric percent sign', () => {
    const input = String.raw`并报告 6 次外层迭代、57.58 秒，且明确采用 (C_\eta=1%C_{\text{curtail}})。`;
    const result = math.extractMathSegments(input, { nonce: 'BARESHOT' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.bareInlineFixes, 1);
    assert.equal(result.percentFixes, 1);
    assert.equal(result.automaticFixes, 1);
    assert.equal(result.segments[0].delimiter, 'bare-parentheses');
    assert.equal(result.segments[0].content, String.raw`(C_\eta=1\%C_{\text{curtail}})`);
    assert.equal(result.segments[0].raw, String.raw`(C_\eta=1%C_{\text{curtail}})`);
    assert.equal(result.segments[0].start, input.indexOf('('));
    assert.equal(result.segments[0].end, input.indexOf(')。') + 1);
    assert.ok(result.protectedMarkdown.includes('MD2WMATHBARESHOTI0END'));
    assert.ok(result.normalizedMarkdown.includes(String.raw`\((C_\eta=1\%C_{\text{curtail}})\)`));
});

test('renders rescued bare TeX through KaTeX instead of leaving the source visible', () => {
    const input = String.raw`采用 (C_\eta=1%C_{\text{curtail}})。`;
    const marked = { parse: (value) => `<p>${value}</p>` };
    const katex = { renderToString(value) {
        assert.equal(value, String.raw`(C_\eta=1\%C_{\text{curtail}})`);
        return `<span class="katex-stub">${math.escapeHtml(value)}</span>`;
    } };
    const result = math.renderMarkdownWithMath(input, { marked, katex, sanitize: (html) => html }, { nonce: 'BARERENDER' });
    assert.equal(result.mathCount, 1);
    assert.equal(result.errors.length, 0);
    assert.equal(result.automaticFixes, 1);
    assert.match(result.html, /class="math-node math-inline"/);
    assert.ok(!result.html.includes('MD2WMATH'));
});

test('does not reinterpret ordinary parenthesized prose, Markdown links or function calls as math', () => {
    const input = [
        '普通说明（这里没有公式）。',
        String.raw`[链接](C_\eta=1%C_{\text{curtail}})`,
        String.raw`fn(C_\eta=1%C_{\text{curtail}})`,
        '版本号 (v1_2) 不应转换。'
    ].join('\n');
    const result = math.extractMathSegments(input, { nonce: 'BARENEG' });
    assert.equal(result.segments.length, 0);
    assert.equal(result.bareInlineFixes, 0);
    assert.equal(result.normalizedMarkdown, input);
});

test('bare inline rescue stays disabled inside fenced and inline code', () => {
    const formula = String.raw`(C_\eta=1%C_{\text{curtail}})`;
    const input = ['正文', '```text', formula, '```', `代码 \`${formula}\``].join('\n');
    const result = math.extractMathSegments(input, { nonce: 'BARECODE' });
    assert.equal(result.segments.length, 0);
    assert.equal(result.bareInlineFixes, 0);
});

test('repairBareInline false preserves bare TeX as literal prose', () => {
    const input = String.raw`采用 (C_\eta=1%C_{\text{curtail}})。`;
    const result = math.extractMathSegments(input, { nonce: 'BAREOFF', repairBareInline: false });
    assert.equal(result.segments.length, 0);
    assert.equal(result.bareInlineFixes, 0);
    assert.equal(result.normalizedMarkdown, input);
});

test('numeric percent signs inside explicit inline delimiters are repaired without changing source ranges', () => {
    const input = String.raw`前文 \(C_\eta=1%C_{\text{curtail}}\) 后文`;
    const result = math.extractMathSegments(input, { nonce: 'PERCENT' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.bareInlineFixes, 0);
    assert.equal(result.percentFixes, 1);
    assert.equal(result.automaticFixes, 1);
    assert.equal(result.segments[0].content, String.raw`C_\eta=1\%C_{\text{curtail}}`);
    assert.equal(result.segments[0].raw, String.raw`\(C_\eta=1%C_{\text{curtail}}\)`);
    assert.equal(result.segments[0].start, input.indexOf(String.raw`\(`));
    assert.equal(result.segments[0].end, input.indexOf(String.raw`\)`) + 2);
    assert.ok(result.normalizedMarkdown.includes(String.raw`\(C_\eta=1\%C_{\text{curtail}}\)`));
});

test('already escaped percent signs are not double escaped', () => {
    const input = String.raw`\(C_\eta=1\%C_{\text{curtail}}\)`;
    const result = math.extractMathSegments(input, { nonce: 'PERCENTOK' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.percentFixes, 0);
    assert.equal(result.automaticFixes, 0);
    assert.equal(result.normalizedMarkdown, input);
});

test('full-width parenthesized high-confidence TeX is rescued with standard visible parentheses', () => {
    const input = String.raw`采用（C_\eta=C_{\text{curtail}}）。`;
    const result = math.extractMathSegments(input, { nonce: 'BAREFULL' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].content, String.raw`(C_\eta=C_{\text{curtail}})`);
    assert.equal(result.segments[0].raw, String.raw`（C_\eta=C_{\text{curtail}}）`);
});

test('rescued formula remains editable in Word with eta and curtail subscripts plus a literal percent', () => {
    const runs = math.latexToWordSegments(String.raw`(C_\eta=1\%C_{\text{curtail}})`);
    const plain = runs.map((run) => run.text).join('');
    assert.equal(plain, '(Cη=1%Ccurtail)');
    assert.ok(runs.some((run) => run.text === 'η' && run.subScript));
    assert.ok(runs.some((run) => run.text === 'curtail' && run.subScript));
});


test('numeric percent signs are repaired inside both display delimiter styles', () => {
    const input = String.raw`$$x=25%$$
\[y=50%\]`;
    const result = math.extractMathSegments(input, { nonce: 'DISPLAYPERCENT' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.percentFixes, 2);
    assert.equal(result.automaticFixes, 2);
    assert.equal(result.segments[0].content, String.raw`x=25\%`);
    assert.equal(result.segments[1].content, String.raw`y=50\%`);
    assert.ok(result.normalizedMarkdown.includes(String.raw`$$x=25\%$$`));
    assert.ok(result.normalizedMarkdown.includes(String.raw`\[y=50\%\]`));
});


test('bare inline source mapping remains exact after an earlier loose display repair', () => {
    const input = String.raw`[
\text{x}_1=2
]
随后采用 (C_\eta=1%C_{\text{curtail}})。`;
    const result = math.extractMathSegments(input, { nonce: 'MIXEDREPAIRS' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.looseDelimiterFixes, 1);
    assert.equal(result.bareInlineFixes, 1);
    const bare = result.segments[1];
    const expectedRaw = String.raw`(C_\eta=1%C_{\text{curtail}})`;
    assert.equal(bare.raw, expectedRaw);
    assert.equal(input.slice(bare.start, bare.end), expectedRaw);
    assert.ok(result.normalizedMarkdown.includes(String.raw`\((C_\eta=1\%C_{\text{curtail}})\)`));
});

test('multiple bare formulas normalize independently without offset drift', () => {
    const input = String.raw`甲 (C_\eta=1%C_{\text{curtail}})，乙 (x_1=25%)。`;
    const result = math.extractMathSegments(input, { nonce: 'MULTIBARE' });
    assert.equal(result.segments.length, 2);
    assert.equal(result.bareInlineFixes, 2);
    assert.equal(result.percentFixes, 2);
    assert.equal(result.automaticFixes, 2);
    assert.equal(input.slice(result.segments[0].start, result.segments[0].end), String.raw`(C_\eta=1%C_{\text{curtail}})`);
    assert.equal(input.slice(result.segments[1].start, result.segments[1].end), String.raw`(x_1=25%)`);
    assert.ok(result.normalizedMarkdown.includes(String.raw`\((C_\eta=1\%C_{\text{curtail}})\)`));
    assert.ok(result.normalizedMarkdown.includes(String.raw`\((x_1=25\%)\)`));
});

test('nested function parentheses inside a high-confidence bare formula are preserved', () => {
    const input = String.raw`结果为 (f(x)=C_\eta+x_1)。`;
    const result = math.extractMathSegments(input, { nonce: 'NESTEDBARE' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].content, String.raw`(f(x)=C_\eta+x_1)`);
});

test('full-width numeric percent signs are normalized only in formula context', () => {
    const input = String.raw`效率为（x_1=25％），普通文本 25％ 保持不变。`;
    const result = math.extractMathSegments(input, { nonce: 'FULLPERCENT' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.percentFixes, 1);
    assert.equal(result.segments[0].content, String.raw`(x_1=25\%)`);
    assert.ok(result.normalizedMarkdown.endsWith('普通文本 25％ 保持不变。'));
});

test('bare and explicit math markers inside raw HTML attributes are preserved as attribute text', () => {
    const input = String.raw`<span data-bare="(C_\eta=1%C_{\text{curtail}})" data-explicit="\(x_1=2\)">文字</span>`;
    const result = math.extractMathSegments(input, { nonce: 'HTMLATTR' });
    assert.equal(result.segments.length, 0);
    assert.equal(result.bareInlineFixes, 0);
    assert.equal(result.normalizedMarkdown, input);
    assert.equal(result.protectedMarkdown, input);
});

test('visible text inside raw HTML can still contain a rescued formula', () => {
    const input = String.raw`<span class="result">采用 (C_\eta=1%C_{\text{curtail}})。</span>`;
    const result = math.extractMathSegments(input, { nonce: 'HTMLTEXT' });
    assert.equal(result.segments.length, 1);
    assert.equal(result.segments[0].raw, String.raw`(C_\eta=1%C_{\text{curtail}})`);
    assert.ok(result.protectedMarkdown.startsWith('<span class="result">采用 MD2WMATHHTMLTEXTI0END'));
});

test('raw HTML code-like elements and comments shield formula-looking text', () => {
    const formula = String.raw`(C_\eta=1%C_{\text{curtail}})`;
    const input = [
        `<code>${formula}</code>`,
        `<pre class="sample">${formula}</pre>`,
        `<script>const sample = "${formula}";</script>`,
        `<style>.x::after { content: "${formula}"; }</style>`,
        `<!-- ${formula} -->`
    ].join('\n');
    const result = math.extractMathSegments(input, { nonce: 'HTMLRAW' });
    assert.equal(result.segments.length, 0);
    assert.equal(result.bareInlineFixes, 0);
    assert.equal(result.normalizedMarkdown, input);
});
