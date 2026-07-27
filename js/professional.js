(function (root, factory) {
    'use strict';
    const api = factory(root || globalThis);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordProfessional = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const VERSION = '5.5';
    const HEADING_NUMBERING_REFERENCE = 'md2word-professional-headings';
    const SECTION_BREAK_HTML = '<div class="md2word-section-break" data-section-break="true" data-orientation="landscape" role="separator" aria-label="下一节切换为横向页面"></div>';

    const DEFAULTS = Object.freeze({
        professionalStyle: 'business',
        coverEnabled: false,
        coverStyle: 'minimal',
        documentSubtitle: '',
        documentAuthor: '',
        documentOrganization: '',
        documentDate: '',
        documentVersion: 'V1.0',
        documentNumber: '',
        documentClassification: '',
        tocEnabled: false,
        tocTitle: '目录',
        tocDepth: 3,
        headingNumbering: 'none',
        headerEnabled: false,
        headerText: '{title}',
        footerText: '',
        firstPageDifferent: true,
        pageNumberEnabled: true,
        pageNumberFormat: 'current',
        pageNumberAlignment: 'center',
        wordHeadingFont: '',
        wordFirstLineChars: 0,
        wordParagraphAfterPt: 6,
        wordTableStyle: 'clean',
        repeatTableHeader: true,
        keepTableRows: true,
        captionMode: 'manual',
        captionFigures: true,
        captionTables: true
    });

    const STYLE_PRESETS = Object.freeze({
        business: Object.freeze({
            id: 'business', name: '简洁商务', description: '清晰蓝灰层级，适合项目报告与正式汇报。',
            patch: Object.freeze({ wordFont: '微软雅黑', wordHeadingFont: '微软雅黑', wordFontSize: 10.5, wordLineSpacing: 1.5, wordFirstLineChars: 0, wordParagraphAfterPt: 6, wordTableStyle: 'clean', headingNumbering: 'none' }),
            colors: Object.freeze({ heading: '17365D', accent: '2F75B5', muted: '667085', tableHeader: 'DCE6F1', tableBorder: 'AAB7C4' })
        }),
        formal: Object.freeze({
            id: 'formal', name: '正式报告', description: '宋体正文、黑体标题与克制黑灰配色。',
            patch: Object.freeze({ wordFont: '宋体', wordHeadingFont: '黑体', wordFontSize: 11, wordLineSpacing: 1.5, wordFirstLineChars: 2, wordParagraphAfterPt: 6, wordTableStyle: 'formal', headingNumbering: 'decimal' }),
            colors: Object.freeze({ heading: '111111', accent: '333333', muted: '666666', tableHeader: 'E7E6E6', tableBorder: '7F7F7F' })
        }),
        academic: Object.freeze({
            id: 'academic', name: '学术论文', description: '强调标题层级、首行缩进与黑白打印兼容。',
            patch: Object.freeze({ wordFont: '宋体', wordHeadingFont: '黑体', wordFontSize: 10.5, wordLineSpacing: 1.5, wordFirstLineChars: 2, wordParagraphAfterPt: 0, wordTableStyle: 'academic', headingNumbering: 'decimal', tocEnabled: true }),
            colors: Object.freeze({ heading: '000000', accent: '000000', muted: '555555', tableHeader: 'F2F2F2', tableBorder: '000000' })
        }),
        laboratory: Object.freeze({
            id: 'laboratory', name: '实验记录', description: '适合实验报告、研发记录与数据表格。',
            patch: Object.freeze({ wordFont: '宋体', wordHeadingFont: '微软雅黑', wordFontSize: 11, wordLineSpacing: 1.5, wordFirstLineChars: 0, wordParagraphAfterPt: 6, wordTableStyle: 'grid', headingNumbering: 'decimal' }),
            colors: Object.freeze({ heading: '0B4F4A', accent: '0F766E', muted: '5F6B6A', tableHeader: 'DDF4F1', tableBorder: '78AAA5' })
        }),
        monochrome: Object.freeze({
            id: 'monochrome', name: '黑白打印', description: '完全去彩色化，适合归档、复印和批量打印。',
            patch: Object.freeze({ wordFont: '宋体', wordHeadingFont: '黑体', wordFontSize: 10.5, wordLineSpacing: 1.5, wordFirstLineChars: 2, wordParagraphAfterPt: 6, wordTableStyle: 'monochrome' }),
            colors: Object.freeze({ heading: '000000', accent: '000000', muted: '555555', tableHeader: 'EDEDED', tableBorder: '333333' })
        }),
        sop: Object.freeze({
            id: 'sop', name: '内部 SOP', description: '强调编号、版本、页眉页脚与流程表格。',
            patch: Object.freeze({ wordFont: '微软雅黑', wordHeadingFont: '微软雅黑', wordFontSize: 10.5, wordLineSpacing: 1.5, wordFirstLineChars: 0, wordParagraphAfterPt: 6, wordTableStyle: 'grid', headingNumbering: 'decimal', tocEnabled: true, headerEnabled: true, headerText: '{number} · {title}', footerText: '{version}' }),
            colors: Object.freeze({ heading: '1F2937', accent: '1D4ED8', muted: '64748B', tableHeader: 'E8EFFC', tableBorder: '94A3B8' })
        })
    });

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));

    function todayString() {
        const date = new Date();
        const pad = (value) => String(value).padStart(2, '0');
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
    }

    function normalizeSettings(input = {}) {
        const presetId = STYLE_PRESETS[input.professionalStyle] ? input.professionalStyle : DEFAULTS.professionalStyle;
        return Object.freeze({
            ...DEFAULTS,
            ...input,
            professionalStyle: presetId,
            coverEnabled: input.coverEnabled === true,
            coverStyle: ['minimal', 'report', 'academic'].includes(input.coverStyle) ? input.coverStyle : DEFAULTS.coverStyle,
            documentSubtitle: String(input.documentSubtitle || '').trim().slice(0, 160),
            documentAuthor: String(input.documentAuthor || '').trim().slice(0, 120),
            documentOrganization: String(input.documentOrganization || '').trim().slice(0, 160),
            documentDate: String(input.documentDate || '').trim().slice(0, 40),
            documentVersion: String(input.documentVersion || DEFAULTS.documentVersion).trim().slice(0, 40),
            documentNumber: String(input.documentNumber || '').trim().slice(0, 80),
            documentClassification: String(input.documentClassification || '').trim().slice(0, 60),
            tocEnabled: input.tocEnabled === true,
            tocTitle: String(input.tocTitle || DEFAULTS.tocTitle).trim().slice(0, 40) || DEFAULTS.tocTitle,
            tocDepth: clamp(Math.round(Number(input.tocDepth || DEFAULTS.tocDepth)), 1, 6),
            headingNumbering: ['none', 'decimal', 'chapter'].includes(input.headingNumbering) ? input.headingNumbering : DEFAULTS.headingNumbering,
            headerEnabled: input.headerEnabled === true,
            headerText: String(input.headerText == null ? DEFAULTS.headerText : input.headerText).slice(0, 180),
            footerText: String(input.footerText || '').slice(0, 180),
            firstPageDifferent: input.firstPageDifferent !== false,
            pageNumberEnabled: input.pageNumberEnabled !== false,
            pageNumberFormat: ['current', 'current-total', 'page-current', 'page-current-total'].includes(input.pageNumberFormat) ? input.pageNumberFormat : DEFAULTS.pageNumberFormat,
            pageNumberAlignment: ['left', 'center', 'right'].includes(input.pageNumberAlignment) ? input.pageNumberAlignment : DEFAULTS.pageNumberAlignment,
            wordHeadingFont: String(input.wordHeadingFont || '').trim().slice(0, 80),
            wordFirstLineChars: clamp(Number(input.wordFirstLineChars ?? DEFAULTS.wordFirstLineChars), 0, 4),
            wordParagraphAfterPt: clamp(Number(input.wordParagraphAfterPt ?? DEFAULTS.wordParagraphAfterPt), 0, 24),
            wordTableStyle: ['clean', 'formal', 'grid', 'academic', 'monochrome', 'minimal'].includes(input.wordTableStyle) ? input.wordTableStyle : DEFAULTS.wordTableStyle,
            repeatTableHeader: input.repeatTableHeader !== false,
            keepTableRows: input.keepTableRows !== false,
            captionMode: ['manual', 'alt', 'off'].includes(input.captionMode) ? input.captionMode : DEFAULTS.captionMode,
            captionFigures: input.captionFigures !== false,
            captionTables: input.captionTables !== false
        });
    }

    function getPreset(id) {
        return STYLE_PRESETS[id] || STYLE_PRESETS.business;
    }

    function getPresetPatch(id) {
        const preset = getPreset(id);
        return { professionalStyle: preset.id, ...preset.patch };
    }

    function getPresetColors(input = {}) {
        return getPreset(normalizeSettings(input).professionalStyle).colors;
    }

    function metadata(input = {}, fallbackTitle = '未命名文档') {
        const settings = normalizeSettings(input);
        return Object.freeze({
            title: String(input.documentTitle || fallbackTitle || '未命名文档').trim() || '未命名文档',
            subtitle: settings.documentSubtitle,
            author: settings.documentAuthor,
            organization: settings.documentOrganization,
            date: settings.documentDate || todayString(),
            version: settings.documentVersion,
            number: settings.documentNumber,
            classification: settings.documentClassification
        });
    }

    function substitutePlaceholders(template, values = {}) {
        const map = { title: '', subtitle: '', author: '', organization: '', date: '', version: '', number: '', classification: '', ...values };
        return String(template || '').replace(/\{(title|subtitle|author|organization|date|version|number|classification)\}/g, (_all, key) => String(map[key] || '')).replace(/\s+([·|—-])\s*$/g, '').trim();
    }

    function headingNumberText(counters, level, mode) {
        if (mode === 'none') return '';
        const path = counters.slice(0, level).filter((value) => value > 0);
        if (!path.length) return '';
        if (mode === 'chapter' && level === 1) return `第 ${path[0]} 章`;
        return path.join('.');
    }

    function computeHeadingNumbers(headings = [], mode = 'none') {
        const counters = [0, 0, 0, 0, 0, 0];
        return headings.map((heading, index) => {
            const level = clamp(Math.round(Number(heading.level || 1)), 1, 6);
            counters[level - 1] += 1;
            for (let i = level; i < counters.length; i += 1) counters[i] = 0;
            for (let i = 0; i < level - 1; i += 1) if (!counters[i]) counters[i] = 1;
            const number = headingNumberText(counters, level, mode);
            return Object.freeze({ ...heading, index, level, number });
        });
    }

    function bookmarkId(index, text = '') {
        const ascii = String(text).normalize ? String(text).normalize('NFKD').replace(/[^\w]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24) : '';
        return `md2w_h_${index + 1}${ascii ? `_${ascii}` : ''}`;
    }

    function extractHeadings(preview, input = {}) {
        if (!preview || typeof preview.querySelectorAll !== 'function') return [];
        const settings = normalizeSettings(input);
        const raw = Array.from(preview.querySelectorAll('h1,h2,h3,h4,h5,h6')).map((element, index) => ({
            element,
            level: Number(element.tagName.slice(1)),
            text: String(element.textContent || '').replace(/^\s*(?:第\s*\d+\s*章|\d+(?:\.\d+)*)\s+/, '').trim(),
            sourceId: element.id || `heading-${index + 1}`
        }));
        return computeHeadingNumbers(raw, settings.headingNumbering).map((heading, index) => Object.freeze({ ...heading, bookmarkId: bookmarkId(index, heading.text) }));
    }

    function stripExistingDecorations(preview) {
        if (!preview || typeof preview.querySelectorAll !== 'function') return;
        Array.from(preview.querySelectorAll('.md2word-heading-number')).forEach((element) => element.remove());
        Array.from(preview.querySelectorAll('.md2word-caption[data-generated-caption="true"]')).forEach((element) => element.remove());
    }

    function captionLabel(kind) {
        return kind === 'table' ? '表' : '图';
    }

    function decoratePreview(preview, input = {}) {
        if (!preview || typeof preview.querySelectorAll !== 'function') return { headings: [], figures: 0, tables: 0 };
        const settings = normalizeSettings(input);
        stripExistingDecorations(preview);
        const headings = extractHeadings(preview, settings);
        headings.forEach((heading) => {
            heading.element.dataset.professionalHeading = 'true';
            heading.element.dataset.headingLevel = String(heading.level);
            heading.element.dataset.headingNumber = heading.number;
            heading.element.dataset.bookmarkId = heading.bookmarkId;
            if (heading.number) {
                const span = preview.ownerDocument.createElement('span');
                span.className = 'md2word-heading-number';
                span.setAttribute('aria-hidden', 'true');
                span.textContent = `${heading.number} `;
                heading.element.prepend(span);
            }
        });

        const counters = { figure: 0, table: 0 };
        Array.from(preview.querySelectorAll('.md2word-caption[data-caption-kind]')).forEach((element) => {
            const kind = element.dataset.captionKind === 'table' ? 'table' : 'figure';
            counters[kind] += 1;
            const title = String(element.dataset.captionTitle || element.textContent || '').replace(/^\s*(?:图|表)\s*\d+\s*/, '').trim();
            element.dataset.captionIndex = String(counters[kind]);
            element.dataset.captionTitle = title;
            element.textContent = `${captionLabel(kind)} ${counters[kind]}${title ? `  ${title}` : ''}`;
        });

        if (settings.captionMode === 'alt' && settings.captionFigures) {
            Array.from(preview.querySelectorAll('img')).forEach((image) => {
                const parent = image.parentElement;
                const next = parent && parent.nextElementSibling;
                if (next && next.classList.contains('md2word-caption')) return;
                const title = String(image.getAttribute('alt') || '').trim();
                if (!title) return;
                counters.figure += 1;
                const caption = preview.ownerDocument.createElement('p');
                caption.className = 'md2word-caption md2word-caption-figure';
                caption.dataset.captionKind = 'figure';
                caption.dataset.captionIndex = String(counters.figure);
                caption.dataset.captionTitle = title;
                caption.dataset.generatedCaption = 'true';
                caption.textContent = `图 ${counters.figure}  ${title}`;
                (parent || image).insertAdjacentElement('afterend', caption);
            });
        }
        return { headings, figures: counters.figure, tables: counters.table };
    }

    function createCaptionMarker(kind = 'figure', title = '') {
        const normalizedKind = kind === 'table' ? 'table' : 'figure';
        return `<div class="md2word-caption" data-caption-kind="${normalizedKind}" data-caption-title="${escapeHtml(String(title || '').trim())}"></div>`;
    }

    function createSectionBreakMarker(orientation = 'landscape') {
        const next = orientation === 'portrait' ? 'portrait' : 'landscape';
        return `<div class="md2word-section-break" data-section-break="true" data-orientation="${next}" role="separator" aria-label="下一节切换为${next === 'landscape' ? '横向' : '纵向'}页面"></div>`;
    }

    function splitElementsIntoSections(elements = [], defaultOrientation = 'portrait') {
        const sections = [];
        let current = { orientation: defaultOrientation === 'landscape' ? 'landscape' : 'portrait', elements: [] };
        const flush = () => {
            // A section marker at the beginning (or two consecutive markers) changes the
            // upcoming orientation; it must not synthesize an empty Word page/section.
            if (current.elements.length) sections.push(current);
        };
        Array.from(elements || []).forEach((element) => {
            const isBreak = element && element.matches && element.matches('.md2word-section-break, [data-section-break="true"]');
            if (!isBreak) {
                current.elements.push(element);
                return;
            }
            flush();
            current = {
                orientation: element.dataset && element.dataset.orientation === 'portrait' ? 'portrait' : 'landscape',
                elements: []
            };
        });
        flush();
        return sections;
    }

    function buildCoverPreview(documentRef, values, input = {}) {
        const settings = normalizeSettings(input);
        if (!settings.coverEnabled || !documentRef) return null;
        const cover = documentRef.createElement('section');
        cover.className = `md2word-cover-preview md2word-cover-${settings.coverStyle} md2word-full-page-block`;
        cover.dataset.professionalCover = 'true';
        const metaRows = [
            ['作者', values.author], ['单位', values.organization], ['日期', values.date],
            ['版本', values.version], ['文档编号', values.number], ['密级', values.classification]
        ].filter((row) => row[1]);
        cover.innerHTML = `<div class="md2word-cover-brand">MARKDOWN → DOCX</div>
            <div class="md2word-cover-main"><h1>${escapeHtml(values.title)}</h1>${values.subtitle ? `<p>${escapeHtml(values.subtitle)}</p>` : ''}</div>
            <div class="md2word-cover-rule"></div>
            <dl>${metaRows.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`).join('')}</dl>`;
        return cover;
    }

    function buildTocPreview(documentRef, headings, input = {}) {
        const settings = normalizeSettings(input);
        if (!settings.tocEnabled || !documentRef) return null;
        const toc = documentRef.createElement('section');
        toc.className = 'md2word-toc-preview md2word-full-page-block';
        toc.dataset.professionalToc = 'true';
        const visible = headings.filter((heading) => heading.level <= settings.tocDepth);
        toc.innerHTML = `<h1>${escapeHtml(settings.tocTitle)}</h1><p class="md2word-toc-note">页码将在 Word 中更新目录后显示。</p><ol>${visible.map((heading) => `<li data-level="${heading.level}"><span>${escapeHtml(`${heading.number ? `${heading.number} ` : ''}${heading.text}`)}</span><i aria-hidden="true"></i></li>`).join('')}</ol>`;
        return toc;
    }

    function preparePreviewBlocks(preview, input = {}, fallbackTitle = '未命名文档') {
        if (!preview || !preview.ownerDocument) return [];
        const settings = normalizeSettings(input);
        const meta = metadata(input, fallbackTitle);
        const clone = preview.cloneNode(true);
        decoratePreview(clone, settings);
        const headings = extractHeadings(clone, settings);
        const blocks = [];
        const cover = buildCoverPreview(preview.ownerDocument, meta, settings);
        const toc = buildTocPreview(preview.ownerDocument, headings, settings);
        if (cover) blocks.push(cover);
        if (toc) blocks.push(toc);
        blocks.push(...Array.from(clone.children));
        return blocks;
    }

    function getHeadingNumberingLevels(input = {}, docx = {}) {
        const settings = normalizeSettings(input);
        if (settings.headingNumbering === 'none') return [];
        const format = docx.LevelFormat ? docx.LevelFormat.DECIMAL : 'decimal';
        const alignment = docx.AlignmentType ? docx.AlignmentType.START : 'start';
        return Array.from({ length: 6 }, (_unused, level) => {
            const placeholders = Array.from({ length: level + 1 }, (_x, index) => `%${index + 1}`).join('.');
            const text = settings.headingNumbering === 'chapter' && level === 0 ? '第 %1 章' : placeholders;
            return {
                level,
                format,
                text,
                alignment,
                style: { paragraph: { indent: { left: Math.max(0, level * 360), hanging: 260 } } }
            };
        });
    }

    function alignmentValue(value, docx = {}) {
        const map = docx.AlignmentType || {};
        if (value === 'left') return map.LEFT || map.START || 'left';
        if (value === 'right') return map.RIGHT || map.END || 'right';
        return map.CENTER || 'center';
    }

    function pageNumberTokens(input = {}, docx = {}) {
        const settings = normalizeSettings(input);
        if (!settings.pageNumberEnabled) return [];
        const current = docx.PageNumber ? docx.PageNumber.CURRENT : '1';
        const total = docx.PageNumber ? docx.PageNumber.TOTAL_PAGES : '?';
        if (settings.pageNumberFormat === 'current-total') return [current, ' / ', total];
        if (settings.pageNumberFormat === 'page-current') return ['第 ', current, ' 页'];
        if (settings.pageNumberFormat === 'page-current-total') return ['第 ', current, ' 页 / 共 ', total, ' 页'];
        return [current];
    }

    function analyze(markdown = '', preview = null, input = {}) {
        const settings = normalizeSettings(input);
        const issues = [];
        const add = (severity, id, title, message) => issues.push({ id, severity, type: 'professional', title, message, start: null, end: null, line: null, column: null, locatable: false });
        const headings = preview ? extractHeadings(preview, settings) : [];
        if (settings.coverEnabled) {
            if (!String(input.documentAuthor || '').trim()) add('warning', 'cover-author-empty', '封面缺少作者', '已启用封面，但作者字段为空。');
            if (!String(input.documentOrganization || '').trim()) add('warning', 'cover-organization-empty', '封面缺少单位', '已启用封面，但单位字段为空。');
        }
        if (settings.tocEnabled && !headings.some((heading) => heading.level <= settings.tocDepth)) add('warning', 'toc-no-headings', '目录没有可用标题', `已启用目录，但文档中没有 H1–H${settings.tocDepth} 标题。`);
        if (settings.headingNumbering !== 'none' && !headings.length) add('warning', 'numbering-no-headings', '标题编号没有作用对象', '已启用标题编号，但文档中没有 Markdown 标题。');
        const sectionMarkers = String(markdown || '').match(/data-section-break=["']true["']/g) || [];
        if (sectionMarkers.length > 12) add('warning', 'many-sections', '分节数量较多', `文档包含 ${sectionMarkers.length} 个分节标记，建议确认每一节的纸张方向。`);
        if (settings.headerEnabled && !substitutePlaceholders(settings.headerText, metadata(input, input.documentTitle || '未命名文档'))) add('warning', 'header-empty', '页眉内容为空', '已启用页眉，但替换变量后没有可显示的文字。');
        return issues;
    }

    const dom = {};
    function $(id) { return root.document ? root.document.getElementById(id) : null; }

    function insertAtSelection(markup) {
        const input = $('markdownInput');
        if (!input) return false;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || start;
        const before = start > 0 && input.value[start - 1] !== '\n' ? '\n\n' : '';
        const after = end < input.value.length && input.value[end] !== '\n' ? '\n\n' : '';
        input.setRangeText(`${before}${markup}${after}`, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
        return true;
    }

    function renderPanelSummary() {
        const settings = normalizeSettings(root.Md2WordCore?.getSettings?.() || {});
        if (dom.summary) {
            const active = [settings.coverEnabled ? '封面' : '', settings.tocEnabled ? '目录' : '', settings.headingNumbering !== 'none' ? '标题编号' : '', settings.pageNumberEnabled ? '页码' : ''].filter(Boolean);
            dom.summary.textContent = active.length ? `${getPreset(settings.professionalStyle).name} · ${active.join(' · ')}` : `${getPreset(settings.professionalStyle).name} · 基础交付`;
        }
        if (dom.quickPreset) dom.quickPreset.value = settings.professionalStyle;
        if (dom.quickCover) dom.quickCover.checked = settings.coverEnabled;
        if (dom.quickToc) dom.quickToc.checked = settings.tocEnabled;
        if (dom.quickNumbering) dom.quickNumbering.value = settings.headingNumbering;
    }

    function openPanel() {
        const drawer = $('toolDrawer');
        if (!drawer) return;
        drawer.hidden = false;
        $('toolDrawerTitle').textContent = '专业交付';
        ['tableToolPanel', 'aiToolPanel', 'exportCheckToolPanel', 'assetToolPanel', 'templateToolPanel'].forEach((id) => { const panel = $(id); if (panel) panel.hidden = true; });
        if (dom.panel) dom.panel.hidden = false;
        renderPanelSummary();
        requestAnimationFrame(() => drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    function applyQuickSettings() {
        const patch = {
            ...getPresetPatch(dom.quickPreset?.value || 'business'),
            coverEnabled: Boolean(dom.quickCover?.checked),
            tocEnabled: Boolean(dom.quickToc?.checked),
            headingNumbering: dom.quickNumbering?.value || 'none'
        };
        root.Md2WordCore?.applySettingsPatch?.(patch, { persist: true, render: true });
        renderPanelSummary();
    }

    function handleAction(button, event) {
        const action = button.dataset.action;
        if (!['open-professional', 'apply-professional-quick', 'insert-section-landscape', 'insert-section-portrait', 'insert-caption', 'open-professional-settings'].includes(action)) return false;
        event.preventDefault();
        if (action === 'open-professional') openPanel();
        else if (action === 'apply-professional-quick') applyQuickSettings();
        else if (action === 'insert-section-landscape') insertAtSelection(createSectionBreakMarker('landscape'));
        else if (action === 'insert-section-portrait') insertAtSelection(createSectionBreakMarker('portrait'));
        else if (action === 'insert-caption') insertAtSelection(createCaptionMarker(dom.captionKind?.value || 'figure', dom.captionTitle?.value || ''));
        else if (action === 'open-professional-settings') {
            $('settingsButton')?.click();
            setTimeout(() => {
                if (root.Md2WordCore?.activateSettingsTab) root.Md2WordCore.activateSettingsTab('professional', { focus: true });
                else {
                    const tab = root.document?.querySelector('[data-settings-tab="professional"]');
                    tab?.click();
                    tab?.focus();
                }
            }, 30);
        }
        return true;
    }

    function cacheDom() {
        Object.assign(dom, {
            panel: $('professionalToolPanel'), summary: $('professionalSummary'), quickPreset: $('professionalQuickPreset'),
            quickCover: $('professionalQuickCover'), quickToc: $('professionalQuickToc'), quickNumbering: $('professionalQuickNumbering'),
            captionKind: $('captionKind'), captionTitle: $('captionTitle')
        });
    }

    function initialize() {
        if (!root.document) return;
        cacheDom();
        root.document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;
            handleAction(button, event);
        }, true);
        root.document.addEventListener('md2word:settings-updated', renderPanelSummary);
        renderPanelSummary();
    }

    if (root.addEventListener) root.addEventListener('DOMContentLoaded', initialize, { once: true });

    return Object.freeze({
        version: VERSION, VERSION, DEFAULTS, STYLE_PRESETS, HEADING_NUMBERING_REFERENCE, SECTION_BREAK_HTML,
        normalizeSettings, getPreset, getPresetPatch, getPresetColors, metadata, substitutePlaceholders,
        computeHeadingNumbers, bookmarkId, extractHeadings, decoratePreview, preparePreviewBlocks,
        createCaptionMarker, createSectionBreakMarker, splitElementsIntoSections, getHeadingNumberingLevels,
        alignmentValue, pageNumberTokens, analyze, insertAtSelection, openPanel, renderPanelSummary
    });
}));
