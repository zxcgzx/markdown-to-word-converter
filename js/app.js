(function () {
    'use strict';

    const STORAGE = {
        settings: 'md2word.personal.settings.v3',
        autosave: 'md2word.personal.autosave.v3',
        split: 'md2word.personal.split.v3',
        ai: 'md2word.personal.ai.v3'
    };

    const DEFAULT_SETTINGS = Object.freeze({
        theme: 'system',
        editorFontSize: 15,
        autosave: true,
        repairLooseMath: true,
        syncScroll: false,
        wordFont: '宋体',
        wordFontSize: 11,
        wordLineSpacing: 1.5,
        wordMarginCm: 2.54
    });

    const AI_PRESETS = Object.freeze({
        custom: { type: 'openai', endpoint: '', model: '' },
        kimi: { type: 'openai', endpoint: 'https://api.moonshot.cn/v1/chat/completions', model: 'moonshot-v1-32k' },
        glm: { type: 'openai', endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions', model: 'glm-4-flash' },
        deepseek: { type: 'openai', endpoint: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
        openai: { type: 'openai', endpoint: 'https://api.openai.com/v1/chat/completions', model: '' },
        gemini: { type: 'gemini', endpoint: 'https://generativelanguage.googleapis.com/v1beta', model: 'gemini-2.5-flash' }
    });

    const FORMULA_EXAMPLE = String.raw`# 化学结构示例

在化学逻辑上是可以成立的，目标结构也写对了：

\[
\text{玻片–O–Si–(CH}_2)_3\text{–S–S–(CH}_2)_2\text{–NH–CO–C(Br)(CH}_3)_2
\]

行内公式同样支持，例如 \(k = A e^{-E_a/(RT)}\)。

## 支持的边界

- 行内：\`$x_1$\` 或 \`\\(x_1\\)\`
- 独立：\`$$...$$\` 或 \`\\[...\\]\`
- 从 AI 文本中复制来的独立 \`[ ... ]\` 块，在内部明显含 TeX 时也会自动修复。

> 公式会在 Markdown 解析前被保护，因此反斜杠不会再被 Marked 当成普通转义吃掉。`;

    const EMPTY_PREVIEW_HTML = `
        <div class="preview-empty">
            <div class="preview-empty-card">
                <div class="preview-empty-icon" aria-hidden="true">✦</div>
                <h3>从一段 Markdown 开始</h3>
                <p>粘贴内容后会立即预览。公式支持 <code>$...$</code>、<code>$$...$$</code>、<code>\\(...\\)</code> 和 <code>\\[...\\]</code>。</p>
                <button type="button" class="primary-button" data-action="load-formula-example">加载公式示例</button>
            </div>
        </div>`;

    const state = {
        settings: { ...DEFAULT_SETTINGS },
        renderTimer: null,
        renderGeneration: 0,
        renderResult: null,
        currentFileName: '未命名.md',
        dirty: false,
        autosaveTimer: null,
        syncLock: false,
        dragDepth: 0,
        splitterDrag: null,
        aiAbortController: null,
        aiTarget: null,
        aiConfig: null,
        tableMarkdown: '',
        themeMedia: null,
        lastLooseFixNoticeHash: '',
        initialized: false
    };

    const dom = {};

    function byId(id) {
        return document.getElementById(id);
    }

    function queryAll(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function safeJsonParse(raw, fallback) {
        if (!raw) return fallback;
        try {
            return JSON.parse(raw);
        } catch (_error) {
            return fallback;
        }
    }

    function nextFrame() {
        return new Promise((resolve) => requestAnimationFrame(() => resolve()));
    }

    function debounce(fn, wait) {
        let timer = null;
        return function debounced(...args) {
            window.clearTimeout(timer);
            timer = window.setTimeout(() => fn.apply(this, args), wait);
        };
    }

    function initialize() {
        if (state.initialized) return;
        state.initialized = true;
        cacheDom();
        loadSettings();
        loadAIConfig();
        applySettings();
        checkDependencies();
        bindEvents();
        restoreAutosave();
        restoreSplitPosition();
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true });
        updateTableOutput();
    }

    function cacheDom() {
        Object.assign(dom, {
            app: byId('app'),
            dependencyBanner: byId('dependencyBanner'),
            dependencyMessage: byId('dependencyMessage'),
            markdownInput: byId('markdownInput'),
            preview: byId('preview'),
            workspace: byId('workspace'),
            editorFrame: byId('editorFrame'),
            dropOverlay: byId('dropOverlay'),
            splitter: byId('splitter'),
            fileInput: byId('fileInput'),
            saveDot: byId('saveDot'),
            saveStatus: byId('saveStatus'),
            mathStatus: byId('mathStatus'),
            mathStatusText: byId('mathStatusText'),
            outlineSelect: byId('outlineSelect'),
            syncScrollToggle: byId('syncScrollToggle'),
            renderStatus: byId('renderStatus'),
            charCount: byId('charCount'),
            wordCount: byId('wordCount'),
            lineCount: byId('lineCount'),
            readTime: byId('readTime'),
            toastRegion: byId('toastRegion'),
            settingsDialog: byId('settingsDialog'),
            settingsForm: byId('settingsForm'),
            aiDialog: byId('aiDialog'),
            aiResultDialog: byId('aiResultDialog'),
            tableDialog: byId('tableDialog'),
            diagnosticsDialog: byId('diagnosticsDialog'),
            shortcutDialog: byId('shortcutDialog'),
            diagnosticsContent: byId('diagnosticsContent'),
            applyMathNormalization: byId('applyMathNormalization'),
            exportProgress: byId('exportProgress'),
            exportProgressTitle: byId('exportProgressTitle'),
            exportProgressText: byId('exportProgressText')
        });
    }

    function bindEvents() {
        dom.markdownInput.addEventListener('input', onEditorInput);
        dom.markdownInput.addEventListener('keydown', onEditorKeydown);
        dom.markdownInput.addEventListener('scroll', () => syncScrollFrom(dom.markdownInput, dom.preview));
        dom.preview.addEventListener('scroll', () => syncScrollFrom(dom.preview, dom.markdownInput));
        dom.fileInput.addEventListener('change', onFileChosen);
        dom.outlineSelect.addEventListener('change', navigateOutline);
        dom.syncScrollToggle.addEventListener('change', () => {
            state.settings.syncScroll = dom.syncScrollToggle.checked;
            persistSettings();
        });
        dom.mathStatus.addEventListener('click', openDiagnostics);
        byId('themeButton').addEventListener('click', toggleTheme);
        byId('settingsButton').addEventListener('click', openSettings);
        byId('shortcutButton').addEventListener('click', () => showDialog(dom.shortcutDialog));
        document.addEventListener('click', handleDelegatedClick);
        document.addEventListener('keydown', onGlobalKeydown);
        bindViewSwitch();
        bindSplitter();
        bindDragAndDrop();
        bindSettingsDialog();
        bindAIDialog();
        bindTableDialog();
        bindDiagnosticsDialog();
        window.addEventListener('resize', debounce(() => {
            sanitizeSplitPosition();
            if (state.settings.theme === 'system') applyTheme();
        }, 120));

        state.themeMedia = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
        if (state.themeMedia && typeof state.themeMedia.addEventListener === 'function') {
            state.themeMedia.addEventListener('change', () => {
                if (state.settings.theme === 'system') applyTheme();
            });
        }
    }

    function handleDelegatedClick(event) {
        const commandButton = event.target.closest('[data-command]');
        if (commandButton) {
            applyEditorCommand(commandButton.dataset.command);
            return;
        }

        const actionButton = event.target.closest('[data-action]');
        if (!actionButton) return;
        const action = actionButton.dataset.action;
        const handlers = {
            reload: () => window.location.reload(),
            'new-document': newDocument,
            'open-file': openFilePicker,
            'save-markdown': saveMarkdownFile,
            'clear-document': clearDocument,
            'load-formula-example': loadFormulaExample,
            'refresh-preview': () => renderPreview({ immediate: true, force: true }),
            'copy-rich': copyRichText,
            'download-word': downloadWord,
            'open-ai': openAI,
            'open-table': () => showDialog(dom.tableDialog),
            'reset-settings': resetSettings,
            'run-ai': runAIRepair,
            'cancel-ai': cancelAIRequest,
            'copy-ai-result': copyAIResult,
            'apply-ai-result': applyAIResult,
            'copy-table': copyTableMarkdown,
            'insert-table': insertTableMarkdown
        };
        if (handlers[action]) handlers[action]();
    }

    function checkDependencies() {
        const missing = [];
        if (!window.marked || typeof window.marked.parse !== 'function') missing.push('Marked.js');
        if (!window.DOMPurify || typeof window.DOMPurify.sanitize !== 'function') missing.push('DOMPurify');
        if (!window.katex || typeof window.katex.renderToString !== 'function') missing.push('KaTeX（公式会显示源码）');
        if (!window.Md2WordMath) missing.push('本地公式引擎');
        if (!window.docx) missing.push('docx（Word 导出不可用）');
        if (typeof window.saveAs !== 'function') missing.push('FileSaver（将使用浏览器下载降级）');

        if (missing.length) {
            dom.dependencyMessage.textContent = `未加载：${missing.join('、')}。请检查网络后刷新。`;
            dom.dependencyBanner.hidden = false;
        } else {
            dom.dependencyBanner.hidden = true;
        }
    }

    function loadSettings() {
        const stored = safeJsonParse(localStorage.getItem(STORAGE.settings), {});
        state.settings = {
            ...DEFAULT_SETTINGS,
            ...stored,
            editorFontSize: clamp(Number(stored.editorFontSize ?? DEFAULT_SETTINGS.editorFontSize), 12, 24),
            wordFontSize: clamp(Number(stored.wordFontSize ?? DEFAULT_SETTINGS.wordFontSize), 9, 18),
            wordLineSpacing: clamp(Number(stored.wordLineSpacing ?? DEFAULT_SETTINGS.wordLineSpacing), 1, 2.5),
            wordMarginCm: clamp(Number(stored.wordMarginCm ?? DEFAULT_SETTINGS.wordMarginCm), 1, 4)
        };
    }

    function persistSettings() {
        localStorage.setItem(STORAGE.settings, JSON.stringify(state.settings));
    }

    function applySettings() {
        applyTheme();
        document.documentElement.style.setProperty('--editor-font-size', `${state.settings.editorFontSize}px`);
        dom.syncScrollToggle.checked = Boolean(state.settings.syncScroll);
    }

    function applyTheme() {
        const prefersDark = state.themeMedia
            ? state.themeMedia.matches
            : window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const resolved = state.settings.theme === 'system'
            ? (prefersDark ? 'dark' : 'light')
            : state.settings.theme;
        document.documentElement.dataset.theme = resolved;
        byId('themeButton').textContent = resolved === 'dark' ? '☀' : '◐';
        byId('themeButton').title = resolved === 'dark' ? '切换到浅色主题' : '切换到深色主题';
    }

    function toggleTheme() {
        const current = document.documentElement.dataset.theme || 'light';
        state.settings.theme = current === 'dark' ? 'light' : 'dark';
        persistSettings();
        applyTheme();
        populateSettingsForm();
    }

    function openSettings() {
        populateSettingsForm();
        showDialog(dom.settingsDialog);
    }

    function populateSettingsForm() {
        byId('themeSelect').value = state.settings.theme;
        byId('editorFontSize').value = state.settings.editorFontSize;
        byId('autosaveToggle').checked = Boolean(state.settings.autosave);
        byId('repairLooseMathToggle').checked = Boolean(state.settings.repairLooseMath);
        byId('wordFont').value = state.settings.wordFont;
        byId('wordFontSize').value = state.settings.wordFontSize;
        byId('wordLineSpacing').value = String(state.settings.wordLineSpacing);
        byId('wordMarginCm').value = state.settings.wordMarginCm;
    }

    function bindSettingsDialog() {
        dom.settingsForm.addEventListener('submit', (event) => {
            event.preventDefault();
            if (event.submitter && event.submitter.value === 'cancel') {
                dom.settingsDialog.close('cancel');
                return;
            }
            state.settings = {
                ...state.settings,
                theme: byId('themeSelect').value,
                editorFontSize: clamp(Number(byId('editorFontSize').value), 12, 24),
                autosave: byId('autosaveToggle').checked,
                repairLooseMath: byId('repairLooseMathToggle').checked,
                wordFont: byId('wordFont').value,
                wordFontSize: clamp(Number(byId('wordFontSize').value), 9, 18),
                wordLineSpacing: clamp(Number(byId('wordLineSpacing').value), 1, 2.5),
                wordMarginCm: clamp(Number(byId('wordMarginCm').value), 1, 4)
            };
            persistSettings();
            applySettings();
            updateSaveStatus();
            renderPreview({ immediate: true, force: true });
            dom.settingsDialog.close('save');
            toast('设置已保存', '界面与导出偏好已更新。', 'success');
        });
    }

    function resetSettings() {
        state.settings = { ...DEFAULT_SETTINGS };
        persistSettings();
        applySettings();
        populateSettingsForm();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        toast('已恢复默认设置', '', 'success');
    }

    function showDialog(dialog) {
        if (!dialog) return;
        if (typeof dialog.showModal === 'function') {
            if (!dialog.open) dialog.showModal();
        } else {
            dialog.setAttribute('open', '');
        }
    }

    function closeDialog(dialog, value = '') {
        if (!dialog) return;
        if (typeof dialog.close === 'function' && dialog.open) dialog.close(value);
        else dialog.removeAttribute('open');
    }

    function onEditorInput() {
        state.dirty = true;
        dom.saveDot.classList.add('dirty');
        updateStats();
        scheduleRender();
        scheduleAutosave();
    }

    function scheduleRender() {
        window.clearTimeout(state.renderTimer);
        const length = dom.markdownInput.value.length;
        const delay = length > 80000 ? 360 : length > 25000 ? 220 : 110;
        dom.renderStatus.textContent = '等待渲染…';
        state.renderTimer = window.setTimeout(() => renderPreview({ force: true }), delay);
    }

    function renderPreview(options = {}) {
        const { immediate = false } = options;
        if (!immediate && state.renderTimer) {
            window.clearTimeout(state.renderTimer);
            state.renderTimer = null;
        }

        const text = dom.markdownInput.value;
        const generation = ++state.renderGeneration;
        const startedAt = performance.now();
        const previousRatio = getScrollRatio(dom.preview);

        if (!text.trim()) {
            dom.preview.innerHTML = EMPTY_PREVIEW_HTML;
            state.renderResult = {
                html: EMPTY_PREVIEW_HTML,
                mathCount: 0,
                errors: [],
                warnings: [],
                looseDelimiterFixes: 0,
                normalizedMarkdown: text,
                segments: []
            };
            updateMathStatus();
            buildOutline();
            dom.renderStatus.textContent = '等待输入';
            return state.renderResult;
        }

        if (!window.Md2WordMath || !window.marked) {
            dom.preview.innerHTML = '<div class="math-error">核心解析依赖未加载，请刷新页面。</div>';
            dom.renderStatus.textContent = '解析器未加载';
            return null;
        }

        try {
            const sanitize = (html) => {
                if (window.DOMPurify && typeof window.DOMPurify.sanitize === 'function') {
                    return window.DOMPurify.sanitize(html, {
                        USE_PROFILES: { html: true },
                        ADD_ATTR: ['target', 'rel']
                    });
                }
                return html;
            };

            const result = window.Md2WordMath.renderMarkdownWithMath(text, {
                marked: window.marked,
                katex: window.katex,
                sanitize
            }, {
                repairLooseDelimiters: state.settings.repairLooseMath
            });

            if (generation !== state.renderGeneration) return state.renderResult;
            dom.preview.innerHTML = result.html;
            state.renderResult = result;
            decoratePreviewLinks();
            buildOutline();
            updateMathStatus();
            requestAnimationFrame(() => setScrollRatio(dom.preview, previousRatio));

            const elapsed = Math.max(1, Math.round(performance.now() - startedAt));
            dom.renderStatus.textContent = `已渲染 · ${elapsed} ms`;
            maybeNotifyLooseMathFix(result, text);
            return result;
        } catch (error) {
            console.error('Markdown 渲染失败:', error);
            dom.preview.innerHTML = `
                <div class="math-error">
                    <strong>预览解析失败</strong>
                    <code>${window.Md2WordMath.escapeHtml(error.message || String(error))}</code>
                </div>`;
            dom.renderStatus.textContent = '渲染失败';
            state.renderResult = null;
            updateMathStatus();
            return null;
        }
    }

    function decoratePreviewLinks() {
        queryAll('a', dom.preview).forEach((link) => {
            const href = link.getAttribute('href') || '';
            if (/^(https?:)?\/\//i.test(href)) {
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
            }
        });
    }

    function maybeNotifyLooseMathFix(result, source) {
        if (!result || !result.looseDelimiterFixes) return;
        const hash = window.Md2WordMath.simpleHash(`${source}:${result.looseDelimiterFixes}`);
        if (hash === state.lastLooseFixNoticeHash) return;
        state.lastLooseFixNoticeHash = hash;
        toast(
            '已兼容松散公式边界',
            `检测并临时修复 ${result.looseDelimiterFixes} 处独立 [ … ] 公式块。点击公式状态可写回标准 \\[ … \\] 语法。`,
            'info',
            5200
        );
    }

    function updateMathStatus() {
        const result = state.renderResult;
        dom.mathStatus.classList.remove('ok', 'warning', 'error');
        if (!result || !result.mathCount) {
            dom.mathStatusText.textContent = '未检测到公式';
            return;
        }

        if (result.errors.length) {
            dom.mathStatus.classList.add('error');
            dom.mathStatusText.textContent = `${result.mathCount} 个公式 · ${result.errors.length} 个错误`;
        } else if (result.warnings.length || result.looseDelimiterFixes) {
            dom.mathStatus.classList.add('warning');
            const extra = result.looseDelimiterFixes ? ` · 修复 ${result.looseDelimiterFixes} 处边界` : '';
            dom.mathStatusText.textContent = `${result.mathCount} 个公式${extra}`;
        } else {
            dom.mathStatus.classList.add('ok');
            dom.mathStatusText.textContent = `${result.mathCount} 个公式 · 正常`;
        }
    }

    function buildOutline() {
        const headings = queryAll('h1, h2, h3, h4, h5, h6', dom.preview);
        dom.outlineSelect.innerHTML = '';
        if (!headings.length) {
            const option = new Option('无标题', '');
            dom.outlineSelect.add(option);
            dom.outlineSelect.disabled = true;
            return;
        }

        dom.outlineSelect.disabled = false;
        dom.outlineSelect.add(new Option(`大纲（${headings.length}）`, ''));
        const used = new Set();
        headings.forEach((heading, index) => {
            const level = Number(heading.tagName.slice(1));
            const base = slugify(heading.textContent || `heading-${index + 1}`) || `heading-${index + 1}`;
            let id = base;
            let suffix = 2;
            while (used.has(id) || document.getElementById(id)) {
                id = `${base}-${suffix}`;
                suffix += 1;
            }
            used.add(id);
            heading.id = id;
            const indent = '\u00a0'.repeat(Math.max(0, level - 1) * 2);
            dom.outlineSelect.add(new Option(`${indent}${heading.textContent.trim()}`, id));
        });
    }

    function slugify(value) {
        return String(value)
            .trim()
            .toLowerCase()
            .replace(/[^\p{L}\p{N}\s-]/gu, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .slice(0, 80);
    }

    function navigateOutline() {
        const id = dom.outlineSelect.value;
        if (!id) return;
        const target = dom.preview.querySelector(`#${cssEscape(id)}`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        dom.outlineSelect.value = '';
    }

    function cssEscape(value) {
        if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
        return String(value).replace(/([ #;.?+*~':"!^$[\]()=>|/@])/g, '\\$1');
    }

    function updateStats() {
        const text = dom.markdownInput.value;
        const chars = text.length;
        const lines = text ? text.split('\n').length : 1;
        const latinWords = (text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || []).length;
        const cjkChars = (text.match(/[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g) || []).length;
        const words = latinWords + cjkChars;
        const minutes = words ? Math.max(1, Math.ceil(words / 380)) : 0;
        dom.charCount.textContent = chars.toLocaleString();
        dom.wordCount.textContent = words.toLocaleString();
        dom.lineCount.textContent = lines.toLocaleString();
        dom.readTime.textContent = minutes.toLocaleString();
    }

    function scheduleAutosave() {
        window.clearTimeout(state.autosaveTimer);
        if (!state.settings.autosave) {
            updateSaveStatus();
            return;
        }
        dom.saveStatus.textContent = '正在等待自动保存…';
        state.autosaveTimer = window.setTimeout(saveAutosave, 650);
    }

    function saveAutosave() {
        if (!state.settings.autosave) return;
        const payload = {
            content: dom.markdownInput.value,
            fileName: state.currentFileName,
            updatedAt: Date.now()
        };
        try {
            localStorage.setItem(STORAGE.autosave, JSON.stringify(payload));
            updateSaveStatus(payload.updatedAt);
        } catch (error) {
            console.warn('自动保存失败:', error);
            dom.saveStatus.textContent = '自动保存失败（本地空间可能已满）';
            dom.saveDot.classList.add('dirty');
        }
    }

    function restoreAutosave() {
        const payload = safeJsonParse(localStorage.getItem(STORAGE.autosave), null);
        if (!payload || typeof payload.content !== 'string' || !payload.content.trim()) return;
        dom.markdownInput.value = payload.content;
        state.currentFileName = payload.fileName || '未命名.md';
        state.dirty = false;
        updateSaveStatus(payload.updatedAt);
        toast('已恢复本地草稿', formatDateTime(payload.updatedAt), 'info', 3600);
    }

    function updateSaveStatus(timestamp = null) {
        if (!state.settings.autosave) {
            dom.saveStatus.textContent = '自动保存已关闭';
            dom.saveDot.classList.toggle('dirty', state.dirty);
            return;
        }
        const payload = timestamp
            ? { updatedAt: timestamp }
            : safeJsonParse(localStorage.getItem(STORAGE.autosave), null);
        if (payload && payload.updatedAt) {
            dom.saveStatus.textContent = `本地已保存 · ${formatTime(payload.updatedAt)}`;
        } else {
            dom.saveStatus.textContent = '本地草稿已启用';
        }
        dom.saveDot.classList.toggle('dirty', state.dirty);
    }

    function formatTime(value) {
        try {
            return new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value));
        } catch (_error) {
            return new Date(value).toLocaleTimeString();
        }
    }

    function formatDateTime(value) {
        try {
            return new Intl.DateTimeFormat('zh-CN', {
                month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
            }).format(new Date(value));
        } catch (_error) {
            return new Date(value).toLocaleString();
        }
    }

    function loadFormulaExample() {
        if (dom.markdownInput.value.trim() && !window.confirm('当前内容将被公式示例替换，继续吗？')) return;
        dom.markdownInput.value = FORMULA_EXAMPLE;
        state.currentFileName = '公式示例.md';
        state.dirty = true;
        onEditorInput();
        dom.markdownInput.focus();
        toast('已加载公式示例', '包含你截图中的化学结构公式。', 'success');
    }

    function clearDocument() {
        if (!dom.markdownInput.value) return;
        if (!window.confirm('确认清空当前文档？本地自动保存会同步更新。')) return;
        dom.markdownInput.value = '';
        state.currentFileName = '未命名.md';
        state.dirty = true;
        onEditorInput();
        dom.markdownInput.focus();
    }

    function newDocument() {
        if (dom.markdownInput.value.trim() && state.dirty && !window.confirm('新建文档会清空当前编辑内容，继续吗？')) return;
        dom.markdownInput.value = '';
        state.currentFileName = '未命名.md';
        state.dirty = false;
        if (state.settings.autosave) localStorage.removeItem(STORAGE.autosave);
        updateStats();
        updateSaveStatus();
        renderPreview({ immediate: true, force: true });
        dom.markdownInput.focus();
    }

    function applyEditorCommand(command) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end);

        const commands = {
            heading: () => prefixSelectedLines('## '),
            bold: () => wrapSelection('**', '**', '重点内容'),
            italic: () => wrapSelection('*', '*', '强调内容'),
            quote: () => prefixSelectedLines('> '),
            'unordered-list': () => prefixSelectedLines('- '),
            'ordered-list': () => prefixSelectedLines((_line, index) => `${index + 1}. `),
            code: () => selected.includes('\n')
                ? wrapSelection('```\n', '\n```', '代码')
                : wrapSelection('`', '`', '代码'),
            'inline-math': () => wrapSelection('\\(', '\\)', 'x_1'),
            'display-math': () => wrapSelection('\n\\[\n', '\n\\]\n', String.raw`\text{示例}_2`)
        };
        if (commands[command]) commands[command]();
    }

    function wrapSelection(before, after, placeholder) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        const selected = input.value.slice(start, end) || placeholder;
        const replacement = `${before}${selected}${after}`;
        input.setRangeText(replacement, start, end, 'end');
        const selectionStart = start + before.length;
        input.setSelectionRange(selectionStart, selectionStart + selected.length);
        input.focus();
        onEditorInput();
    }

    function prefixSelectedLines(prefix) {
        const input = dom.markdownInput;
        const value = input.value;
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        const blockStart = value.lastIndexOf('\n', selectionStart - 1) + 1;
        let blockEnd = value.indexOf('\n', selectionEnd);
        if (blockEnd === -1) blockEnd = value.length;
        const block = value.slice(blockStart, blockEnd);
        const lines = block.split('\n');
        const transformed = lines.map((line, index) => `${typeof prefix === 'function' ? prefix(line, index) : prefix}${line}`).join('\n');
        input.setRangeText(transformed, blockStart, blockEnd, 'select');
        input.focus();
        onEditorInput();
    }

    function handleTabKey(event) {
        const input = dom.markdownInput;
        const start = input.selectionStart;
        const end = input.selectionEnd;
        if (start === end && !event.shiftKey) {
            input.setRangeText('    ', start, end, 'end');
            onEditorInput();
            return;
        }

        const value = input.value;
        const blockStart = value.lastIndexOf('\n', start - 1) + 1;
        let blockEnd = value.indexOf('\n', end);
        if (blockEnd === -1) blockEnd = value.length;
        const block = value.slice(blockStart, blockEnd);
        const transformed = block.split('\n').map((line) => {
            if (event.shiftKey) return line.replace(/^( {1,4}|\t)/, '');
            return `    ${line}`;
        }).join('\n');
        input.setRangeText(transformed, blockStart, blockEnd, 'select');
        onEditorInput();
    }

    function onEditorKeydown(event) {
        if (event.key === 'Tab') {
            event.preventDefault();
            handleTabKey(event);
        }
    }

    function onGlobalKeydown(event) {
        const modifier = event.ctrlKey || event.metaKey;
        const key = event.key.toLowerCase();
        if (modifier && key === 's') {
            event.preventDefault();
            saveMarkdownFile();
        } else if (modifier && key === 'o') {
            event.preventDefault();
            openFilePicker();
        } else if (modifier && key === 'd') {
            event.preventDefault();
            downloadWord();
        } else if (modifier && event.key === 'Enter') {
            event.preventDefault();
            copyRichText();
        } else if (modifier && key === 'b' && document.activeElement === dom.markdownInput) {
            event.preventDefault();
            applyEditorCommand('bold');
        } else if (modifier && key === 'i' && document.activeElement === dom.markdownInput) {
            event.preventDefault();
            applyEditorCommand('italic');
        } else if (modifier && key === '/') {
            event.preventDefault();
            showDialog(dom.shortcutDialog);
        } else if (modifier && key === 'n') {
            event.preventDefault();
            newDocument();
        } else if (event.altKey && key === 'm') {
            event.preventDefault();
            applyEditorCommand('display-math');
        }
    }

    function openFilePicker() {
        dom.fileInput.value = '';
        dom.fileInput.click();
    }

    function onFileChosen(event) {
        const file = event.target.files && event.target.files[0];
        if (file) loadFile(file);
    }

    function loadFile(file) {
        const allowed = /\.(md|markdown|txt)$/i.test(file.name) || /^text\//i.test(file.type || '');
        if (!allowed) {
            toast('无法打开文件', '请选择 .md、.markdown 或 .txt 文件。', 'error');
            return;
        }
        if (file.size > 10 * 1024 * 1024) {
            toast('文件过大', '当前前端版本将单文件限制为 10 MB。', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            dom.markdownInput.value = String(reader.result || '');
            state.currentFileName = file.name;
            state.dirty = false;
            updateStats();
            updateSaveStatus();
            renderPreview({ immediate: true, force: true });
            saveAutosave();
            toast('文件已打开', `${file.name} · ${formatBytes(file.size)}`, 'success');
        };
        reader.onerror = () => toast('读取失败', '浏览器无法读取该文件。', 'error');
        reader.readAsText(file, 'UTF-8');
    }

    function formatBytes(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    function bindDragAndDrop() {
        const enter = (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth += 1;
            dom.dropOverlay.classList.add('visible');
        };
        const over = (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
        };
        const leave = (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth = Math.max(0, state.dragDepth - 1);
            if (!state.dragDepth) dom.dropOverlay.classList.remove('visible');
        };
        const drop = (event) => {
            if (!hasFiles(event)) return;
            event.preventDefault();
            state.dragDepth = 0;
            dom.dropOverlay.classList.remove('visible');
            const file = event.dataTransfer.files && event.dataTransfer.files[0];
            if (file) loadFile(file);
        };
        document.addEventListener('dragenter', enter);
        document.addEventListener('dragover', over);
        document.addEventListener('dragleave', leave);
        document.addEventListener('drop', drop);
    }

    function hasFiles(event) {
        return event.dataTransfer && Array.from(event.dataTransfer.types || []).includes('Files');
    }

    function saveMarkdownFile() {
        const content = dom.markdownInput.value;
        if (!content.trim()) {
            toast('没有可保存的内容', '', 'warning');
            return;
        }
        const name = ensureExtension(sanitizeFileName(state.currentFileName || extractTitle(content) || '未命名'), '.md');
        downloadBlob(new Blob([content], { type: 'text/markdown;charset=utf-8' }), name);
        state.currentFileName = name;
        state.dirty = false;
        dom.saveDot.classList.remove('dirty');
        updateSaveStatus();
        toast('Markdown 已下载', name, 'success');
    }

    function downloadBlob(blob, fileName) {
        if (typeof window.saveAs === 'function') {
            window.saveAs(blob, fileName);
            return;
        }
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    function sanitizeFileName(value) {
        const cleaned = String(value || '')
            .replace(/\.(md|markdown|txt|docx)$/i, '')
            .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
        return cleaned || '未命名';
    }

    function ensureExtension(value, extension) {
        const base = String(value || '');
        return base.toLowerCase().endsWith(extension.toLowerCase()) ? base : `${base}${extension}`;
    }

    function extractTitle(markdown) {
        const heading = String(markdown || '').match(/^#\s+(.+)$/m);
        if (heading) return heading[1].replace(/[*_`~]/g, '').trim();
        return sanitizeFileName(state.currentFileName || '未命名');
    }

    function bindViewSwitch() {
        queryAll('#viewSwitch [data-view]').forEach((button) => {
            button.addEventListener('click', () => setView(button.dataset.view));
        });
    }

    function setView(view) {
        if (!['editor', 'split', 'preview'].includes(view)) return;
        dom.workspace.dataset.view = view;
        queryAll('#viewSwitch [data-view]').forEach((button) => {
            button.classList.toggle('active', button.dataset.view === view);
        });
        if (view === 'preview') renderPreview({ immediate: true, force: true });
    }

    function bindSplitter() {
        dom.splitter.addEventListener('pointerdown', (event) => {
            event.preventDefault();
            const rect = dom.workspace.getBoundingClientRect();
            const mobile = window.innerWidth <= 820;
            state.splitterDrag = { pointerId: event.pointerId, rect, mobile };
            dom.splitter.setPointerCapture(event.pointerId);
            dom.splitter.classList.add('dragging');
        });
        dom.splitter.addEventListener('pointermove', (event) => {
            if (!state.splitterDrag || state.splitterDrag.pointerId !== event.pointerId) return;
            const { rect, mobile } = state.splitterDrag;
            if (mobile) {
                const percent = clamp(((event.clientY - rect.top) / rect.height) * 100, 28, 72);
                dom.workspace.style.gridTemplateRows = `${percent}% 9px minmax(300px, 1fr)`;
                localStorage.setItem(STORAGE.split, JSON.stringify({ mobilePercent: percent }));
            } else {
                const percent = clamp(((event.clientX - rect.left) / rect.width) * 100, 24, 76);
                document.documentElement.style.setProperty('--editor-width', `${percent}%`);
                localStorage.setItem(STORAGE.split, JSON.stringify({ desktopPercent: percent }));
            }
        });
        const finish = (event) => {
            if (!state.splitterDrag) return;
            if (event && state.splitterDrag.pointerId === event.pointerId && dom.splitter.hasPointerCapture(event.pointerId)) {
                dom.splitter.releasePointerCapture(event.pointerId);
            }
            state.splitterDrag = null;
            dom.splitter.classList.remove('dragging');
        };
        dom.splitter.addEventListener('pointerup', finish);
        dom.splitter.addEventListener('pointercancel', finish);
        dom.splitter.addEventListener('keydown', (event) => {
            const stored = safeJsonParse(localStorage.getItem(STORAGE.split), {});
            if (window.innerWidth <= 820) {
                if (!['ArrowUp', 'ArrowDown'].includes(event.key)) return;
                event.preventDefault();
                const current = Number(stored.mobilePercent || 50);
                const next = clamp(current + (event.key === 'ArrowDown' ? 2 : -2), 28, 72);
                dom.workspace.style.gridTemplateRows = `${next}% 9px minmax(300px, 1fr)`;
                localStorage.setItem(STORAGE.split, JSON.stringify({ ...stored, mobilePercent: next }));
            } else {
                if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
                event.preventDefault();
                const current = Number(stored.desktopPercent || 50);
                const next = clamp(current + (event.key === 'ArrowRight' ? 2 : -2), 24, 76);
                document.documentElement.style.setProperty('--editor-width', `${next}%`);
                localStorage.setItem(STORAGE.split, JSON.stringify({ ...stored, desktopPercent: next }));
            }
        });
    }

    function restoreSplitPosition() {
        const stored = safeJsonParse(localStorage.getItem(STORAGE.split), {});
        if (Number.isFinite(Number(stored.desktopPercent))) {
            document.documentElement.style.setProperty('--editor-width', `${clamp(Number(stored.desktopPercent), 24, 76)}%`);
        }
        if (window.innerWidth <= 820 && Number.isFinite(Number(stored.mobilePercent))) {
            const value = clamp(Number(stored.mobilePercent), 28, 72);
            dom.workspace.style.gridTemplateRows = `${value}% 9px minmax(300px, 1fr)`;
        }
    }

    function sanitizeSplitPosition() {
        if (window.innerWidth > 820) dom.workspace.style.gridTemplateRows = '';
        else restoreSplitPosition();
    }

    function getScrollRatio(element) {
        const max = element.scrollHeight - element.clientHeight;
        return max > 0 ? element.scrollTop / max : 0;
    }

    function setScrollRatio(element, ratio) {
        const max = element.scrollHeight - element.clientHeight;
        element.scrollTop = Math.max(0, max * clamp(Number(ratio) || 0, 0, 1));
    }

    function syncScrollFrom(source, target) {
        if (!state.settings.syncScroll || dom.workspace.dataset.view !== 'split' || state.syncLock) return;
        state.syncLock = true;
        setScrollRatio(target, getScrollRatio(source));
        requestAnimationFrame(() => { state.syncLock = false; });
    }

    async function copyRichText() {
        if (!dom.markdownInput.value.trim()) {
            toast('没有可复制的内容', '', 'warning');
            return;
        }
        renderPreview({ immediate: true, force: true });
        const clone = dom.preview.cloneNode(true);
        queryAll('[data-action]', clone).forEach((element) => element.remove());
        const html = clone.innerHTML;
        const plainClone = clone.cloneNode(true);
        queryAll('.math-node', plainClone).forEach((element) => {
            const latex = window.Md2WordMath.decodeMathSource(element);
            element.replaceWith(document.createTextNode(window.Md2WordMath.latexToPlainText(latex)));
        });
        const plain = plainClone.innerText || plainClone.textContent || '';

        try {
            if (navigator.clipboard && window.ClipboardItem) {
                const item = new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([plain], { type: 'text/plain' })
                });
                await navigator.clipboard.write([item]);
            } else {
                fallbackCopyRich(html);
            }
            toast('富文本已复制', '可直接粘贴到 Word、WPS 或邮件编辑器。', 'success');
        } catch (error) {
            console.warn('富文本复制失败，降级为纯文本:', error);
            try {
                await navigator.clipboard.writeText(plain);
                toast('已复制纯文本', '浏览器未允许写入富文本格式。', 'warning');
            } catch (fallbackError) {
                console.error(fallbackError);
                toast('复制失败', '请检查浏览器剪贴板权限。', 'error');
            }
        }
    }

    function fallbackCopyRich(html) {
        const holder = document.createElement('div');
        holder.contentEditable = 'true';
        holder.style.position = 'fixed';
        holder.style.left = '-9999px';
        holder.innerHTML = html;
        document.body.appendChild(holder);
        const range = document.createRange();
        range.selectNodeContents(holder);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        const ok = document.execCommand('copy');
        selection.removeAllRanges();
        holder.remove();
        if (!ok) throw new Error('execCommand(copy) failed');
    }

    function openDiagnostics() {
        const result = state.renderResult || {
            mathCount: 0, errors: [], warnings: [], looseDelimiterFixes: 0, segments: [], normalizedMarkdown: dom.markdownInput.value
        };
        const errors = result.errors || [];
        const warnings = result.warnings || [];
        const segments = result.segments || [];
        const items = [];

        errors.forEach((error) => {
            items.push(`
                <div class="diagnostic-item error">
                    <strong>公式 ${error.index + 1} 渲染失败</strong>
                    <div>${window.Md2WordMath.escapeHtml(error.message)}</div>
                    <code>${window.Md2WordMath.escapeHtml(error.content)}</code>
                </div>`);
        });
        warnings.forEach((warning) => {
            items.push(`
                <div class="diagnostic-item">
                    <strong>发现未闭合边界</strong>
                    <div>位置 ${warning.index + 1}，边界 ${window.Md2WordMath.escapeHtml(warning.delimiter)}</div>
                </div>`);
        });
        if (!errors.length && !warnings.length && segments.length) {
            segments.slice(0, 8).forEach((segment) => {
                items.push(`
                    <div class="diagnostic-item">
                        <strong>公式 ${segment.index + 1} · ${segment.display ? '独立公式' : '行内公式'}</strong>
                        <code>${window.Md2WordMath.escapeHtml(segment.content)}</code>
                    </div>`);
            });
        }
        if (!items.length) {
            items.push('<div class="diagnostic-item">当前文档未检测到公式。</div>');
        }

        dom.diagnosticsContent.innerHTML = `
            <div class="diagnostics-summary">
                <div class="diagnostic-stat"><strong>${result.mathCount || 0}</strong><span>识别到的公式</span></div>
                <div class="diagnostic-stat"><strong>${errors.length}</strong><span>渲染错误</span></div>
                <div class="diagnostic-stat"><strong>${result.looseDelimiterFixes || 0}</strong><span>临时修复边界</span></div>
            </div>
            <div class="diagnostics-list">${items.join('')}</div>`;
        dom.applyMathNormalization.hidden = !(result.looseDelimiterFixes && result.normalizedMarkdown !== dom.markdownInput.value);
        showDialog(dom.diagnosticsDialog);
    }

    function bindDiagnosticsDialog() {
        dom.applyMathNormalization.addEventListener('click', () => {
            if (!state.renderResult || !state.renderResult.normalizedMarkdown) return;
            dom.markdownInput.value = state.renderResult.normalizedMarkdown;
            state.dirty = true;
            onEditorInput();
            closeDialog(dom.diagnosticsDialog, 'normalized');
            toast('公式边界已标准化', '已把独立 [ … ] 改写为 \\[ … \\]。', 'success');
        });
    }

    function bindTableDialog() {
        byId('tableInput').addEventListener('input', updateTableOutput);
    }

    function updateTableOutput() {
        const input = byId('tableInput').value;
        state.tableMarkdown = convertTableInput(input);
        byId('tableOutput').textContent = state.tableMarkdown || '等待输入…';
    }

    function convertTableInput(input) {
        const text = String(input || '').trim();
        if (!text) return '';
        const lines = text.split(/\r?\n/).filter((line) => line.trim());
        if (!lines.length) return '';

        if (lines.length >= 2 && lines.some((line) => line.includes('|')) && /^\s*\|?\s*:?-{3,}/.test(lines[1])) {
            return lines.join('\n');
        }

        let rows;
        if (text.includes('\t')) {
            rows = lines.map((line) => line.split('\t'));
        } else if (lines.some((line) => line.includes(','))) {
            rows = lines.map(parseCsvLine);
        } else {
            rows = lines.map((line) => line.trim().split(/\s{2,}/));
        }

        const width = Math.max(...rows.map((row) => row.length));
        rows = rows.map((row) => Array.from({ length: width }, (_item, index) => (row[index] || '').trim()));
        if (!rows[0].some(Boolean)) rows[0] = rows[0].map((_cell, index) => `列 ${index + 1}`);
        const escapeCell = (cell) => String(cell).replace(/\|/g, '\\|').replace(/\r?\n/g, '<br>');
        const header = `| ${rows[0].map(escapeCell).join(' | ')} |`;
        const separator = `| ${rows[0].map(() => '---').join(' | ')} |`;
        const body = rows.slice(1).map((row) => `| ${row.map(escapeCell).join(' | ')} |`);
        return [header, separator, ...body].join('\n');
    }

    function parseCsvLine(line) {
        const cells = [];
        let current = '';
        let quoted = false;
        for (let i = 0; i < line.length; i += 1) {
            const char = line[i];
            if (char === '"') {
                if (quoted && line[i + 1] === '"') {
                    current += '"';
                    i += 1;
                } else {
                    quoted = !quoted;
                }
            } else if (char === ',' && !quoted) {
                cells.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        cells.push(current);
        return cells;
    }

    async function copyTableMarkdown() {
        if (!state.tableMarkdown) {
            toast('没有可复制的表格', '', 'warning');
            return;
        }
        try {
            await navigator.clipboard.writeText(state.tableMarkdown);
            toast('表格 Markdown 已复制', '', 'success');
        } catch (_error) {
            toast('复制失败', '请检查剪贴板权限。', 'error');
        }
    }

    function insertTableMarkdown() {
        if (!state.tableMarkdown) {
            toast('请先粘贴表格数据', '', 'warning');
            return;
        }
        const start = dom.markdownInput.selectionStart;
        const end = dom.markdownInput.selectionEnd;
        const insertion = `\n${state.tableMarkdown}\n`;
        dom.markdownInput.setRangeText(insertion, start, end, 'end');
        closeDialog(dom.tableDialog, 'inserted');
        dom.markdownInput.focus();
        onEditorInput();
    }

    function loadAIConfig() {
        const stored = safeJsonParse(localStorage.getItem(STORAGE.ai), null);
        state.aiConfig = {
            provider: stored && stored.provider ? stored.provider : 'custom',
            endpoint: stored && typeof stored.endpoint === 'string' ? stored.endpoint : '',
            model: stored && typeof stored.model === 'string' ? stored.model : '',
            key: stored && typeof stored.key === 'string' ? stored.key : '',
            mode: stored && stored.mode ? stored.mode : 'format',
            extraPrompt: stored && typeof stored.extraPrompt === 'string' ? stored.extraPrompt : ''
        };
    }

    function persistAIConfig() {
        localStorage.setItem(STORAGE.ai, JSON.stringify(state.aiConfig));
    }

    function bindAIDialog() {
        byId('aiProvider').addEventListener('change', applyAIPreset);
        byId('cancelAiButton').addEventListener('click', cancelAIRequest);
    }

    function openAI() {
        const input = dom.markdownInput;
        const selectionStart = input.selectionStart;
        const selectionEnd = input.selectionEnd;
        const hasSelection = selectionEnd > selectionStart;
        const start = hasSelection ? selectionStart : 0;
        const end = hasSelection ? selectionEnd : input.value.length;
        const original = input.value.slice(start, end);
        if (!original.trim()) {
            toast('没有可修复的内容', '请先输入 Markdown。', 'warning');
            return;
        }
        state.aiTarget = { start, end, original, selection: hasSelection };
        byId('aiScope').textContent = hasSelection
            ? `将处理选中的 ${original.length.toLocaleString()} 个字符`
            : `将处理整篇文档，共 ${original.length.toLocaleString()} 个字符`;
        populateAIForm();
        showDialog(dom.aiDialog);
    }

    function populateAIForm() {
        const config = state.aiConfig || {};
        byId('aiProvider').value = config.provider || 'custom';
        byId('aiEndpoint').value = config.endpoint || '';
        byId('aiModel').value = config.model || '';
        byId('aiKey').value = config.key || '';
        byId('aiMode').value = config.mode || 'format';
        byId('aiExtraPrompt').value = config.extraPrompt || '';
    }

    function applyAIPreset() {
        const provider = byId('aiProvider').value;
        const preset = AI_PRESETS[provider] || AI_PRESETS.custom;
        if (provider !== 'custom') {
            byId('aiEndpoint').value = preset.endpoint;
            byId('aiModel').value = preset.model;
        }
    }

    function collectAIConfig() {
        return {
            provider: byId('aiProvider').value,
            endpoint: byId('aiEndpoint').value.trim(),
            model: byId('aiModel').value.trim(),
            key: byId('aiKey').value.trim(),
            mode: byId('aiMode').value,
            extraPrompt: byId('aiExtraPrompt').value.trim()
        };
    }

    function buildAIPrompt(mode, extraPrompt) {
        const modeInstruction = {
            format: '只修复 Markdown 语法、段落结构、列表、表格和 LaTeX 公式边界，不改写事实内容。',
            polish: '修复 Markdown 与 LaTeX 格式，并在不改变事实和专业术语的前提下润色语言。',
            structure: '在保持事实、数据、代码和公式不变的前提下，重组层级、改善表达并修复格式。'
        }[mode] || '';
        return [
            '你是 Markdown 文档修复器。',
            modeInstruction,
            '必须完整保留代码块、链接、数字、化学名称、实验条件和公式含义。',
            '所有独立 LaTeX 公式统一使用 \\[ ... \\] 或 $$ ... $$，行内公式使用 \\( ... \\) 或 $...$。',
            '不要在最终结果外添加解释，不要使用 ```markdown 包裹，直接返回可用 Markdown。',
            extraPrompt ? `附加要求：${extraPrompt}` : ''
        ].filter(Boolean).join('\n');
    }

    async function runAIRepair() {
        if (state.aiAbortController) return;
        const config = collectAIConfig();
        const preset = AI_PRESETS[config.provider] || AI_PRESETS.custom;
        if (!config.endpoint || !config.model || !config.key) {
            toast('AI 配置不完整', '请填写接口地址、模型和 API Key。', 'warning');
            return;
        }
        if (!state.aiTarget || !state.aiTarget.original.trim()) {
            toast('没有处理目标', '请重新打开 AI 修复。', 'warning');
            return;
        }

        state.aiConfig = config;
        persistAIConfig();
        state.aiAbortController = new AbortController();
        setAIProgress(true);
        const systemPrompt = buildAIPrompt(config.mode, config.extraPrompt);

        try {
            let result;
            if (preset.type === 'gemini') {
                result = await callGemini(config, systemPrompt, state.aiTarget.original, state.aiAbortController.signal);
            } else {
                result = await callOpenAICompatible(config, systemPrompt, state.aiTarget.original, state.aiAbortController.signal);
            }
            result = cleanAIResult(result);
            if (!result.trim()) throw new Error('接口返回了空内容');
            byId('aiOriginal').value = state.aiTarget.original;
            byId('aiResult').value = result;
            closeDialog(dom.aiDialog, 'complete');
            showDialog(dom.aiResultDialog);
        } catch (error) {
            if (error.name === 'AbortError') {
                toast('AI 请求已取消', '', 'info');
            } else {
                console.error('AI 修复失败:', error);
                toast('AI 修复失败', friendlyAIError(error), 'error', 6500);
            }
        } finally {
            state.aiAbortController = null;
            setAIProgress(false);
        }
    }

    async function callOpenAICompatible(config, systemPrompt, source, signal) {
        const response = await fetch(config.endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${config.key}`
            },
            body: JSON.stringify({
                model: config.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: source }
                ],
                temperature: 0.2,
                stream: false
            }),
            signal
        });
        const data = await parseResponseBody(response);
        if (!response.ok) throw new Error(extractAPIError(data, response.status));
        const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
        if (Array.isArray(content)) return content.map((item) => item.text || '').join('');
        return String(content || '');
    }

    async function callGemini(config, systemPrompt, source, signal) {
        const endpoint = config.endpoint.replace(/\/$/, '');
        const url = endpoint.includes(':generateContent')
            ? appendQuery(endpoint, 'key', config.key)
            : `${endpoint}/models/${encodeURIComponent(config.model)}:generateContent?key=${encodeURIComponent(config.key)}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: 'user',
                    parts: [{ text: `${systemPrompt}\n\n以下是待处理 Markdown：\n\n${source}` }]
                }],
                generationConfig: { temperature: 0.2 }
            }),
            signal
        });
        const data = await parseResponseBody(response);
        if (!response.ok) throw new Error(extractAPIError(data, response.status));
        const parts = data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts;
        return Array.isArray(parts) ? parts.map((part) => part.text || '').join('') : '';
    }

    function appendQuery(url, key, value) {
        return `${url}${url.includes('?') ? '&' : '?'}${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    }

    async function parseResponseBody(response) {
        const text = await response.text();
        try {
            return JSON.parse(text);
        } catch (_error) {
            return { raw: text };
        }
    }

    function extractAPIError(data, status) {
        return (data && data.error && (data.error.message || data.error.msg))
            || (data && data.message)
            || (data && data.raw)
            || `HTTP ${status}`;
    }

    function cleanAIResult(value) {
        let text = String(value || '').trim();
        const fenced = text.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i);
        if (fenced) text = fenced[1].trim();
        return text;
    }

    function friendlyAIError(error) {
        const message = error && error.message ? error.message : String(error);
        if (/Failed to fetch|NetworkError|Load failed/i.test(message)) {
            return '浏览器无法访问该接口。常见原因是跨域限制、网络代理或接口地址错误。';
        }
        if (/401|unauthorized|invalid.*key/i.test(message)) return 'API Key 无效或没有该模型权限。';
        if (/429|rate.*limit|quota/i.test(message)) return '接口限流或额度不足，请稍后再试。';
        return message.slice(0, 320);
    }

    function setAIProgress(active) {
        byId('aiProgress').hidden = !active;
        byId('runAiButton').disabled = active;
        byId('cancelAiButton').hidden = !active;
    }

    function cancelAIRequest() {
        if (state.aiAbortController) state.aiAbortController.abort();
    }

    async function copyAIResult() {
        const value = byId('aiResult').value;
        if (!value) return;
        try {
            await navigator.clipboard.writeText(value);
            toast('AI 结果已复制', '', 'success');
        } catch (_error) {
            toast('复制失败', '请检查剪贴板权限。', 'error');
        }
    }

    function applyAIResult() {
        const replacement = byId('aiResult').value;
        if (!replacement || !state.aiTarget) return;
        const current = dom.markdownInput.value.slice(state.aiTarget.start, state.aiTarget.end);
        if (current !== state.aiTarget.original && !window.confirm('编辑器内容在 AI 请求后发生了变化，仍要覆盖原处理范围吗？')) return;
        dom.markdownInput.setRangeText(replacement, state.aiTarget.start, state.aiTarget.end, 'end');
        closeDialog(dom.aiResultDialog, 'applied');
        dom.markdownInput.focus();
        state.dirty = true;
        onEditorInput();
        toast('AI 结果已应用', '请在右侧预览中确认公式与结构。', 'success');
    }

    async function downloadWord() {
        const markdown = dom.markdownInput.value.trim();
        if (!markdown) {
            toast('没有可导出的内容', '', 'warning');
            return;
        }
        if (!window.docx) {
            toast('Word 导出依赖未加载', '请检查网络并刷新页面。', 'error');
            return;
        }

        showExportProgress(true, '正在生成 Word', '更新预览与公式…');
        try {
            renderPreview({ immediate: true, force: true });
            await nextFrame();
            showExportProgress(true, '正在生成 Word', '转换标题、段落、列表与表格…');
            const children = convertPreviewToDocxChildren(dom.preview);
            if (!children.length) throw new Error('没有可写入 Word 的内容');

            const title = extractTitle(markdown) || '未命名文档';
            const margin = cmToTwip(state.settings.wordMarginCm);
            const line = Math.round(240 * state.settings.wordLineSpacing);
            const fontSize = Math.round(state.settings.wordFontSize * 2);
            const doc = new window.docx.Document({
                creator: 'Markdown 转 Word · 个人版',
                title,
                description: '由浏览器本地生成',
                styles: {
                    default: {
                        document: {
                            run: {
                                font: state.settings.wordFont,
                                size: fontSize,
                                color: '172033'
                            },
                            paragraph: {
                                spacing: { line, after: 120 }
                            }
                        }
                    },
                    paragraphStyles: createWordParagraphStyles(fontSize, line)
                },
                sections: [{
                    properties: {
                        page: {
                            margin: { top: margin, right: margin, bottom: margin, left: margin }
                        }
                    },
                    children
                }]
            });

            showExportProgress(true, '正在生成 Word', '打包 DOCX 文件…');
            const blob = await window.docx.Packer.toBlob(doc);
            const fileName = `${sanitizeFileName(title)}-${new Date().toISOString().slice(0, 10)}.docx`;
            downloadBlob(blob, fileName);
            showExportProgress(false);
            toast('Word 已生成', `${fileName} · 公式已转为可编辑文本与上下标。`, 'success', 5200);
        } catch (error) {
            console.error('Word 导出失败:', error);
            showExportProgress(false);
            toast('Word 导出失败', error.message || String(error), 'error', 6500);
        }
    }

    function createWordParagraphStyles(baseSize, line) {
        const font = state.settings.wordFont;
        return [
            {
                id: 'Heading1', name: '标题 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 16, 32), bold: true, color: '111827' },
                paragraph: { spacing: { before: 280, after: 180, line } }
            },
            {
                id: 'Heading2', name: '标题 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 10, 28), bold: true, color: '172033' },
                paragraph: { spacing: { before: 240, after: 150, line } }
            },
            {
                id: 'Heading3', name: '标题 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 6, 24), bold: true, color: '172033' },
                paragraph: { spacing: { before: 200, after: 120, line } }
            },
            {
                id: 'Heading4', name: '标题 4', basedOn: 'Normal', next: 'Normal', quickFormat: true,
                run: { font, size: Math.max(baseSize + 3, 22), bold: true, color: '172033' },
                paragraph: { spacing: { before: 160, after: 100, line } }
            }
        ];
    }

    function convertPreviewToDocxChildren(previewRoot) {
        const output = [];
        Array.from(previewRoot.children).forEach((element) => {
            output.push(...convertBlockElement(element, 0));
        });
        return output;
    }

    function convertBlockElement(element, listLevel = 0) {
        const d = window.docx;
        if (!(element instanceof Element)) return [];
        if (element.classList.contains('preview-empty')) return [];
        const tag = element.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
            const level = Number(tag.slice(1));
            return [new d.Paragraph({
                children: collectDocxRuns(element),
                style: level <= 4 ? `Heading${level}` : undefined,
                heading: level <= 6 && d.HeadingLevel ? d.HeadingLevel[`HEADING_${level}`] : undefined,
                spacing: { before: level === 1 ? 260 : 180, after: 120 }
            })];
        }

        if (tag === 'p') {
            const runs = collectDocxRuns(element);
            if (!runs.length) return [];
            const onlyDisplayMath = isDisplayMathParagraph(element);
            return [new d.Paragraph({
                children: runs,
                alignment: onlyDisplayMath && d.AlignmentType ? d.AlignmentType.CENTER : undefined,
                spacing: { after: onlyDisplayMath ? 180 : 120 }
            })];
        }

        if (tag === 'ul' || tag === 'ol') {
            const ordered = tag === 'ol';
            const blocks = [];
            Array.from(element.children).filter((child) => child.tagName && child.tagName.toLowerCase() === 'li').forEach((li, index) => {
                const clone = li.cloneNode(true);
                queryAll(':scope > ul, :scope > ol', clone).forEach((nested) => nested.remove());
                const prefix = ordered ? `${index + 1}. ` : '• ';
                blocks.push(new d.Paragraph({
                    children: [new d.TextRun({ text: prefix, bold: ordered }), ...collectDocxRuns(clone)],
                    indent: { left: 600 + listLevel * 420, hanging: 300 },
                    spacing: { after: 70 }
                }));
                Array.from(li.children).filter((child) => ['ul', 'ol'].includes(child.tagName.toLowerCase())).forEach((nested) => {
                    blocks.push(...convertBlockElement(nested, listLevel + 1));
                });
            });
            return blocks;
        }

        if (tag === 'blockquote') {
            const blocks = [];
            const children = Array.from(element.children);
            if (children.length) {
                children.forEach((child) => {
                    const converted = convertBlockElement(child, listLevel);
                    converted.forEach((paragraph) => {
                        if (paragraph && paragraph.options) {
                            // docx internals are not stable; leave existing object untouched.
                        }
                        blocks.push(paragraph);
                    });
                });
            } else {
                blocks.push(new d.Paragraph({ children: collectDocxRuns(element) }));
            }
            return blocks.map((paragraph, index) => {
                if (!(paragraph instanceof d.Paragraph)) return paragraph;
                // Rebuild a predictable quote paragraph from visible text for consistent borders.
                if (index === 0) {
                    return new d.Paragraph({
                        children: collectDocxRuns(element),
                        indent: { left: 480 },
                        border: {
                            left: { color: '2563EB', size: 18, style: d.BorderStyle.SINGLE, space: 8 }
                        },
                        shading: { type: d.ShadingType.CLEAR, fill: 'EEF4FF' },
                        spacing: { before: 80, after: 120 }
                    });
                }
                return paragraph;
            }).slice(0, 1);
        }

        if (tag === 'pre') {
            const code = element.textContent.replace(/\n$/, '');
            return code.split('\n').map((line, index) => new d.Paragraph({
                children: [new d.TextRun({
                    text: line || ' ',
                    font: 'Consolas',
                    size: Math.max(18, Math.round(state.settings.wordFontSize * 2 - 2)),
                    color: '1F2937'
                })],
                shading: { type: d.ShadingType.CLEAR, fill: 'F3F4F6' },
                border: index === 0 ? {
                    top: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                } : index === code.split('\n').length - 1 ? {
                    bottom: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                } : {
                    left: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE },
                    right: { color: 'D1D5DB', size: 4, style: d.BorderStyle.SINGLE }
                },
                indent: { left: 240, right: 240 },
                spacing: { before: 0, after: index === code.split('\n').length - 1 ? 140 : 0 }
            }));
        }

        if (tag === 'table') {
            return [convertTableToDocx(element)];
        }

        if (tag === 'hr') {
            return [new d.Paragraph({
                text: '',
                border: { bottom: { color: 'C5CFDA', size: 6, style: d.BorderStyle.SINGLE, space: 8 } },
                spacing: { before: 120, after: 160 }
            })];
        }

        if (tag === 'img') {
            return [new d.Paragraph({ children: collectDocxRuns(element) })];
        }

        const nestedBlocks = [];
        Array.from(element.children).forEach((child) => nestedBlocks.push(...convertBlockElement(child, listLevel)));
        if (nestedBlocks.length) return nestedBlocks;
        const runs = collectDocxRuns(element);
        return runs.length ? [new d.Paragraph({ children: runs, spacing: { after: 120 } })] : [];
    }

    function isDisplayMathParagraph(element) {
        const meaningful = Array.from(element.childNodes).filter((node) => {
            if (node.nodeType === Node.TEXT_NODE) return Boolean(node.textContent.trim());
            return node.nodeType === Node.ELEMENT_NODE;
        });
        return meaningful.length === 1
            && meaningful[0].nodeType === Node.ELEMENT_NODE
            && meaningful[0].classList.contains('math-display');
    }

    function collectDocxRuns(root, inherited = {}) {
        const d = window.docx;
        const runs = [];

        function visit(node, style) {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                if (text) runs.push(new d.TextRun({ text, ...style }));
                return;
            }
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const element = node;

            if (element.classList.contains('math-node')) {
                const latex = window.Md2WordMath.decodeMathSource(element);
                const mathSegments = window.Md2WordMath.latexToWordSegments(latex);
                mathSegments.forEach((segment) => {
                    runs.push(new d.TextRun({
                        text: segment.text,
                        font: state.settings.wordFont,
                        bold: Boolean(segment.bold),
                        italics: Boolean(segment.italics),
                        subScript: Boolean(segment.subScript),
                        superScript: Boolean(segment.superScript)
                    }));
                });
                return;
            }

            const tag = element.tagName.toLowerCase();
            if (tag === 'br') {
                runs.push(new d.TextRun({ text: '', break: 1, ...style }));
                return;
            }
            if (tag === 'img') {
                const imageRun = createImageRun(element);
                if (imageRun) runs.push(imageRun);
                else {
                    const alt = element.getAttribute('alt') || '图片';
                    const src = element.getAttribute('src') || '';
                    runs.push(new d.TextRun({ text: `[图片：${alt}${src ? ` — ${src}` : ''}]`, italics: true, color: '667085' }));
                }
                return;
            }
            if (tag === 'a') {
                const text = element.textContent || element.getAttribute('href') || '';
                const href = element.getAttribute('href') || '';
                runs.push(new d.TextRun({ text: href && href !== text ? `${text} (${href})` : text, color: '2563EB', underline: {} }));
                return;
            }

            const nextStyle = { ...style };
            if (tag === 'strong' || tag === 'b') nextStyle.bold = true;
            if (tag === 'em' || tag === 'i') nextStyle.italics = true;
            if (tag === 'u') nextStyle.underline = {};
            if (tag === 's' || tag === 'del') nextStyle.strike = true;
            if (tag === 'code') {
                nextStyle.font = 'Consolas';
                nextStyle.highlight = 'lightGray';
            }
            Array.from(element.childNodes).forEach((child) => visit(child, nextStyle));
        }

        visit(root, inherited);
        return mergeAdjacentTextRuns(runs);
    }

    function mergeAdjacentTextRuns(runs) {
        // Keep docx objects as-is. The function is a future extension point and
        // intentionally does not inspect private docx internals.
        return runs;
    }

    function createImageRun(element) {
        const d = window.docx;
        if (!d.ImageRun) return null;
        const src = element.getAttribute('src') || '';
        const match = src.match(/^data:image\/(png|jpe?g|gif);base64,(.+)$/i);
        if (!match) return null;
        try {
            const binary = atob(match[2]);
            const bytes = new Uint8Array(binary.length);
            for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
            const width = clamp(Number(element.getAttribute('width') || element.naturalWidth || 520), 40, 560);
            const naturalWidth = Number(element.naturalWidth || width);
            const naturalHeight = Number(element.naturalHeight || width * 0.65);
            const height = Math.max(30, Math.round(width * (naturalHeight / Math.max(1, naturalWidth))));
            return new d.ImageRun({ data: bytes, transformation: { width, height } });
        } catch (_error) {
            return null;
        }
    }

    function convertTableToDocx(tableElement) {
        const d = window.docx;
        const rows = Array.from(tableElement.querySelectorAll('tr'));
        const docRows = rows.map((row, rowIndex) => {
            const cells = Array.from(row.children).filter((cell) => ['td', 'th'].includes(cell.tagName.toLowerCase()));
            return new d.TableRow({
                children: cells.map((cell) => {
                    const header = cell.tagName.toLowerCase() === 'th' || rowIndex === 0;
                    return new d.TableCell({
                        children: [new d.Paragraph({
                            children: collectDocxRuns(cell, header ? { bold: true, color: '1D4ED8' } : {}),
                            spacing: { after: 0 }
                        })],
                        shading: header ? { type: d.ShadingType.CLEAR, fill: 'EAF1FF' } : undefined,
                        margins: { top: 100, bottom: 100, left: 110, right: 110 }
                    });
                })
            });
        });
        return new d.Table({
            rows: docRows,
            width: { size: 100, type: d.WidthType.PERCENTAGE },
            borders: {
                top: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                bottom: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                left: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                right: { style: d.BorderStyle.SINGLE, size: 4, color: 'C5CFDA' },
                insideHorizontal: { style: d.BorderStyle.SINGLE, size: 3, color: 'DBE2EA' },
                insideVertical: { style: d.BorderStyle.SINGLE, size: 3, color: 'DBE2EA' }
            }
        });
    }

    function cmToTwip(cm) {
        return Math.round(Number(cm || 2.54) * 566.929);
    }

    function showExportProgress(visible, title = '', text = '') {
        dom.exportProgress.hidden = !visible;
        if (title) dom.exportProgressTitle.textContent = title;
        if (text) dom.exportProgressText.textContent = text;
    }

    function toast(title, message = '', type = 'info', duration = 3600) {
        const icons = { success: '✓', error: '!', warning: '!', info: 'i' };
        const element = document.createElement('div');
        element.className = `toast toast-${type}`;
        element.innerHTML = `
            <span class="toast-icon" aria-hidden="true">${icons[type] || icons.info}</span>
            <div class="toast-content">
                <div class="toast-title"></div>
                ${message ? '<div class="toast-message"></div>' : ''}
            </div>
            <button type="button" class="toast-close" aria-label="关闭">×</button>`;
        element.querySelector('.toast-title').textContent = title;
        const messageElement = element.querySelector('.toast-message');
        if (messageElement) messageElement.textContent = message;
        const close = () => {
            element.classList.remove('visible');
            window.setTimeout(() => element.remove(), 190);
        };
        element.querySelector('.toast-close').addEventListener('click', close);
        dom.toastRegion.appendChild(element);
        requestAnimationFrame(() => element.classList.add('visible'));
        window.setTimeout(close, duration);
    }

    window.addEventListener('DOMContentLoaded', initialize, { once: true });

    // Small, explicit debug surface for local regression checks.
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        window.__MD2WORD__ = {
            renderPreview,
            convertTableInput,
            convertPreviewToDocxChildren,
            getState: () => ({ ...state })
        };
    }
})();
