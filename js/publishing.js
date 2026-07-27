(function (root, factory) {
    'use strict';
    const api = factory(root || globalThis);
    if (typeof module === 'object' && module.exports) module.exports = api;
    if (root) root.Md2WordPublishing = api;
}(typeof window !== 'undefined' ? window : globalThis, function (root) {
    'use strict';

    const PREVIEW_MODE_KEY = 'md2word.preview.mode.v5.4';
    const PAGE_BREAK_HTML = '<div class="md2word-page-break" data-page-break="true" role="separator" aria-label="分页符"></div>';
    const PX_PER_MM = 96 / 25.4;
    const PAPER_SIZES = Object.freeze({
        a4: Object.freeze({ id: 'a4', label: 'A4', widthMm: 210, heightMm: 297, widthTwip: 11906, heightTwip: 16838 }),
        letter: Object.freeze({ id: 'letter', label: 'Letter', widthMm: 215.9, heightMm: 279.4, widthTwip: 12240, heightTwip: 15840 })
    });
    const TEMPLATES = Object.freeze([
        Object.freeze({
            id: 'report', name: '通用报告', category: '工作文档', icon: 'R', description: '适合阶段总结、项目说明和评审材料。',
            suggestedName: '项目报告', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordFont: '微软雅黑', wordFontSize: 11, wordLineSpacing: 1.5 }),
            markdown: `# 项目报告\n\n> 文档日期：YYYY-MM-DD  \n> 负责人：填写姓名\n\n## 1. 摘要\n\n用 3～5 句话概括目标、方法与主要结论。\n\n## 2. 背景与目标\n\n- 背景：\n- 目标：\n- 范围：\n\n## 3. 实施过程\n\n### 3.1 方法\n\n说明关键步骤、工具与约束。\n\n### 3.2 进展\n\n| 阶段 | 状态 | 说明 |\n| --- | --- | --- |\n| 需求确认 | 已完成 |  |\n| 实施 | 进行中 |  |\n| 验收 | 待开始 |  |\n\n## 4. 结果与分析\n\n填写核心数据、图表和解释。\n\n## 5. 风险与后续计划\n\n1. 风险：\n2. 对策：\n3. 下一步：\n`
        }),
        Object.freeze({
            id: 'experiment', name: '实验报告', category: '科研记录', icon: 'E', description: '包含实验目的、材料、步骤、结果和讨论。',
            suggestedName: '实验报告', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordFont: '宋体', wordFontSize: 11, wordLineSpacing: 1.5 }),
            markdown: `# 实验报告\n\n## 一、实验目的\n\n说明本实验需要验证的问题和预期结果。\n\n## 二、材料与仪器\n\n| 名称 | 规格 | 数量 |\n| --- | --- | ---: |\n|  |  |  |\n\n## 三、实验原理\n\n可插入公式，例如：\n\n\\[\nC_\eta = 1\\% C_{\\text{curtail}}\n\\]\n\n## 四、实验步骤\n\n1. \n2. \n3. \n\n## 五、结果\n\n在此插入数据表、图片与计算结果。\n\n${PAGE_BREAK_HTML}\n\n## 六、讨论\n\n分析误差来源、异常现象和改进方案。\n\n## 七、结论\n\n用简洁条目总结核心发现。\n`
        }),
        Object.freeze({
            id: 'paper', name: '论文初稿', category: '学术写作', icon: 'P', description: '提供摘要、方法、结果、讨论和参考文献结构。',
            suggestedName: '论文初稿', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordFont: '宋体', wordFontSize: 10.5, wordLineSpacing: 1.5 }),
            markdown: `# 论文题目\n\n**作者：**  \n**单位：**  \n\n## 摘要\n\n概述研究背景、方法、结果和结论。\n\n**关键词：** 关键词一；关键词二；关键词三\n\n## 1 引言\n\n说明研究背景、已有工作和本文贡献。\n\n## 2 材料与方法\n\n### 2.1 材料\n\n### 2.2 方法\n\n## 3 结果\n\n## 4 讨论\n\n## 5 结论\n\n## 参考文献\n\n1. 作者. 题目. 期刊, 年份.\n`
        }),
        Object.freeze({
            id: 'meeting', name: '会议纪要', category: '协作沟通', icon: 'M', description: '快速记录议题、决定、负责人和截止日期。',
            suggestedName: '会议纪要', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordFont: '微软雅黑', wordFontSize: 10.5, wordLineSpacing: 1.15 }),
            markdown: `# 会议纪要\n\n- **日期：** YYYY-MM-DD\n- **时间：** HH:mm–HH:mm\n- **地点 / 会议方式：** \n- **主持人：** \n- **参会人：** \n\n## 议题\n\n1. \n2. \n\n## 讨论摘要\n\n### 议题一\n\n- 关键观点：\n- 结论：\n\n## 决策与行动项\n\n| 行动项 | 负责人 | 截止日期 | 状态 |\n| --- | --- | --- | --- |\n|  |  |  | 待开始 |\n\n## 下次会议\n\n- 时间：\n- 需要准备：\n`
        }),
        Object.freeze({
            id: 'sop', name: '标准操作规程', category: '流程规范', icon: 'S', description: '适合实验、生产或内部流程的 SOP。',
            suggestedName: '标准操作规程', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordFont: '微软雅黑', wordFontSize: 10.5, wordLineSpacing: 1.5 }),
            markdown: `# 标准操作规程（SOP）\n\n| 字段 | 内容 |\n| --- | --- |\n| 文件编号 | SOP-0001 |\n| 版本 | V1.0 |\n| 生效日期 | YYYY-MM-DD |\n| 编制 / 审核 |  /  |\n\n## 1. 目的\n\n## 2. 适用范围\n\n## 3. 职责\n\n## 4. 材料与设备\n\n## 5. 操作步骤\n\n1. \n2. \n3. \n\n## 6. 质量控制\n\n## 7. 安全与注意事项\n\n> 对高风险步骤使用醒目的说明。\n\n## 8. 记录与归档\n`
        }),
        Object.freeze({
            id: 'landscape-table', name: '横向数据表', category: '数据呈现', icon: 'T', description: '适合列数较多的统计表和清单。',
            suggestedName: '数据汇总表', settings: Object.freeze({ wordPaperSize: 'a4', wordOrientation: 'landscape', wordFont: '微软雅黑', wordFontSize: 9.5, wordLineSpacing: 1.15, wordMarginTopCm: 1.6, wordMarginRightCm: 1.6, wordMarginBottomCm: 1.6, wordMarginLeftCm: 1.6 }),
            markdown: `# 数据汇总表\n\n| 编号 | 项目 | 指标一 | 指标二 | 指标三 | 指标四 | 负责人 | 备注 |\n| ---: | --- | ---: | ---: | ---: | ---: | --- | --- |\n| 1 |  |  |  |  |  |  |  |\n| 2 |  |  |  |  |  |  |  |\n`
        })
    ]);

    const state = {
        initialized: false,
        previewMode: 'web',
        settings: {},
        pageCount: 0,
        overflowIssues: [],
        renderTimer: null,
        resizeTimer: null,
        lastSignature: '',
        lastScale: 1,
        building: false
    };
    const dom = {};
    const $ = (id) => root.document ? root.document.getElementById(id) : null;
    const q = (selector, scope) => (scope || root.document).querySelector(selector);
    const qa = (selector, scope) => Array.from((scope || root.document).querySelectorAll(selector));
    const escapeHtml = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    function safeStorageGet(key) {
        try { return root.localStorage ? root.localStorage.getItem(key) : null; } catch (_error) { return null; }
    }
    function safeStorageSet(key, value) {
        try { if (!root.localStorage) return false; root.localStorage.setItem(key, value); return true; } catch (_error) { return false; }
    }

    function normalizePageSettings(input = {}) {
        const legacyMargin = clamp(Number(input.wordMarginCm ?? 2.54), 0.8, 4.5);
        return {
            wordPaperSize: PAPER_SIZES[input.wordPaperSize] ? input.wordPaperSize : 'a4',
            wordOrientation: input.wordOrientation === 'landscape' ? 'landscape' : 'portrait',
            wordMarginTopCm: clamp(Number(input.wordMarginTopCm ?? legacyMargin), 0.8, 4.5),
            wordMarginRightCm: clamp(Number(input.wordMarginRightCm ?? legacyMargin), 0.8, 4.5),
            wordMarginBottomCm: clamp(Number(input.wordMarginBottomCm ?? legacyMargin), 0.8, 4.5),
            wordMarginLeftCm: clamp(Number(input.wordMarginLeftCm ?? legacyMargin), 0.8, 4.5),
            wordFont: String(input.wordFont || '宋体'),
            wordFontSize: clamp(Number(input.wordFontSize ?? 11), 9, 18),
            wordLineSpacing: clamp(Number(input.wordLineSpacing ?? 1.5), 1, 2.5)
        };
    }

    function pageGeometry(input = {}) {
        const settings = normalizePageSettings(input);
        const paper = PAPER_SIZES[settings.wordPaperSize] || PAPER_SIZES.a4;
        const landscape = settings.wordOrientation === 'landscape';
        const widthMm = landscape ? paper.heightMm : paper.widthMm;
        const heightMm = landscape ? paper.widthMm : paper.heightMm;
        const marginTopMm = settings.wordMarginTopCm * 10;
        const marginRightMm = settings.wordMarginRightCm * 10;
        const marginBottomMm = settings.wordMarginBottomCm * 10;
        const marginLeftMm = settings.wordMarginLeftCm * 10;
        const widthPx = widthMm * PX_PER_MM;
        const heightPx = heightMm * PX_PER_MM;
        return Object.freeze({
            ...settings, widthMm, heightMm, widthPx, heightPx,
            marginTopMm, marginRightMm, marginBottomMm, marginLeftMm,
            marginTopPx: marginTopMm * PX_PER_MM,
            marginRightPx: marginRightMm * PX_PER_MM,
            marginBottomPx: marginBottomMm * PX_PER_MM,
            marginLeftPx: marginLeftMm * PX_PER_MM,
            contentWidthPx: Math.max(120, widthPx - (marginLeftMm + marginRightMm) * PX_PER_MM),
            contentHeightPx: Math.max(160, heightPx - (marginTopMm + marginBottomMm) * PX_PER_MM)
        });
    }

    function getDocxPageProperties(input = {}, docx = {}) {
        const settings = normalizePageSettings(input);
        const paper = PAPER_SIZES[settings.wordPaperSize] || PAPER_SIZES.a4;
        const landscape = settings.wordOrientation === 'landscape';
        const width = landscape ? paper.heightTwip : paper.widthTwip;
        const height = landscape ? paper.widthTwip : paper.heightTwip;
        const toTwip = (cm) => Math.round(Number(cm) / 2.54 * 1440);
        return {
            size: {
                width,
                height,
                orientation: landscape
                    ? (docx.PageOrientation ? docx.PageOrientation.LANDSCAPE : 'landscape')
                    : (docx.PageOrientation ? docx.PageOrientation.PORTRAIT : 'portrait')
            },
            margin: {
                top: toTwip(settings.wordMarginTopCm),
                right: toTwip(settings.wordMarginRightCm),
                bottom: toTwip(settings.wordMarginBottomCm),
                left: toTwip(settings.wordMarginLeftCm)
            }
        };
    }

    function getPerformancePolicy(mode, length) {
        const count = Math.max(0, Number(length) || 0);
        const requested = ['auto', 'realtime', 'balanced', 'manual'].includes(mode) ? mode : 'auto';
        const resolved = requested === 'auto' ? (count >= 30000 ? 'balanced' : 'realtime') : requested;
        if (resolved === 'manual') return Object.freeze({ requested, mode: 'manual', autoRender: false, delay: Infinity, pageDelay: Infinity, label: '手动刷新' });
        if (resolved === 'balanced') {
            const delay = count >= 160000 ? 950 : count >= 80000 ? 680 : 420;
            return Object.freeze({ requested, mode: 'balanced', autoRender: true, delay, pageDelay: Math.max(700, delay + 240), label: '长文优化' });
        }
        const delay = count >= 80000 ? 300 : count >= 25000 ? 190 : 90;
        return Object.freeze({ requested, mode: 'realtime', autoRender: true, delay, pageDelay: 180, label: '实时预览' });
    }

    function templateById(id) {
        return TEMPLATES.find((template) => template.id === id) || null;
    }

    function renderTemplateCards() {
        if (!dom.templateList) return;
        dom.templateList.innerHTML = TEMPLATES.map((template) => `<article class="template-card" data-template-id="${template.id}">
            <div class="template-card-icon" aria-hidden="true">${escapeHtml(template.icon)}</div>
            <div class="template-card-copy"><span>${escapeHtml(template.category)}</span><strong>${escapeHtml(template.name)}</strong><p>${escapeHtml(template.description)}</p></div>
            <button type="button" class="secondary-button" data-action="apply-template" data-template-id="${template.id}">使用模板</button>
        </article>`).join('');
    }

    function openTemplatePanel() {
        const drawer = $('toolDrawer');
        if (!drawer) return;
        drawer.hidden = false;
        $('toolDrawerTitle').textContent = '文档模板';
        ['tableToolPanel', 'aiToolPanel', 'exportCheckToolPanel', 'assetToolPanel', 'professionalToolPanel'].forEach((id) => { const panel = $(id); if (panel) panel.hidden = true; });
        if (dom.templatePanel) dom.templatePanel.hidden = false;
        renderTemplateCards();
        requestAnimationFrame(() => drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' }));
    }

    async function applyTemplate(id) {
        const template = templateById(id);
        if (!template) throw new Error('模板不存在');
        const input = $('markdownInput');
        const nameInput = $('documentNameInput');
        if (!input) return;
        if (input.value.trim() && !root.confirm(`当前文档已有内容。确认使用“${template.name}”替换当前内容？`)) return;
        if (root.Md2WordWorkflow && typeof root.Md2WordWorkflow.createVersion === 'function' && input.value.trim()) {
            await root.Md2WordWorkflow.createVersion(`应用“${template.name}”模板前`, { force: true, automatic: false }).catch(() => null);
        }
        input.value = template.markdown;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        if (nameInput && (!nameInput.value.trim() || nameInput.value.trim() === '未命名')) {
            nameInput.value = template.suggestedName;
            nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        if (root.Md2WordCore && typeof root.Md2WordCore.applySettingsPatch === 'function') {
            root.Md2WordCore.applySettingsPatch(template.settings, { render: true, persist: true });
        }
        $('toolDrawer')?.setAttribute('hidden', '');
        input.focus();
        root.document.dispatchEvent(new CustomEvent('md2word:template-applied', { detail: { id: template.id, name: template.name } }));
    }

    function insertPageBreak() {
        const input = $('markdownInput');
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || start;
        const prefix = start > 0 && input.value[start - 1] !== '\n' ? '\n\n' : '';
        const suffix = end < input.value.length && input.value[end] !== '\n' ? '\n\n' : '';
        input.setRangeText(`${prefix}${PAGE_BREAK_HTML}${suffix}`, start, end, 'end');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.focus();
    }

    function copyPreviewBlock(block) {
        const clone = block.cloneNode(true);
        qa('button, [data-action], .preview-empty-actions', clone).forEach((element) => element.remove());
        const stripHeadingId = (element) => {
            const original = element.id;
            if (original) element.dataset.sourceHeadingId = original;
            element.removeAttribute('id');
        };
        if (clone.id) stripHeadingId(clone);
        qa('[id]', clone).forEach(stripHeadingId);
        return clone;
    }

    function fontFamilyForWord(font) {
        const value = String(font || '宋体');
        if (value === '宋体') return 'SimSun, STSong, serif';
        if (value === '微软雅黑') return '"Microsoft YaHei", "PingFang SC", sans-serif';
        return `${JSON.stringify(value)}, system-ui, sans-serif`;
    }

    function makeMeasureContainer(geometry) {
        const measure = document.createElement('div');
        measure.className = 'preview a4-measure-content';
        Object.assign(measure.style, {
            position: 'fixed', left: '-20000px', top: '0', visibility: 'hidden', pointerEvents: 'none',
            width: `${geometry.contentWidthPx}px`, maxWidth: 'none', minHeight: '0', height: 'auto', overflow: 'visible',
            padding: '0', margin: '0', boxSizing: 'border-box',
            fontFamily: fontFamilyForWord(geometry.wordFont), fontSize: `${geometry.wordFontSize * 96 / 72}px`,
            lineHeight: String(geometry.wordLineSpacing)
        });
        document.body.appendChild(measure);
        return measure;
    }

    function previewPageNumberText(index, total, input = {}) {
        const professional = root.Md2WordProfessional?.normalizeSettings?.(input) || input;
        const current = index + 1;
        if (professional.pageNumberEnabled === false) return '';
        if (professional.pageNumberFormat === 'current-total') return `${current} / ${total}`;
        if (professional.pageNumberFormat === 'page-current') return `第 ${current} 页`;
        if (professional.pageNumberFormat === 'page-current-total') return `第 ${current} 页 / 共 ${total} 页`;
        return String(current);
    }

    function createPageNode(index, pageRecord, totalPages, settings, pageNumberIndex = index) {
        const geometry = pageRecord.geometry;
        const scale = updateScale(geometry);
        const shell = document.createElement('section');
        shell.className = 'a4-page-shell';
        shell.style.width = `${geometry.widthPx * scale}px`;
        shell.style.height = `${geometry.heightPx * scale}px`;
        shell.setAttribute('aria-label', `第 ${index + 1} 页`);
        shell.dataset.orientation = geometry.wordOrientation;
        const page = document.createElement('article');
        page.className = 'a4-page';
        page.style.width = `${geometry.widthPx}px`;
        page.style.height = `${geometry.heightPx}px`;
        page.style.transform = `scale(${scale})`;
        page.style.setProperty('--page-margin-top', `${geometry.marginTopPx}px`);
        page.style.setProperty('--page-margin-right', `${geometry.marginRightPx}px`);
        page.style.setProperty('--page-margin-bottom', `${geometry.marginBottomPx}px`);
        page.style.setProperty('--page-margin-left', `${geometry.marginLeftPx}px`);
        page.style.setProperty('--page-font-family', fontFamilyForWord(geometry.wordFont));
        page.style.setProperty('--page-font-size', `${geometry.wordFontSize * 96 / 72}px`);
        page.style.setProperty('--page-line-height', String(geometry.wordLineSpacing));
        const content = document.createElement('div');
        content.className = 'a4-page-content preview-document-content';
        pageRecord.blocks.forEach((block) => content.appendChild(block));
        const professional = root.Md2WordProfessional?.normalizeSettings?.(settings) || settings;
        const meta = root.Md2WordProfessional?.metadata?.(settings, $('documentNameInput')?.value || '未命名文档') || {};
        const isCover = pageRecord.kind === 'cover' || content.querySelector('[data-professional-cover="true"]');
        const suppressFirstPageHeaderFooter = !professional.coverEnabled && professional.firstPageDifferent && pageNumberIndex === 0;
        if (!isCover && !suppressFirstPageHeaderFooter) {
            page.dataset.professionalPage = 'true';
            const substitute = root.Md2WordProfessional?.substitutePlaceholders || ((value) => String(value || ''));
            const headerText = professional.headerEnabled ? substitute(professional.headerText, meta) : '';
            if (headerText) {
                const header = document.createElement('header');
                header.className = 'a4-page-header';
                header.textContent = headerText;
                page.appendChild(header);
            }
            const footerText = substitute(professional.footerText, meta);
            const pageText = previewPageNumberText(pageNumberIndex, totalPages, professional);
            if (footerText || pageText) {
                const footer = document.createElement('footer');
                footer.className = 'a4-page-footer';
                footer.dataset.align = professional.pageNumberAlignment || 'center';
                footer.textContent = [footerText, pageText].filter(Boolean).join(footerText && pageText ? ' · ' : '');
                page.appendChild(footer);
            }
        }
        const fallbackFooter = document.createElement('footer');
        fallbackFooter.className = 'a4-page-number';
        fallbackFooter.textContent = String(index + 1);
        page.append(content, fallbackFooter);
        shell.appendChild(page);
        return shell;
    }

    function updateScale(geometry) {
        if (!dom.a4Preview) return 1;
        const available = Math.max(280, dom.a4Preview.clientWidth - 42);
        return clamp(available / geometry.widthPx, 0.26, 1);
    }

    function buildA4Preview(options = {}) {
        if (!dom.preview || !dom.a4Preview || state.previewMode !== 'a4') return { pageCount: state.pageCount, overflowIssues: state.overflowIssues };
        if (state.building) return { pageCount: state.pageCount, overflowIssues: state.overflowIssues };
        state.building = true;
        let measure = null;
        try {
            const allSettings = { ...state.settings, ...(root.Md2WordCore?.getSettings?.() || {}) };
            const normalized = normalizePageSettings(allSettings);
            const professional = root.Md2WordProfessional?.normalizeSettings?.({ ...allSettings, ...normalized }) || { ...allSettings, ...normalized };
            const sourceBlocks = root.Md2WordProfessional?.preparePreviewBlocks
                ? root.Md2WordProfessional.preparePreviewBlocks(dom.preview, professional, $('documentNameInput')?.value || '未命名文档')
                : Array.from(dom.preview.children);
            const pages = [];
            let current = [];
            let currentOrientation = normalized.wordOrientation;
            let geometry = pageGeometry({ ...normalized, wordOrientation: currentOrientation });
            let overflowIssues = [];
            let forcedBreakAtEnd = false;

            const resetMeasure = () => {
                if (measure) measure.remove();
                geometry = pageGeometry({ ...normalized, wordOrientation: currentOrientation });
                measure = makeMeasureContainer(geometry);
            };
            const flush = (flushOptions = {}) => {
                const allowEmpty = flushOptions.allowEmpty === true;
                // Do not synthesize a leading blank page before a full-page cover/TOC or an initial section marker.
                // Explicit page breaks can still request a blank page with allowEmpty=true.
                if (!current.length && !allowEmpty) return;
                pages.push({ blocks: current, geometry, kind: flushOptions.kind || 'content' });
                current = [];
                if (measure) measure.replaceChildren();
            };
            resetMeasure();

            if (!sourceBlocks.length) pages.push({ blocks: [], geometry, kind: 'content' });
            sourceBlocks.forEach((sourceBlock, sourceIndex) => {
                if (sourceBlock.matches?.('.md2word-section-break, [data-section-break="true"]')) {
                    flush();
                    currentOrientation = sourceBlock.dataset.orientation === 'portrait' ? 'portrait' : 'landscape';
                    resetMeasure();
                    forcedBreakAtEnd = false;
                    return;
                }
                if (sourceBlock.matches?.('.md2word-page-break, [data-page-break="true"]')) {
                    flush({ allowEmpty: true });
                    forcedBreakAtEnd = true;
                    return;
                }
                forcedBreakAtEnd = false;
                const isFullPage = sourceBlock.classList?.contains('md2word-full-page-block');
                if (isFullPage) {
                    flush();
                    const full = copyPreviewBlock(sourceBlock);
                    const kind = sourceBlock.dataset.professionalCover === 'true' ? 'cover' : sourceBlock.dataset.professionalToc === 'true' ? 'toc' : 'full';
                    // The DOCX cover is always portrait. Keep the browser page preview aligned
                    // even when the document's default body orientation is landscape.
                    const fullGeometry = kind === 'cover'
                        ? pageGeometry({ ...normalized, wordOrientation: 'portrait' })
                        : geometry;
                    pages.push({ blocks: [full], geometry: fullGeometry, kind });
                    current = [];
                    measure.replaceChildren();
                    return;
                }
                const clone = copyPreviewBlock(sourceBlock);
                measure.appendChild(clone);
                const height = measure.scrollHeight;
                if (height <= geometry.contentHeightPx + 1) {
                    current.push(clone.cloneNode(true));
                    return;
                }

                measure.removeChild(clone);
                if (current.length) flush();
                measure.appendChild(clone);
                const singleHeight = measure.scrollHeight;
                const single = clone.cloneNode(true);
                if (singleHeight > geometry.contentHeightPx + 1) {
                    single.classList.add('a4-overflow-block');
                    overflowIssues.push({
                        id: `page-overflow-${sourceIndex}`,
                        severity: 'warning', type: 'page-overflow', title: '内容块可能跨出页面',
                        message: `第 ${sourceIndex + 1} 个内容块高度超过单页可用区域，Word 可能自动拆分该段落、表格或图片。`,
                        start: null, end: null, line: null, column: null, locatable: false
                    });
                }
                current.push(single);
                flush();
            });
            if (current.length || !pages.length || forcedBreakAtEnd) flush({ allowEmpty: forcedBreakAtEnd });

            dom.a4Preview.replaceChildren();
            let numberedPageIndex = 0;
            pages.forEach((record, index) => {
                const pageNumberIndex = record.kind === 'cover' ? null : numberedPageIndex++;
                dom.a4Preview.appendChild(createPageNode(index, record, pages.length, professional, pageNumberIndex));
            });
            state.pageCount = pages.length;
            state.overflowIssues = overflowIssues;
            state.lastScale = pages.length ? updateScale(pages[0].geometry) : 1;
            const paper = PAPER_SIZES[normalized.wordPaperSize] || PAPER_SIZES.a4;
            const orientations = new Set(pages.map((page) => page.geometry.wordOrientation));
            const orientationLabel = orientations.size > 1 ? '混合方向' : (normalized.wordOrientation === 'landscape' ? '横向' : '纵向');
            const extras = [professional.coverEnabled ? '含封面' : '', professional.tocEnabled ? '含目录' : ''].filter(Boolean).join(' · ');
            if (dom.pagePreviewStatus) dom.pagePreviewStatus.textContent = `${paper.label} · ${orientationLabel} · 预计 ${pages.length} 页${extras ? ` · ${extras}` : ''}${overflowIssues.length ? ` · ${overflowIssues.length} 项溢出提醒` : ''}`;
            root.document.dispatchEvent(new CustomEvent('md2word:page-preview-updated', { detail: { pageCount: pages.length, overflowIssues, orientations: Array.from(orientations) } }));
            return { pageCount: pages.length, overflowIssues };
        } finally {
            if (measure) measure.remove();
            state.building = false;
        }
    }

    function scheduleA4Preview(options = {}) {
        clearTimeout(state.renderTimer);
        if (state.previewMode !== 'a4') return;
        const settings = root.Md2WordCore?.getSettings?.() || {};
        const policy = getPerformancePolicy(settings.previewPerformanceMode || 'auto', $('markdownInput')?.value.length || 0);
        const wait = options.immediate ? 0 : Number.isFinite(policy.pageDelay) ? policy.pageDelay : 900;
        state.renderTimer = setTimeout(() => {
            const run = () => buildA4Preview(options);
            if (!options.immediate && typeof root.requestIdleCallback === 'function') root.requestIdleCallback(run, { timeout: 1200 });
            else run();
        }, wait);
    }

    function setPreviewMode(mode, options = {}) {
        const next = mode === 'a4' ? 'a4' : 'web';
        state.previewMode = next;
        if (options.persist !== false) safeStorageSet(PREVIEW_MODE_KEY, next);
        if (dom.preview) dom.preview.hidden = next !== 'web';
        if (dom.a4Preview) dom.a4Preview.hidden = next !== 'a4';
        qa('[data-preview-mode]').forEach((button) => {
            const active = button.dataset.previewMode === next;
            button.classList.toggle('active', active);
            button.setAttribute('aria-pressed', String(active));
        });
        if (dom.pagePreviewStatus) dom.pagePreviewStatus.hidden = next !== 'a4';
        if (next === 'a4') scheduleA4Preview({ immediate: true });
        root.document.dispatchEvent(new CustomEvent('md2word:preview-mode-changed', { detail: { mode: next } }));
    }

    function locateHeading(id) {
        if (state.previewMode !== 'a4' || !dom.a4Preview || !id) return false;
        const target = q(`[data-source-heading-id="${cssEscape(id)}"]`, dom.a4Preview);
        if (!target) return false;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('a4-heading-pulse');
        setTimeout(() => target.classList.remove('a4-heading-pulse'), 900);
        return true;
    }

    function cssEscape(value) {
        if (root.CSS && typeof root.CSS.escape === 'function') return root.CSS.escape(value);
        return String(value).replace(/([ #;.?+*~':"!^$[\]()=>|/@])/g, '\\$1');
    }

    function onPreviewRendered(preview, settings = {}) {
        if (preview) dom.preview = preview;
        state.settings = { ...state.settings, ...settings };
        scheduleA4Preview();
    }

    function getPageIssues() {
        return state.overflowIssues.map((issue) => ({ ...issue }));
    }

    function cacheDom() {
        Object.assign(dom, {
            preview: $('preview'), a4Preview: $('a4Preview'), pagePreviewStatus: $('pagePreviewStatus'),
            templatePanel: $('templateToolPanel'), templateList: $('templateList')
        });
    }

    async function handleAction(button, event) {
        const action = button.dataset.action;
        if (!['open-templates', 'apply-template', 'insert-page-break', 'refresh-preview'].includes(action) && !button.dataset.previewMode) return false;
        event.preventDefault();
        if (button.dataset.previewMode) setPreviewMode(button.dataset.previewMode);
        else if (action === 'open-templates') openTemplatePanel();
        else if (action === 'apply-template') await applyTemplate(button.dataset.templateId);
        else if (action === 'insert-page-break') insertPageBreak();
        else if (action === 'refresh-preview') root.Md2WordCore?.renderPreview?.({ immediate: true, force: true, manual: true });
        return true;
    }

    function initialize() {
        if (state.initialized || !root.document) return;
        state.initialized = true;
        cacheDom();
        const stored = safeStorageGet(PREVIEW_MODE_KEY);
        state.previewMode = stored === 'a4' ? 'a4' : 'web';
        renderTemplateCards();
        document.addEventListener('click', (event) => {
            const button = event.target.closest('[data-action], [data-preview-mode]');
            if (!button) return;
            Promise.resolve(handleAction(button, event)).catch((error) => console.error('出版工具操作失败', error));
        }, true);
        document.addEventListener('md2word:assets-resolved', () => scheduleA4Preview({ immediate: true }));
        window.addEventListener('resize', () => {
            clearTimeout(state.resizeTimer);
            state.resizeTimer = setTimeout(() => scheduleA4Preview({ immediate: true }), 120);
        });
        setPreviewMode(state.previewMode, { persist: false });
    }

    if (root.addEventListener) root.addEventListener('DOMContentLoaded', initialize, { once: true });

    return Object.freeze({
        version: '5.5', PAPER_SIZES, PAGE_BREAK_HTML, TEMPLATES,
        normalizePageSettings, pageGeometry, getDocxPageProperties, getPerformancePolicy,
        templateById, applyTemplate, openTemplatePanel, insertPageBreak,
        setPreviewMode, getPreviewMode: () => state.previewMode, buildA4Preview, scheduleA4Preview,
        onPreviewRendered, locateHeading, getPageIssues, getState: () => ({ ...state, overflowIssues: getPageIssues() })
    });
}));
