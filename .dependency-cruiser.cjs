module.exports = {
  forbidden: [
    {
      name: 'schema-imports-nothing-local',
      severity: 'error',
      from: { path: '^schema/' },
      to: { path: '^(schema|domain|src|scripts)/' },
    },
    {
      name: 'domain-only-imports-schema',
      severity: 'error',
      from: { path: '^domain/' },
      to: { path: '^(src|scripts)/' },
    },
    {
      name: 'domain-is-pure',
      severity: 'error',
      from: { path: '^domain/' },
      to: { dependencyTypes: ['npm'], pathNot: 'node_modules/(zod)/' },
    },
    {
      name: 'domain-no-node-builtins',
      severity: 'error',
      from: { path: '^domain/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'scripts-not-src',
      severity: 'error',
      from: { path: '^scripts/' },
      to: { path: '^src/' },
    },
    {
      name: 'src-not-scripts',
      severity: 'error',
      from: { path: '^src/' },
      to: { path: '^scripts/' },
    },
    {
      name: 'option-builders-type-only-echarts',
      severity: 'error',
      from: { path: 'Option\\.ts$' },
      to: { path: 'node_modules/echarts' },
    },
  ],
  options: {
    // Test files import vitest and import the module under test. Without this exclusion,
    // `domain-is-pure` fails on `domain/*.test.ts` (vitest is an npm import) and
    // `schema-imports-nothing-local` fails on `schema/snapshot.test.ts`. Both would make
    // T07's and T10's "depcruise exits 0" acceptance criteria impossible.
    exclude: { path: '\\.test\\.tsx?$' },
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.app.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require'],
    },
    tsPreCompilationDeps: false,
  },
};
