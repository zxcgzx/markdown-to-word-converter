(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordPreflight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const COMPLEX_MATH_RE = /\\(?:frac|dfrac|tfrac|overset|underset|stackrel)\b|\\begin\{(?:matrix|pmatrix|bmatrix|vmatrix|Vmatrix|cases|aligned|array)\}/;
    const SUPPORTED_DATA_IMAGE_RE = /^data:image\/(?:png|jpe?g|gif);base64,/i;
    const DATA_IMAGE_RE = /^data:image\/([^;,]+)(?:;[^,]*)?,/i;
    const ASSET_IMAGE_RE = /^(?:\.\/)?md2word-assets\/[^\s?#]+/i;
    const REMOTE_IMAGE_RE = /^https?:\/\//i;

    function classifyImageTarget(target) {
        const value = toText(target).trim();
        if (!value) return Object.freeze({ kind: 'empty', embeddable: false });
        if (ASSET_IMAGE_RE.test(value)) return Object.freeze({ kind: 'asset', embeddable: true });
        if (SUPPORTED_DATA_IMAGE_RE.test(value)) return Object.freeze({ kind: 'data-supported', embeddable: true });
        const data = value.match(DATA_IMAGE_RE);
        if (data) return Object.freeze({ kind: 'data-unsupported', embeddable: false, mime: `image/${data[1].toLowerCase()}` });
        if (REMOTE_IMAGE_RE.test(value)) return Object.freeze({ kind: 'remote', embeddable: 'attempt' });
        if (/^blob:/i.test(value)) return Object.freeze({ kind: 'blob', embeddable: false });
        if (/^(?:file:|[a-z]:[\/]|\\)/i.test(value)) return Object.freeze({ kind: 'local-file', embeddable: false });
        return Object.freeze({ kind: 'relative', embeddable: false });
    }

    function toText(value) {
        return String(value == null ? '' : value);
    }

    function lineColumn(source, offset) {
        const text = toText(source);
        const safe = Math.max(0, Math.min(text.length, Number(offset) || 0));
        const before = text.slice(0, safe);
        const lines = before.split('\n');
        return { line: lines.length, column: lines[lines.length - 1].length + 1 };
    }

    function createLineRecords(source) {
        const text = toText(source);
        const records = [];
        let start = 0;
        const lines = text.split('\n');
        lines.forEach((value, index) => {
            const end = start + value.length;
            records.push({ value, start, end, line: index + 1, inFence: false });
            start = end + 1;
        });
        return records;
    }

    function annotateFences(records) {
        let open = null;
        records.forEach((record) => {
            if (!open) {
                // Opening fences may carry an info string, for example ```js.
                const opening = record.value.match(/^ {0,3}(`{3,}|~{3,})(?:[^`~].*)?$/);
                if (!opening) return;
                open = {
                    char: opening[1][0],
                    length: opening[1].length,
                    marker: opening[1],
                    start: record.start,
                    line: record.line
                };
                record.inFence = true;
                return;
            }

            record.inFence = true;
            // A closing fence cannot carry an info string. Requiring trailing
            // whitespace prevents lines such as ```not-a-close from ending the block.
            const closing = record.value.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
            if (closing && closing[1][0] === open.char && closing[1].length >= open.length) open = null;
        });
        return open;
    }

    function stripInlineCodePreserveLength(line) {
        const chars = toText(line).split('');
        let index = 0;
        while (index < chars.length) {
            if (chars[index] !== '`') {
                index += 1;
                continue;
            }
            let run = 1;
            while (chars[index + run] === '`') run += 1;
            let cursor = index + run;
            let close = -1;
            while (cursor < chars.length) {
                if (chars[cursor] === '`') {
                    let closeRun = 1;
                    while (chars[cursor + closeRun] === '`') closeRun += 1;
                    if (closeRun === run) {
                        close = cursor + closeRun;
                        break;
                    }
                    cursor += closeRun;
                } else {
                    cursor += 1;
                }
            }
            if (close === -1) break;
            for (let i = index; i < close; i += 1) chars[i] = ' ';
            index = close;
        }
        return chars.join('');
    }

    function normalizeIssue(issue, source) {
        const numericStart = issue.start == null ? NaN : Number(issue.start);
        const start = Number.isFinite(numericStart) ? Math.max(0, numericStart) : null;
        const numericEnd = issue.end == null ? NaN : Number(issue.end);
        const end = Number.isFinite(numericEnd) ? Math.max(start == null ? 0 : start, numericEnd) : start;
        const location = start == null ? null : lineColumn(source, start);
        return {
            id: issue.id || `${issue.type || 'issue'}:${start == null ? 'global' : start}:${issue.title || ''}`,
            severity: issue.severity === 'error' ? 'error' : 'warning',
            type: issue.type || 'document',
            title: issue.title || '需要检查',
            message: issue.message || '',
            start,
            end,
            line: location ? location.line : null,
            column: location ? location.column : null,
            locatable: start != null,
            formulaIndex: Number.isInteger(issue.formulaIndex) ? issue.formulaIndex : null
        };
    }

    function addIssue(list, seen, issue, source) {
        const normalized = normalizeIssue(issue, source);
        const key = `${normalized.type}|${normalized.severity}|${normalized.start}|${normalized.end}|${normalized.title}`;
        if (seen.has(key)) return;
        seen.add(key);
        list.push(normalized);
    }

    function parseLinkTarget(raw) {
        const value = toText(raw).trim();
        if (!value) return '';
        if (value[0] === '<' && value.includes('>')) return value.slice(1, value.indexOf('>')).trim();
        const titled = value.match(/^(\S+?)(?:\s+["'][\s\S]*["'])?$/);
        return titled ? titled[1] : value.split(/\s+/)[0];
    }

    function addImageTargetIssue(issues, seen, target, start, end, source) {
        const info = classifyImageTarget(target);
        if (info.kind === 'asset' || info.kind === 'data-supported') return;
        if (info.kind === 'empty') {
            addIssue(issues, seen, {
                type: 'image-empty', severity: 'error', title: '图片地址为空',
                message: '该图片无法显示，也无法写入 Word。请补充地址或删除图片标记。', start, end
            }, source);
            return;
        }
        if (info.kind === 'remote') {
            addIssue(issues, seen, {
                type: 'image-remote', severity: 'warning', title: '网络图片将在导出时尝试嵌入',
                message: '导出 Word 时会尝试下载并转为内嵌图片；若图片服务器禁止跨域访问，将退化为“图片说明 + 地址”。要获得最稳定结果，请先导入图片素材库。', start, end
            }, source);
            return;
        }
        if (info.kind === 'data-unsupported') {
            addIssue(issues, seen, {
                type: 'image-format', severity: 'warning', title: '图片格式需要转换',
                message: `${info.mime || '该图片格式'} 不能直接写入当前 DOCX。请拖入图片素材库，系统会转换为 PNG 或 JPEG。`, start, end
            }, source);
            return;
        }
        if (info.kind === 'blob') {
            addIssue(issues, seen, {
                type: 'image-blob', severity: 'error', title: '临时图片地址无法持久保存',
                message: 'blob: 地址仅在当前页面临时有效。请重新粘贴或拖入图片，让它进入本地素材库。', start, end
            }, source);
            return;
        }
        if (info.kind === 'local-file') {
            addIssue(issues, seen, {
                type: 'image-local-file', severity: 'error', title: '浏览器无法读取本机图片路径',
                message: 'file:、盘符或网络共享路径不能可靠写入 Word。请把图片拖入编辑器或从素材库添加。', start, end
            }, source);
            return;
        }
        addIssue(issues, seen, {
            type: 'image-relative', severity: 'warning', title: '相对路径图片可能在导出时丢失',
            message: '浏览器页面通常无法读取仓库或电脑中的相对路径图片。请把图片拖入编辑器，转换为当前文档的本地素材。', start, end
        }, source);
    }

    function analyze(markdown, renderResult) {
        const source = toText(markdown);
        const result = renderResult || {};
        const issues = [];
        const seen = new Set();
        const segments = Array.isArray(result.segments) ? result.segments : [];

        for (const error of Array.isArray(result.errors) ? result.errors : []) {
            const formulaIndex = Number.isInteger(error.index) ? error.index : Number(error.segmentIndex);
            const segment = Number.isInteger(formulaIndex) ? segments[formulaIndex] : null;
            addIssue(issues, seen, {
                type: 'math-render',
                severity: 'error',
                title: `公式 ${Number.isInteger(formulaIndex) ? formulaIndex + 1 : ''} 无法渲染`.trim(),
                message: error.message || 'KaTeX 无法解析该公式。Word 仍会尝试按线性文本导出。',
                start: error.start != null ? error.start : segment && segment.start,
                end: error.end != null ? error.end : segment && segment.end,
                formulaIndex: Number.isInteger(formulaIndex) ? formulaIndex : null
            }, source);
        }

        for (const warning of Array.isArray(result.warnings) ? result.warnings : []) {
            const start = warning.start != null ? warning.start : warning.index;
            addIssue(issues, seen, {
                type: 'math-delimiter',
                severity: 'error',
                title: '公式边界未闭合',
                message: `检测到未闭合的 ${warning.delimiter || '公式'} 边界，请补齐结束标记。`,
                start,
                end: warning.end != null ? warning.end : (start == null ? null : start + String(warning.delimiter || '').length)
            }, source);
        }

        for (const segment of segments) {
            if (!segment || !COMPLEX_MATH_RE.test(toText(segment.content))) continue;
            addIssue(issues, seen, {
                type: 'math-linearization',
                severity: 'warning',
                title: `公式 ${Number(segment.index) + 1} 将以线性文本写入 Word`,
                message: '该公式包含分式、矩阵或多行环境。预览仍使用 KaTeX，Word 中会保留为可编辑的线性文本，而不是原生 OMML 公式。',
                start: segment.start,
                end: segment.end,
                formulaIndex: Number(segment.index)
            }, source);
        }

        const records = createLineRecords(source);
        const unclosedFence = annotateFences(records);
        if (unclosedFence) {
            addIssue(issues, seen, {
                type: 'code-fence',
                severity: 'error',
                title: '代码围栏未闭合',
                message: `第 ${unclosedFence.line} 行开始的 ${unclosedFence.marker} 代码块缺少结束围栏。`,
                start: unclosedFence.start,
                end: unclosedFence.start + unclosedFence.marker.length
            }, source);
        }

        let previousHeadingLevel = null;
        for (let i = 0; i < records.length; i += 1) {
            const record = records[i];
            if (record.inFence) continue;
            const visible = stripInlineCodePreserveLength(record.value);

            const heading = visible.match(/^ {0,3}(#{1,6})\s+(.+?)\s*#*\s*$/);
            if (heading) {
                const level = heading[1].length;
                if (previousHeadingLevel != null && level > previousHeadingLevel + 1) {
                    addIssue(issues, seen, {
                        type: 'heading-level',
                        severity: 'warning',
                        title: '标题层级发生跳跃',
                        message: `标题从 H${previousHeadingLevel} 直接跳到 H${level}，建议补齐中间层级以改善 Word 大纲。`,
                        start: record.start + visible.indexOf('#'),
                        end: record.end
                    }, source);
                }
                previousHeadingLevel = level;
            }

            const tableSeparator = visible.match(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/);
            if (tableSeparator) {
                const columns = visible.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|').length;
                if (columns > 8) {
                    const headerRecord = records[Math.max(0, i - 1)];
                    addIssue(issues, seen, {
                        type: 'wide-table',
                        severity: 'warning',
                        title: `表格包含 ${columns} 列`,
                        message: '列数较多，Word 页面中可能显得拥挤。建议缩短内容、拆表或调小字号。',
                        start: headerRecord.start,
                        end: record.end
                    }, source);
                }
            }

            const imageRe = /!\[([^\]]*)\]\(([^)]*)\)/g;
            let imageMatch;
            while ((imageMatch = imageRe.exec(visible))) {
                const target = parseLinkTarget(imageMatch[2]);
                const start = record.start + imageMatch.index;
                const end = start + imageMatch[0].length;
                addImageTargetIssue(issues, seen, target, start, end, source);
            }

            const htmlImageRe = /<img\b[^>]*?\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))[^>]*>/gi;
            let htmlImageMatch;
            while ((htmlImageMatch = htmlImageRe.exec(visible))) {
                const target = htmlImageMatch[1] ?? htmlImageMatch[2] ?? htmlImageMatch[3] ?? '';
                const start = record.start + htmlImageMatch.index;
                const end = start + htmlImageMatch[0].length;
                addImageTargetIssue(issues, seen, target, start, end, source);
            }

            const linkRe = /(^|[^!])\[([^\]]+)\]\(([^)]*)\)/g;
            let linkMatch;
            while ((linkMatch = linkRe.exec(visible))) {
                const target = parseLinkTarget(linkMatch[3]);
                if (target) continue;
                const bracketOffset = linkMatch.index + linkMatch[1].length;
                const start = record.start + bracketOffset;
                addIssue(issues, seen, {
                    type: 'link-empty', severity: 'warning', title: '链接地址为空',
                    message: '该链接在 Word 中只能保留文字，建议补充地址或移除链接语法。',
                    start, end: start + linkMatch[0].length - linkMatch[1].length
                }, source);
            }
        }

        issues.sort((a, b) => {
            if (a.severity !== b.severity) return a.severity === 'error' ? -1 : 1;
            if (a.start == null && b.start != null) return 1;
            if (a.start != null && b.start == null) return -1;
            return (a.start || 0) - (b.start || 0);
        });

        const errors = issues.filter((issue) => issue.severity === 'error');
        const warnings = issues.filter((issue) => issue.severity === 'warning');
        return Object.freeze({
            issues: Object.freeze(issues),
            errors: Object.freeze(errors),
            warnings: Object.freeze(warnings),
            errorCount: errors.length,
            warningCount: warnings.length,
            total: issues.length,
            readiness: errors.length ? 'error' : warnings.length ? 'warning' : source.trim() ? 'ready' : 'empty',
            checkedAt: Date.now()
        });
    }

    return Object.freeze({ analyze, lineColumn, createLineRecords, stripInlineCodePreserveLength, classifyImageTarget });
});
