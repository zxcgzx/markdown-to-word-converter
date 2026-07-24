'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(root, 'css', 'app.css'), 'utf8');
const marker = '/* Fusion v5.1.1：双层工具栏';
const toolbarCss = css.slice(css.lastIndexOf(marker));

function positionOf(fragment) {
    const index = html.indexOf(fragment);
    assert.notEqual(index, -1, `missing ${fragment}`);
    return index;
}

test('toolbar uses a document row plus a separate editing row', () => {
    assert.match(html, /class="toolbar-main-row"/);
    assert.match(html, /class="toolbar-edit-row mobile-hide"/);
    assert.ok(positionOf('class="toolbar-main-row"') < positionOf('class="toolbar-edit-row mobile-hide"'));
    assert.match(toolbarCss, /\.quick-toolbar\s*\{[\s\S]*?grid-template-rows:\s*auto auto;/);
});

test('document-level controls remain ordered and Word stays the only primary action', () => {
    const file = positionOf('class="toolbar-section toolbar-file"');
    const name = positionOf('class="document-name-field mobile-hide"');
    const view = positionOf('class="toolbar-section toolbar-view"');
    const output = positionOf('class="toolbar-section toolbar-output"');
    assert.ok(file < name && name < view && view < output);
    const primary = [...html.matchAll(/<button\b[^>]*class="[^"]*\bprimary-button\b[^"]*"[^>]*>/g)];
    assert.equal(primary.length, 1);
    assert.match(primary[0][0], /id="downloadWordButton"/);
});

test('toolbar no longer relies on horizontal scrolling or a sticky output overlay', () => {
    assert.match(toolbarCss, /\.quick-toolbar\s*\{[\s\S]*?overflow:\s*visible;/);
    assert.match(toolbarCss, /\.toolbar-main-row \.toolbar-output\s*\{[\s\S]*?position:\s*static;/);
    assert.match(toolbarCss, /box-shadow:\s*none;/);
    assert.doesNotMatch(toolbarCss, /\.toolbar-main-row \.toolbar-output\s*\{[^}]*position:\s*sticky;/s);
});

test('editing buttons have practical pointer targets and destructive clear is separated', () => {
    assert.match(toolbarCss, /\.toolbar-edit-row \.format-button\s*\{[\s\S]*?min-width:\s*34px;[\s\S]*?height:\s*36px;/);
    assert.match(toolbarCss, /\.toolbar-clear-button\s*\{[\s\S]*?margin-left:\s*auto;/);
    assert.match(html, /class="tool-button toolbar-clear-button compact-toolbar-hide"[^>]*data-action="clear-document"/);
});

test('closed More menu leaves layout and medium-width menu remains reachable', () => {
    assert.match(toolbarCss, /\.toolbar-more:not\(\[open\]\) \.toolbar-more-popover\s*\{\s*display:\s*none\s*!important;/);
    assert.match(toolbarCss, /\.toolbar-more-popover\s*\{[\s\S]*?max-height:\s*min\(320px,[\s\S]*?overflow-y:\s*auto;/);
    assert.match(toolbarCss, /@media \(min-width:\s*681px\) and \(max-width:\s*1180px\)[\s\S]*?\.toolbar-more-popover\s*\{[\s\S]*?right:\s*auto;[\s\S]*?left:\s*0;/);
});

test('tablet and mobile layouts keep only controls that fit without overlap', () => {
    assert.match(toolbarCss, /@media \(min-width:\s*681px\) and \(max-width:\s*900px\)[\s\S]*?\.toolbar-file \[data-action="new-document"\]\s*\{\s*display:\s*none\s*!important;/);
    assert.match(toolbarCss, /@media \(max-width:\s*680px\)[\s\S]*?\.toolbar-main-row\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/);
    assert.match(toolbarCss, /@media \(max-width:\s*680px\)[\s\S]*?\.toolbar-edit-row\s*\{\s*display:\s*none\s*!important;/);
});
