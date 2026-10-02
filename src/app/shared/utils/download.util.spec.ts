import { createCsv, createExcelXml } from './download.util';

describe('Report exports', () => {
  it('preserves Arabic, quotes, commas and multiline values in CSV', () => {
    expect(createCsv([['صنف, جديد', 'a"b', 'line1\nline2']]))
      .toBe('\uFEFF"صنف, جديد","a""b","line1\nline2"');
  });
  it('neutralizes spreadsheet formulas in CSV', () => {
    expect(createCsv([['=1+1', '+SUM(A1)', '@SUM(A1)']])).toContain('"\'=1+1"');
  });
  it('exports well-formed Excel XML with numeric cells and escaped text', () => {
    const xml = new DOMParser().parseFromString(createExcelXml([['A&B <item>', 42, '=1+1']]), 'application/xml');
    expect(xml.getElementsByTagName('parsererror').length).toBe(0);
    const data = xml.getElementsByTagName('Data');
    expect(data[0].textContent).toBe('A&B <item>');
    expect(data[1].getAttribute('ss:Type')).toBe('Number');
    expect(data[2].getAttribute('ss:Type')).toBe('String');
    expect(data[2].textContent).toBe('=1+1');
  });
});
