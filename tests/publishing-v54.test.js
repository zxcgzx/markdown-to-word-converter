'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const publishing = require('../js/publishing.js');

test('page geometry follows paper size, orientation and independent margins', () => {
    const portrait = publishing.pageGeometry({ wordPaperSize: 'a4', wordOrientation: 'portrait', wordMarginTopCm: 2, wordMarginRightCm: 1.5, wordMarginBottomCm: 2.5, wordMarginLeftCm: 3 });
    assert.equal(portrait.widthMm, 210);
    assert.equal(portrait.heightMm, 297);
    assert.ok(portrait.contentWidthPx < portrait.widthPx);
    assert.ok(portrait.contentHeightPx < portrait.heightPx);

    const landscape = publishing.pageGeometry({ wordPaperSize: 'letter', wordOrientation: 'landscape' });
    assert.equal(landscape.widthMm, 279.4);
    assert.equal(landscape.heightMm, 215.9);
});

test('DOCX page properties use twips and the requested orientation', () => {
    const props = publishing.getDocxPageProperties({ wordPaperSize: 'a4', wordOrientation: 'landscape', wordMarginTopCm: 2.54, wordMarginRightCm: 1.27, wordMarginBottomCm: 2.54, wordMarginLeftCm: 1.27 }, { PageOrientation: { LANDSCAPE: 'L', PORTRAIT: 'P' } });
    assert.equal(props.size.orientation, 'L');
    assert.equal(props.size.width, publishing.PAPER_SIZES.a4.heightTwip);
    assert.equal(props.margin.top, 1440);
    assert.equal(props.margin.right, 720);
});

test('long-document policy separates realtime, balanced and manual refresh modes', () => {
    assert.equal(publishing.getPerformancePolicy('auto', 5000).mode, 'realtime');
    assert.equal(publishing.getPerformancePolicy('auto', 50000).mode, 'balanced');
    assert.equal(publishing.getPerformancePolicy('manual', 5000).autoRender, false);
    assert.equal(publishing.getPerformancePolicy('balanced', 180000).delay, 950);
});

test('template catalog covers common writing and wide-table scenarios', () => {
    assert.equal(publishing.TEMPLATES.length, 6);
    for (const id of ['report', 'experiment', 'paper', 'meeting', 'sop', 'landscape-table']) {
        const template = publishing.templateById(id);
        assert.ok(template, `missing template ${id}`);
        assert.ok(template.markdown.startsWith('# '));
        assert.ok(template.suggestedName);
    }
    assert.equal(publishing.templateById('landscape-table').settings.wordOrientation, 'landscape');
    assert.match(publishing.PAGE_BREAK_HTML, /data-page-break="true"/);
});
