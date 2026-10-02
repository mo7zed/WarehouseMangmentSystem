import { applyDocumentLanguage } from './translate.initializer';
describe('Document direction', () => {
  afterEach(() => applyDocumentLanguage('en'));
  it('switches both root and body between RTL and LTR', () => {
    applyDocumentLanguage('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.body.dir).toBe('rtl');
    applyDocumentLanguage('en');
    expect(document.documentElement.dir).toBe('ltr');
    expect(document.body.dir).toBe('ltr');
  });
});
