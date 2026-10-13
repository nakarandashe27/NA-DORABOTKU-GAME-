// Охрана слоёв — риск 3 премортема архитектуры. Если этот тест упал, правило слоёв в eslint.config.js сломано.
import { ESLint } from 'eslint';
import { describe, expect, it } from 'vitest';

const eslint = new ESLint();

async function errors(file: string, code: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath: file });
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId ?? '');
}

describe('границы слоёв', () => {
  it('core не импортирует platform', async () => {
    expect(await errors('packages/game/src/core/x.ts', "import { p } from '../platform/telegram';\nexport const y = p;\n"))
      .toContain('no-restricted-imports');
  });

  it('core не трогает window и Math.random', async () => {
    const found = await errors('packages/game/src/core/x.ts', 'export const a = window.innerWidth + Math.random();\n');
    expect(found).toContain('no-restricted-globals');
    expect(found).toContain('no-restricted-properties');
  });

  it('render может импортировать layout', async () => {
    expect(await errors('packages/game/src/render/x.ts', "import { l } from '../layout/grid';\nexport const y = l;\n"))
      .not.toContain('no-restricted-imports');
  });

  it('app может импортировать всё', async () => {
    expect(await errors('packages/game/src/app/x.ts', "import { p } from '../platform/telegram';\nexport const y = p;\n"))
      .not.toContain('no-restricted-imports');
  });
});
