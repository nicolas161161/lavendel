"""Minimaler xlsx-Leser ohne Zusatzmodule (zipfile + xml)."""
import re
import zipfile
import xml.etree.ElementTree as ET

NS = {'m': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}


def col_index(ref):
    letters = re.match(r'[A-Z]+', ref).group(0)
    n = 0
    for ch in letters:
        n = n * 26 + ord(ch) - 64
    return n - 1


def read_rows(path, sheet_no=1):
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        root = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in root.findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter('{%s}t' % NS['m'])))
    root = ET.fromstring(z.read(f'xl/worksheets/sheet{sheet_no}.xml'))
    rows = []
    for row in root.iter('{%s}row' % NS['m']):
        cells = {}
        for c in row.findall('m:c', NS):
            v = c.find('m:v', NS)
            t = c.get('t')
            if t == 'inlineStr':
                val = ''.join(x.text or '' for x in c.iter('{%s}t' % NS['m']))
            elif v is None:
                continue
            elif t == 's':
                val = shared[int(v.text)]
            else:
                val = v.text
            cells[col_index(c.get('r'))] = val
        if cells:
            rows.append([cells.get(i, '') for i in range(max(cells) + 1)])
    return rows


def sheet_names(path):
    z = zipfile.ZipFile(path)
    root = ET.fromstring(z.read('xl/workbook.xml'))
    return [s.get('name') for s in root.iter('{%s}sheet' % NS['m'])]
