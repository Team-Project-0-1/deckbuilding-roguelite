module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
  env: {
    browser: true,
    es2022: true,
    node: true
  },
  ignorePatterns: ['dist', 'node_modules'],
  overrides: [
    {
      files: ['packages/core/**/*.ts'],
      rules: {
        'no-restricted-properties': [
          'error',
          {
            object: 'Math',
            property: 'random',
            message: 'core는 시드 RNG만 사용'
          },
          {
            object: 'Date',
            property: 'now',
            message: 'core는 시드 RNG만 사용'
          }
        ],
        'no-restricted-imports': [
          'error',
          {
            paths: ['react', 'react-dom', 'vite']
          }
        ]
      }
    }
  ]
};
