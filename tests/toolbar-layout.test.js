'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const toolbarCss = fs.readFileSync(path.join(root, 'css', 'toolbar.css'), 'utf8');

function positionOf(fragment) {
    const index = html.indexOf(fragment);
    assert.notEqual(index, -1, `missing ${fragment}`);
    return index;
}

test('v5.2.2 loads cache-busted toolbar, experience and hero stylesheets', () => {
    assert.match(html, /css\/app\.css\?v=5\.2\.2/);
    assert.match(html, /css\/toolbar\.css\?v=5\.2\.2/);
    assert.match(html, /css\/experience\.css\?v=5\.2\.2/);
    assert.match(html, /css\/hero\.css\?v=5\.2\.2/);
    assert.match(html, /class="quick-toolbar" data-layout="command-deck"/);
});

test('toolbar keeps a full-width document row above a full-width edit row', () => {
    assert.match(html, /class="toolbar-main-row"/);
    assert.match(html, /class="toolbar-edit-row mobile-hide"/);
    assert.ok(positionOf('class="toolbar-main-row"') < positionOf('class="toolbar-edit-row mobile-hide"'));
    assert.match(toolbarCss, /\.quick-toolbar\[data-layout="command-deck"\]\s*\{[\s\S]*?display:\s*block\s*!important;/);
    assert.match(toolbarCss, /\.toolbar-main-row,[\s\S]*?\.toolbar-edit-row\s*\{[\s\S]*?width:\s*100%\s*!important;/);
    assert.match(toolbarCss, /\.toolbar-main-row\s*\{[\s\S]*?display:\s*grid\s*!important;/);
    assert.match(toolbarCss, /\.toolbar-edit-row\s*\{[\s\S]*?display:\s*flex\s*!important;/);
});

test('document lane uses named grid areas and Word remains the only primary action', () => {
    const file = positionOf('class="toolbar-section toolbar-file"');
    const name = positionOf('class="document-name-field mobile-hide"');
    const view = positionOf('class="toolbar-section toolbar-view"');
    const output = positionOf('class="toolbar-section toolbar-output"');
    assert.ok(file < name && name < view && view < output);
    assert.match(toolbarCss, /grid-template-areas:\s*"file name view output"/);
    const primary = [...html.matchAll(/<button\b[^>]*class="[^"]*\bprimary-button\b[^"]*"[^>]*>/g)];
    assert.equal(primary.length, 1);
    assert.match(primary[0][0], /id="downloadWordButton"/);
});

test('nested cards are flattened into a single command surface with clear separators', () => {
    assert.match(toolbarCss, /\.toolbar-section\s*\{[\s\S]*?border:\s*0\s*!important;[\s\S]*?background:\s*transparent\s*!important;/);
    assert.match(toolbarCss, /\.toolbar-file\s*\{[\s\S]*?border-right:/);
    assert.match(toolbarCss, /\.toolbar-view\s*\{[\s\S]*?border-left:[\s\S]*?border-right:/);
    assert.match(toolbarCss, /\.toolbar-output\s*\{[\s\S]*?position:\s*static\s*!important;/);
});

test('document name is visually promoted and editing tools retain practical targets', () => {
    assert.match(toolbarCss, /\.document-name-field::before\s*\{[\s\S]*?content:\s*"📄"/);
    assert.match(toolbarCss, /\.document-name-field\s*\{[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto/);
    assert.match(toolbarCss, /\.format-button\s*\{[\s\S]*?width:\s*34px;[\s\S]*?height:\s*34px;/);
    assert.match(toolbarCss, /#downloadWordButton\s*\{[\s\S]*?min-width:\s*138px;[\s\S]*?min-height:\s*42px;/);
});

test('medium widths use More while the menu includes hidden file and output actions', () => {
    assert.match(html, /id="toolbarMoreMenu"/);
    for (const action of ['save-markdown', 'copy-rich', 'open-table', 'run-ai-direct', 'clear-document']) {
        assert.match(html, new RegExp(`toolbar-more-popover[\\s\\S]*data-action="${action}"`));
    }
    assert.match(toolbarCss, /@media \(max-width:\s*1320px\) and \(min-width:\s*1181px\)[\s\S]*?\.toolbar-more\s*\{\s*display:\s*block;/);
    assert.match(toolbarCss, /\.toolbar-more:not\(\[open\]\) \.toolbar-more-popover\s*\{\s*display:\s*none\s*!important;/);
});

test('tablet layout is a balanced two-column command grid, not a vertical left stack', () => {
    assert.match(toolbarCss, /@media \(max-width:\s*900px\) and \(min-width:\s*681px\)[\s\S]*?grid-template-areas:\s*\n\s*"file output"\s*\n\s*"name view";/);
    assert.match(toolbarCss, /@media \(max-width:\s*900px\) and \(min-width:\s*681px\)[\s\S]*?\.toolbar-output\s*\{[\s\S]*?justify-self:\s*end;/);
    assert.match(toolbarCss, /@media \(max-width:\s*900px\) and \(min-width:\s*681px\)[\s\S]*?\.toolbar-view\s*\{[\s\S]*?justify-self:\s*end;/);
});

test('mobile keeps exactly Open, view switch and Word in one row', () => {
    assert.match(toolbarCss, /@media \(max-width:\s*680px\)[\s\S]*?grid-template-areas:\s*"file view output";/);
    assert.match(toolbarCss, /@media \(max-width:\s*680px\)[\s\S]*?\.toolbar-edit-row,[\s\S]*?display:\s*none\s*!important;/);
    assert.match(toolbarCss, /@media \(max-width:\s*680px\)[\s\S]*?grid-template-columns:\s*auto minmax\(0, 1fr\) auto;/);
});
