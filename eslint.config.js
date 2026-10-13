import tseslint from 'typescript-eslint';

// Слои и разрешённые зависимости — context/architecture/01-обзор/карта-системы.md
const LAYERS = ['core', 'layout', 'render', 'audio', 'platform', 'app'];
const ALLOWED = {
  core: [],
  layout: [],
  render: ['layout'],
  audio: [],
  platform: [],
};

const forbid = (layers) =>
  layers.flatMap((l) => [`**/${l}`, `**/${l}/**`, `../${l}`, `../${l}/**`]);

const layerRules = Object.entries(ALLOWED).map(([layer, allowed]) => ({
  files: [`packages/game/src/${layer}/**/*.ts`],
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: forbid(LAYERS.filter((l) => l !== layer && !allowed.includes(l))),
            message: `Слой «${layer}» не может импортировать этот слой (см. карту системы).`,
          },
        ],
      },
    ],
  },
}));

const noDom = ['window', 'document', 'navigator', 'localStorage', 'sessionStorage'].map((name) => ({
  name,
  message: 'Ядро не знает о браузере — получай это через интерфейсы Platform/SaveStore.',
}));

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'playwright-report/**', 'test-results/**'] },
  ...tseslint.configs.recommended,
  ...layerRules,
  {
    files: ['packages/game/src/core/**/*.ts', 'packages/content-schema/src/**/*.ts'],
    rules: {
      'no-restricted-globals': ['error', ...noDom],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Только сеяный PRNG из core.' },
        { object: 'Date', property: 'now', message: 'Время игры — только накопленный dt.' },
        { object: 'performance', property: 'now', message: 'Время игры — только накопленный dt.' },
      ],
    },
  },
  {
    files: ['packages/content-schema/src/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@nd/game', '**/game/**'], message: 'content-schema не зависит от игры.' }] }],
    },
  },
);
