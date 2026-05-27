/**
 * @jest-environment node
 */

'use strict';

const fs = require('fs');
const path = require('path');

describe('overrides/src/pxt.d.ts', () => {
  const file = path.join(__dirname, '..', 'overrides', 'src', 'pxt.d.ts');
  let text;

  beforeAll(() => {
    text = fs.readFileSync(file, 'utf8');
  });

  test('declares the pxt global namespace', () => {
    expect(text).toMatch(/declare\s+global\s*{[\s\S]*namespace\s+pxt\s*{/);
  });

  test.each([
    ['appTarget', /let\s+appTarget\s*:\s*TargetBundle/],
    ['webConfig', /let\s+webConfig\s*:\s*WebConfig/],
    ['options', /let\s+options\s*:/],
    ['tickEvent', /function\s+tickEvent\s*\(/],
    ['targetConfigAsync', /function\s+targetConfigAsync\s*\(/],
    ['TargetBundle', /interface\s+TargetBundle\s*{/],
    ['WebConfig', /interface\s+WebConfig\s*{/],
    ['TargetConfig', /interface\s+TargetConfig\s*{/],
    ['Cloud.apiRoot', /namespace\s+Cloud\s*{[\s\S]*let\s+apiRoot/],
    ['BrowserUtils.isLocalHost', /namespace\s+BrowserUtils\s*{[\s\S]*isLocalHost/],
    ['Utils.escapeForRegex', /namespace\s+Utils\s*{[\s\S]*escapeForRegex/],
  ])('declares %s', (_label, pattern) => {
    expect(text).toMatch(pattern);
  });

  test('file ends with `export {};` to mark it as a module', () => {
    expect(text.trim()).toMatch(/export\s*{\s*}\s*;?\s*$/);
  });
});
