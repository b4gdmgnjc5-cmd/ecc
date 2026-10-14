const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    {
        ignores: ['.opencode/dist/**', '.cursor/**', 'node_modules/**', '.venv/**', 'venv/**', 'coverage/**', 'workflows/**/*.workflow.*', '.claude/workflows/**']
    },
    {
        // Vendored third-party skills, kept as upstream ships them (see each .provenance.json)
        ignores: [
            '.claude/skills/onetake-videogen/**',
            '.claude/skills/gbro-collage-broll/**',
            '.claude/skills/claude-animation-base/kit/**',
            '.claude/skills/lemo-opuscar/**'
        ]
    },
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
                ...globals.es2022
            }
        },
        rules: {
            'no-unused-vars': ['error', {
                argsIgnorePattern: '^_',
                varsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            'no-undef': 'error',
            'eqeqeq': 'warn'
        }
    },
    {
        files: ['**/*.mjs'],
        languageOptions: {
            sourceType: 'module'
        }
    },
    {
        files: ['docker/context-profiles/complex-eval/**/recurring-incident/**/*.js'],
        languageOptions: {
            sourceType: 'module'
        }
    }
];
