// const DOMGlobals = ['window', 'document']
// const NodeGlobals = ['module', 'require']

// module.exports = {
//   parser: '@typescript-eslint/parser',
//   parserOptions: {
//     sourceType: 'module'
//   },
//   plugins: ["jest"],
//   rules: {
//     'no-debugger': 'error',
//     'no-unused-vars': [
//       'error',
//       // we are only using this rule to check for unused arguments since TS
//       // catches unused variables but not args.
//       { varsIgnorePattern: '.*', args: 'none' }
//     ],
//     // most of the codebase are expected to be env agnostic
//     'no-restricted-globals': ['error', ...DOMGlobals, ...NodeGlobals],
//     // since we target ES2015 for baseline support, we need to forbid object
//     // rest spread usage in destructure as it compiles into a verbose helper.
//     // TS now compiles assignment spread into Object.assign() calls so that
//     // is allowed.
//     'no-restricted-syntax': [
//       'error',
//       'ObjectPattern > RestElement',
//       'AwaitExpression'
//     ]
//   },
//   overrides: [
//     // tests, no restrictions (runs in Node / jest with jsdom)
//     {
//       files: ['**/__tests__/**', 'test-dts/**'],
//       rules: {
//         'no-restricted-globals': 'off',
//         'no-restricted-syntax': 'off',
//         'jest/no-disabled-tests': 'error',
//         'jest/no-focused-tests': 'error'
//       }
//     },
//     // shared, may be used in any env
//     {
//       files: ['packages/shared/**'],
//       rules: {
//         'no-restricted-globals': 'off'
//       }
//     },
//     // Packages targeting DOM
//     {
//       files: ['packages/{vue,vue-compat,runtime-dom}/**'],
//       rules: {
//         'no-restricted-globals': ['error', ...NodeGlobals]
//       }
//     },
//     // Packages targeting Node
//     {
//       files: [
//         'packages/{compiler-sfc,compiler-ssr,server-renderer,reactivity-transform}/**'
//       ],
//       rules: {
//         'no-restricted-globals': ['error', ...DOMGlobals],
//         'no-restricted-syntax': 'off'
//       }
//     },
//     // Private package, browser only + no syntax restrictions
//     {
//       files: ['packages/template-explorer/**', 'packages/sfc-playground/**'],
//       rules: {
//         'no-restricted-globals': ['error', ...NodeGlobals],
//         'no-restricted-syntax': 'off'
//       }
//     }
//   ]
// }

module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 12,
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-this-alias': 'off',
    '@typescript-eslint/no-non-null-assertion': 'off'
  },
  overrides: [
    {
      files: ['scripts/**', '**/*.js'],
      env: {
        es2021: true,
        node: true
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off'
      }
    }
  ]
}
