/*
 * Markdown → Word Converter: math preprocessing/rendering engine
 *
 * Why this exists:
 * Markdown parsers treat \[ \] and \( \) as backslash escapes.  If math is
 * rendered only after marked.parse(), the delimiters may already have become
 * plain [ ] / ( ), so KaTeX can no longer recognise them.  This module extracts
 * math before Markdown parsing, replaces it with collision-resistant tokens,
 * then restores rendered KaTeX HTML afterwards.
 */
(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    } else {
        root.Md2WordMath = api;
    }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const GREEK_SYMBOLS = {
        alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε',
        zeta: 'ζ', eta: 'η', theta: 'θ', iota: 'ι', kappa: 'κ',
        lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π',
        rho: 'ρ', sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ',
        chi: 'χ', psi: 'ψ', omega: 'ω',
        Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ',
        Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω'
    };

    const SYMBOLS = {
        times: '×', cdot: '·', pm: '±', mp: '∓', div: '÷',
        le: '≤', leq: '≤', ge: '≥', geq: '≥', neq: '≠', approx: '≈',
        equiv: '≡', sim: '∼', in: '∈', notin: '∉', subset: '⊂',
        subseteq: '⊆', supset: '⊃', supseteq: '⊇', infinity: '∞',
        infty: '∞', partial: '∂', nabla: '∇', sum: '∑', prod: '∏',
        int: '∫', oint: '∮', therefore: '∴', because: '∵',
        to: '→', rightarrow: '→', longrightarrow: '⟶', leftarrow: '←',
        leftrightarrow: '↔', Rightarrow: '⇒', Leftarrow: '⇐',
        Leftrightarrow: '⇔', degree: '°', angstrom: 'Å',
        ldots: '…', cdots: '⋯', dots: '…', bullet: '•',
        cap: '∩', cup: '∪', land: '∧', lor: '∨', neg: '¬'
    };

    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function simpleHash(value) {
        let hash = 2166136261;
        const text = String(value);
        for (let i = 0; i < text.length; i += 1) {
            hash ^= text.charCodeAt(i);
            hash = Math.imul(hash, 16777619);
        }
        return (hash >>> 0).toString(36).toUpperCase();
    }

    function isEscaped(text, index) {
        let slashCount = 0;
        for (let i = index - 1; i >= 0 && text[i] === '\\'; i -= 1) {
            slashCount += 1;
        }
        return slashCount % 2 === 1;
    }

    function lineEndIndex(text, start) {
        const next = text.indexOf('\n', start);
        return next === -1 ? text.length : next + 1;
    }

    function consumeFence(text, start) {
        if (start !== 0 && text[start - 1] !== '\n') return null;
        const firstEnd = lineEndIndex(text, start);
        const firstLine = text.slice(start, firstEnd).replace(/\n$/, '');
        const match = firstLine.match(/^ {0,3}(`{3,}|~{3,})/);
        if (!match) return null;

        const marker = match[1][0];
        const markerLength = match[1].length;
        let cursor = firstEnd;
        while (cursor < text.length) {
            const end = lineEndIndex(text, cursor);
            const line = text.slice(cursor, end).replace(/\n$/, '');
            const closeMatch = line.match(/^ {0,3}(`+|~+)\s*$/);
            if (closeMatch && closeMatch[1][0] === marker && closeMatch[1].length >= markerLength) {
                return { end, raw: text.slice(start, end) };
            }
            cursor = end;
        }
        return { end: text.length, raw: text.slice(start) };
    }

    function findClosing(text, start, closing, options = {}) {
        const { singleLine = false, rejectDoubleDollar = false } = options;
        let cursor = start;
        while (cursor < text.length) {
            if (singleLine && text[cursor] === '\n') return -1;
            const found = text.indexOf(closing, cursor);
            if (found === -1) return -1;
            if (singleLine && text.slice(cursor, found).includes('\n')) return -1;
            if (!isEscaped(text, found)) {
                if (rejectDoubleDollar && (text[found - 1] === '$' || text[found + 1] === '$')) {
                    cursor = found + 1;
                    continue;
                }
                return found;
            }
            cursor = found + closing.length;
        }
        return -1;
    }

    function isPlausibleInlineDollarOpen(text, index) {
        const next = text[index + 1];
        if (!next || next === '$' || /\s/.test(next)) return false;
        return !isEscaped(text, index);
    }

    function isPlausibleInlineDollarClose(text, index) {
        const previous = text[index - 1];
        if (!previous || /\s/.test(previous)) return false;
        if (text[index + 1] === '$') return false;
        return !isEscaped(text, index);
    }

    function findInlineDollarClose(text, start) {
        let cursor = start;
        while (cursor < text.length && text[cursor] !== '\n') {
            const found = text.indexOf('$', cursor);
            if (found === -1 || text.slice(cursor, found).includes('\n')) return -1;
            if (isPlausibleInlineDollarClose(text, found)) return found;
            cursor = found + 1;
        }
        return -1;
    }

    function isProbablyLatex(body) {
        const text = String(body || '').trim();
        if (!text) return false;
        let score = 0;
        if (/\\(?:text|mathrm|mathbf|mathit|operatorname|frac|sqrt|begin|end|left|right|ce|pu)\b/.test(text)) score += 3;
        if (/\\[A-Za-z]+/.test(text)) score += 2;
        if (/(?:^|[^\\])[_^](?:\{[^}\n]+\}|[A-Za-z0-9])/.test(text)) score += 2;
        if (/\\begin\{[^}]+\}/.test(text) || /&|\\\\/.test(text)) score += 1;
        if (/\{[^}\n]+\}/.test(text)) score += 1;
        return score >= 3;
    }

    function createSourceLineRecords(text) {
        const records = [];
        let start = 0;
        let line = 1;
        while (start <= text.length) {
            const newline = text.indexOf('\n', start);
            const end = newline === -1 ? text.length : newline;
            records.push({
                value: text.slice(start, end),
                start,
                end,
                endWithNewline: newline === -1 ? end : end + 1,
                line
            });
            if (newline === -1) break;
            start = newline + 1;
            line += 1;
        }
        return records;
    }

    function normalizedOffsetToSource(offset, sourceMap, sourceLength) {
        const maximum = Number.isFinite(Number(sourceLength)) ? Math.max(0, Number(sourceLength)) : Number.MAX_SAFE_INTEGER;
        const numericOffset = Number(offset);
        const safe = Math.max(0, Number.isFinite(numericOffset) ? numericOffset : 0);
        const insertions = sourceMap && Array.isArray(sourceMap.insertions) ? sourceMap.insertions : [];
        let mapped = safe;
        for (const insertion of insertions) {
            if (safe <= insertion) break;
            mapped -= 1;
        }
        return Math.max(0, Math.min(maximum, mapped));
    }

    /**
     * Repairs the exact failure mode shown in the report: Markdown has already
     * lost the backslashes and a display formula appears as a standalone [ ... ].
     * Only strongly TeX-like blocks are converted, so ordinary bracketed prose
     * remains untouched. The insertion map keeps every rendered formula linked
     * to the exact range in the original editor text.
     */
    function normalizeLooseDisplayMath(source) {
        const sourceText = String(source || '').replace(/\r\n?/g, '\n');
        const records = createSourceLineRecords(sourceText);
        const insertions = [];
        let output = '';
        let sourceCursor = 0;
        let fixes = 0;
        let inFence = false;
        let fenceChar = '';
        let fenceLength = 0;

        function appendOriginal(start, end) {
            if (end > start) output += sourceText.slice(start, end);
        }

        function appendInsertedBackslash() {
            insertions.push(output.length);
            output += '\\';
        }

        for (let i = 0; i < records.length; i += 1) {
            const record = records[i];
            const line = record.value;

            if (!inFence) {
                // Opening fences may include an info string (```js).
                const openingFence = line.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/);
                if (openingFence) {
                    inFence = true;
                    fenceChar = openingFence[1][0];
                    fenceLength = openingFence[1].length;
                    continue;
                }
            } else {
                // Closing fences must contain only the marker and whitespace.
                const closingFence = line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
                if (closingFence && closingFence[1][0] === fenceChar && closingFence[1].length >= fenceLength) {
                    inFence = false;
                }
                continue;
            }

            if (line.trim() === '[') {
                let closeIndex = -1;
                const maxLookAhead = Math.min(records.length, i + 80);
                for (let j = i + 1; j < maxLookAhead; j += 1) {
                    if (records[j].value.trim() === ']') {
                        closeIndex = j;
                        break;
                    }
                    if (/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/.test(records[j].value)) break;
                }

                if (closeIndex > i + 1) {
                    const closeRecord = records[closeIndex];
                    const body = sourceText.slice(record.endWithNewline, closeRecord.start);
                    if (isProbablyLatex(body)) {
                        const openingBracket = record.start + line.indexOf('[');
                        const closingBracket = closeRecord.start + closeRecord.value.indexOf(']');

                        appendOriginal(sourceCursor, openingBracket);
                        appendInsertedBackslash();
                        appendOriginal(openingBracket, closingBracket);
                        appendInsertedBackslash();
                        sourceCursor = closingBracket;
                        fixes += 1;
                        i = closeIndex;
                    }
                }
            }
        }

        appendOriginal(sourceCursor, sourceText.length);
        return {
            text: output,
            fixes,
            sourceText,
            sourceMap: { insertions }
        };
    }

    function extractMathSegments(source, options = {}) {
        const rawSourceText = String(source || '').replace(/\r\n?/g, '\n');
        const normalized = options.repairLooseDelimiters === false
            ? { text: rawSourceText, sourceText: rawSourceText, sourceMap: { insertions: [] }, fixes: 0 }
            : normalizeLooseDisplayMath(rawSourceText);
        const text = normalized.text;
        const sourceText = normalized.sourceText || rawSourceText;
        const sourceMap = normalized.sourceMap || { insertions: [] };
        const toSourceOffset = (offset) => normalizedOffsetToSource(offset, sourceMap, sourceText.length);
        const nonce = options.nonce || simpleHash(`${text.length}:${text.slice(0, 64)}:${text.slice(-64)}`);
        const segments = [];
        const warnings = [];
        let output = '';
        let cursor = 0;

        function addSegment(normalizedStart, normalizedEnd, content, display, delimiter) {
            const index = segments.length;
            const token = `MD2WMATH${nonce}${display ? 'D' : 'I'}${index}END`;
            const start = toSourceOffset(normalizedStart);
            const end = toSourceOffset(normalizedEnd);
            const raw = sourceText.slice(start, end);
            segments.push({
                index,
                token,
                raw,
                content,
                display,
                delimiter,
                start,
                end,
                normalizedStart,
                normalizedEnd
            });
            output += token;
        }

        while (cursor < text.length) {
            const fence = consumeFence(text, cursor);
            if (fence) {
                output += fence.raw;
                cursor = fence.end;
                continue;
            }

            if (text[cursor] === '`') {
                let runLength = 1;
                while (text[cursor + runLength] === '`') runLength += 1;
                const marker = '`'.repeat(runLength);
                const close = text.indexOf(marker, cursor + runLength);
                if (close !== -1 && !text.slice(cursor + runLength, close).includes('\n\n')) {
                    output += text.slice(cursor, close + runLength);
                    cursor = close + runLength;
                    continue;
                }
            }

            if (text.startsWith('$$', cursor) && !isEscaped(text, cursor)) {
                const close = findClosing(text, cursor + 2, '$$');
                if (close !== -1) {
                    addSegment(cursor, close + 2, text.slice(cursor + 2, close).trim(), true, '$$');
                    cursor = close + 2;
                    continue;
                }
                warnings.push({ type: 'unclosed', delimiter: '$$', index: toSourceOffset(cursor), normalizedIndex: cursor });
            }

            if (text.startsWith('\\[', cursor) && !isEscaped(text, cursor)) {
                const close = findClosing(text, cursor + 2, '\\]');
                if (close !== -1) {
                    addSegment(cursor, close + 2, text.slice(cursor + 2, close).trim(), true, '\\[');
                    cursor = close + 2;
                    continue;
                }
                warnings.push({ type: 'unclosed', delimiter: '\\[', index: toSourceOffset(cursor), normalizedIndex: cursor });
            }

            if (text.startsWith('\\(', cursor) && !isEscaped(text, cursor)) {
                const close = findClosing(text, cursor + 2, '\\)', { singleLine: false });
                if (close !== -1) {
                    addSegment(cursor, close + 2, text.slice(cursor + 2, close).trim(), false, '\\(');
                    cursor = close + 2;
                    continue;
                }
                warnings.push({ type: 'unclosed', delimiter: '\\(', index: toSourceOffset(cursor), normalizedIndex: cursor });
            }

            if (text[cursor] === '$' && isPlausibleInlineDollarOpen(text, cursor)) {
                const close = findInlineDollarClose(text, cursor + 1);
                if (close !== -1) {
                    const content = text.slice(cursor + 1, close).trim();
                    if (content) {
                        addSegment(cursor, close + 1, content, false, '$');
                        cursor = close + 1;
                        continue;
                    }
                }
            }

            output += text[cursor];
            cursor += 1;
        }

        return {
            protectedMarkdown: output,
            normalizedMarkdown: text,
            sourceMarkdown: sourceText,
            sourceMap,
            segments,
            warnings,
            looseDelimiterFixes: normalized.fixes
        };
    }

    function defaultSanitize(html) {
        return String(html || '');
    }

    function renderMarkdownWithMath(markdown, dependencies = {}, options = {}) {
        const markedApi = dependencies.marked;
        const katexApi = dependencies.katex;
        const sanitize = dependencies.sanitize || defaultSanitize;
        if (!markedApi || typeof markedApi.parse !== 'function') {
            throw new Error('Marked.js 未加载，无法解析 Markdown。');
        }

        const extracted = extractMathSegments(markdown, options);
        const rawHtml = markedApi.parse(extracted.protectedMarkdown, {
            gfm: true,
            breaks: true
        });
        let html = sanitize(rawHtml);
        const errors = [];

        extracted.segments.forEach((segment) => {
            let replacement = '';
            const encodedSource = encodeURIComponent(segment.content);
            const classes = segment.display ? 'math-node math-display' : 'math-node math-inline';
            if (katexApi && typeof katexApi.renderToString === 'function') {
                try {
                    const rendered = katexApi.renderToString(segment.content, {
                        displayMode: segment.display,
                        throwOnError: true,
                        strict: 'ignore',
                        trust: false,
                        output: 'htmlAndMathml',
                        macros: options.macros || {}
                    });
                    replacement = `<span class="${classes}" data-math-index="${segment.index}" data-math-start="${segment.start}" data-math-end="${segment.end}" data-math-source="${encodedSource}" data-math-display="${segment.display ? '1' : '0'}" role="math">${rendered}</span>`;
                } catch (error) {
                    errors.push({
                        index: segment.index,
                        content: segment.content,
                        display: segment.display,
                        delimiter: segment.delimiter,
                        start: segment.start,
                        end: segment.end,
                        raw: segment.raw,
                        message: error && error.message ? error.message : String(error)
                    });
                }
            } else {
                errors.push({
                    index: segment.index,
                    content: segment.content,
                    display: segment.display,
                    delimiter: segment.delimiter,
                    start: segment.start,
                    end: segment.end,
                    raw: segment.raw,
                    message: 'KaTeX 未加载'
                });
            }

            if (!replacement) {
                const open = segment.display ? '\\[' : '\\(';
                const close = segment.display ? '\\]' : '\\)';
                replacement = `<span class="${classes} math-error" data-math-index="${segment.index}" data-math-start="${segment.start}" data-math-end="${segment.end}" data-math-source="${encodedSource}" data-math-display="${segment.display ? '1' : '0'}" title="公式渲染失败，点击定位源码" role="button" tabindex="0"><code>${escapeHtml(`${open}${segment.content}${close}`)}</code></span>`;
            }

            html = html.split(segment.token).join(replacement);
        });

        return {
            html,
            mathCount: extracted.segments.length,
            errors,
            warnings: extracted.warnings,
            looseDelimiterFixes: extracted.looseDelimiterFixes,
            normalizedMarkdown: extracted.normalizedMarkdown,
            segments: extracted.segments
        };
    }

    function hasMath(source) {
        return extractMathSegments(source).segments.length > 0;
    }

    function decodeMathSource(elementOrEncoded) {
        const encoded = typeof elementOrEncoded === 'string'
            ? elementOrEncoded
            : elementOrEncoded && elementOrEncoded.getAttribute
                ? elementOrEncoded.getAttribute('data-math-source') || ''
                : '';
        try {
            return decodeURIComponent(encoded);
        } catch (_error) {
            return encoded;
        }
    }

    function latexToWordSegments(latex) {
        const source = String(latex || '')
            .replace(/\\displaystyle\b/g, '')
            .replace(/\\(?:left|right)\b/g, '')
            .replace(/\\begin\{(?:aligned|array|matrix|pmatrix|bmatrix|cases)\}/g, '')
            .replace(/\\end\{(?:aligned|array|matrix|pmatrix|bmatrix|cases)\}/g, '')
            .replace(/\\\\/g, ' ; ')
            .replace(/&/g, ' ');

        const output = [];

        function push(text, style = {}) {
            if (!text) return;
            const normalized = String(text).replace(/\s+/g, ' ');
            if (!normalized) return;
            const last = output[output.length - 1];
            const sameStyle = last && Boolean(last.subScript) === Boolean(style.subScript)
                && Boolean(last.superScript) === Boolean(style.superScript)
                && Boolean(last.bold) === Boolean(style.bold)
                && Boolean(last.italics) === Boolean(style.italics);
            if (sameStyle) {
                last.text += normalized;
            } else {
                output.push({ text: normalized, ...style });
            }
        }

        function readGroup(text, start) {
            if (text[start] !== '{') {
                return { value: text[start] || '', end: Math.min(start + 1, text.length) };
            }
            let depth = 1;
            let cursor = start + 1;
            while (cursor < text.length && depth > 0) {
                if (text[cursor] === '{' && !isEscaped(text, cursor)) depth += 1;
                if (text[cursor] === '}' && !isEscaped(text, cursor)) depth -= 1;
                cursor += 1;
            }
            return {
                value: text.slice(start + 1, Math.max(start + 1, cursor - 1)),
                end: cursor
            };
        }

        function parse(text, inheritedStyle = {}) {
            let cursor = 0;
            while (cursor < text.length) {
                const char = text[cursor];

                if (char === '{') {
                    const group = readGroup(text, cursor);
                    parse(group.value, inheritedStyle);
                    cursor = group.end;
                    continue;
                }

                if (char === '}' || char === '\n' || char === '\r') {
                    if (char === '\n' || char === '\r') push(' ', inheritedStyle);
                    cursor += 1;
                    continue;
                }

                if (char === '_' || char === '^') {
                    const scriptStyle = {
                        ...inheritedStyle,
                        subScript: char === '_',
                        superScript: char === '^'
                    };
                    const next = cursor + 1;
                    if (text[next] === '{') {
                        const group = readGroup(text, next);
                        parse(group.value, scriptStyle);
                        cursor = group.end;
                    } else {
                        push(text[next] || '', scriptStyle);
                        cursor = Math.min(next + 1, text.length);
                    }
                    continue;
                }

                if (char === '\\') {
                    const single = text[cursor + 1];
                    if (single && !/[A-Za-z]/.test(single)) {
                        const escapedMap = { '%': '%', '#': '#', '_': '_', '{': '{', '}': '}', '$': '$', '&': '&', ',': '', ';': ' ', '!': '', ' ': ' ' };
                        push(Object.prototype.hasOwnProperty.call(escapedMap, single) ? escapedMap[single] : single, inheritedStyle);
                        cursor += 2;
                        continue;
                    }

                    const commandMatch = text.slice(cursor + 1).match(/^[A-Za-z]+/);
                    if (!commandMatch) {
                        cursor += 1;
                        continue;
                    }
                    const command = commandMatch[0];
                    cursor += command.length + 1;

                    if (command === 'text' || command === 'mathrm' || command === 'operatorname' || command === 'mathbf' || command === 'mathit' || command === 'textrm') {
                        while (/\s/.test(text[cursor] || '')) cursor += 1;
                        if (text[cursor] === '{') {
                            const group = readGroup(text, cursor);
                            const style = {
                                ...inheritedStyle,
                                bold: command === 'mathbf' || inheritedStyle.bold,
                                italics: command === 'mathit' || inheritedStyle.italics
                            };
                            parse(group.value, style);
                            cursor = group.end;
                        }
                        continue;
                    }

                    if (command === 'frac') {
                        while (/\s/.test(text[cursor] || '')) cursor += 1;
                        const numerator = readGroup(text, cursor);
                        cursor = numerator.end;
                        while (/\s/.test(text[cursor] || '')) cursor += 1;
                        const denominator = readGroup(text, cursor);
                        cursor = denominator.end;
                        push('(', inheritedStyle);
                        parse(numerator.value, inheritedStyle);
                        push(')/(', inheritedStyle);
                        parse(denominator.value, inheritedStyle);
                        push(')', inheritedStyle);
                        continue;
                    }

                    if (command === 'sqrt') {
                        while (/\s/.test(text[cursor] || '')) cursor += 1;
                        const radicand = readGroup(text, cursor);
                        cursor = radicand.end;
                        push('√(', inheritedStyle);
                        parse(radicand.value, inheritedStyle);
                        push(')', inheritedStyle);
                        continue;
                    }

                    if (command === 'quad' || command === 'qquad') {
                        push(' ', inheritedStyle);
                        continue;
                    }

                    if (Object.prototype.hasOwnProperty.call(GREEK_SYMBOLS, command)) {
                        push(GREEK_SYMBOLS[command], inheritedStyle);
                        continue;
                    }
                    if (Object.prototype.hasOwnProperty.call(SYMBOLS, command)) {
                        push(SYMBOLS[command], inheritedStyle);
                        continue;
                    }

                    // Unknown commands remain readable instead of silently disappearing.
                    push(command, inheritedStyle);
                    continue;
                }

                // Batch ordinary text until the next control character.
                let end = cursor + 1;
                while (end < text.length && !/[\\{}_^^\r\n]/.test(text[end]) && text[end] !== '_') end += 1;
                push(text.slice(cursor, end), inheritedStyle);
                cursor = end;
            }
        }

        parse(source);
        return output.length ? output : [{ text: String(latex || '') }];
    }

    function latexToPlainText(latex) {
        return latexToWordSegments(latex).map((segment) => segment.text).join('');
    }

    return {
        escapeHtml,
        simpleHash,
        isProbablyLatex,
        normalizeLooseDisplayMath,
        normalizedOffsetToSource,
        extractMathSegments,
        renderMarkdownWithMath,
        hasMath,
        decodeMathSource,
        latexToWordSegments,
        latexToPlainText
    };
});
