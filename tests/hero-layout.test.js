'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const heroCss = fs.readFileSync(path.join(root, 'css', 'hero.css'), 'utf8');

function extractHero() {
    const match = html.match(/<header class="hero-header hero-header-premium">([\s\S]*?)<\/header>/);
    assert.ok(match, 'premium hero header is missing');
    return match[0];
}

test('premium hero uses a concise typographic product lock-up', () => {
    const hero = extractHero();
    assert.match(hero, /class="hero-brand-emblem"/);
    assert.match(hero, /class="hero-title-main">Markdown 转 Word<\/span>/);
    assert.match(hero, /class="hero-title-badge"/);
    assert.match(hero, /AI 智能工作台/);
    assert.match(hero, /aria-label="AI 智能 Markdown 转 Word 转换器"/);
    assert.doesNotMatch(hero, /🤖/);
});

test('hero keeps supporting copy compact and task-focused', () => {
    const hero = extractHero();
    for (const copy of ['公式优先解析', '导出前检查', '源码精准定位', 'Fusion v5.3']) {
        assert.ok(hero.includes(copy), `missing ${copy}`);
    }
    assert.match(hero, /让公式、表格与长文结构从实时预览到 Word 交付始终清晰、可靠、可编辑。/);
});

test('account identity and actions are grouped into a cohesive dock', () => {
    const hero = extractHero();
    assert.match(hero, /class="current-user-chip" id="userStatus"/);
    assert.match(hero, /class="user-chip-eyebrow">当前身份<\/span>/);
    assert.match(hero, /class="user-chip-online"/);
    assert.match(hero, /class="hero-action-dock"/);
    for (const id of ['commandButton', 'focusModeButton', 'themeButton', 'settingsButton']) {
        assert.match(hero, new RegExp(`id="${id}"`));
    }
    assert.match(hero, /data-action="logout"/);
});

test('hero stylesheet creates controlled typography instead of oversized wrapping', () => {
    assert.match(heroCss, /grid-template-columns:\s*minmax\(560px, 1fr\) minmax\(500px, auto\)/);
    assert.match(heroCss, /\.hero-title-main\s*\{[\s\S]*?font-size:\s*clamp\(40px, 3\.25vw, 57px\)/);
    assert.match(heroCss, /\.hero-title-main\s*\{[\s\S]*?white-space:\s*nowrap/);
    assert.match(heroCss, /\.hero-header-premium \.hero-copy h1\s*\{[\s\S]*?flex-wrap:\s*wrap/);
});

test('visual hierarchy uses one emblem, one main title and one quiet badge', () => {
    assert.match(heroCss, /\.hero-brand-emblem\s*\{[\s\S]*?width:\s*64px;[\s\S]*?height:\s*64px;/);
    assert.match(heroCss, /\.hero-title-badge\s*\{[\s\S]*?border-radius:\s*999px;/);
    assert.match(heroCss, /\.hero-capability-rail > span \+ span::before/);
    assert.match(heroCss, /\.hero-action-dock\s*\{[\s\S]*?border-radius:\s*17px;/);
});

test('responsive hero stacks before controls become cramped and stays compact on mobile', () => {
    assert.match(heroCss, /@media \(max-width:\s*1120px\)[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\)/);
    assert.match(heroCss, /@media \(max-width:\s*1120px\)[\s\S]*?flex-direction:\s*row/);
    assert.match(heroCss, /@media \(max-width:\s*680px\)[\s\S]*?\.hero-capability-rail\s*\{[\s\S]*?display:\s*none/);
    assert.match(heroCss, /@media \(max-width:\s*680px\)[\s\S]*?\.hero-header-premium \.hero-utilities\s*\{[\s\S]*?display:\s*none !important/);
});
