import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

export default defineConfig([globalIgnores([
    "**/node_modules/**/*",
    "**/*.min.js",
    "assets/**/*",
    "client/libs/**/*",
    "coverage/**/*",
    "repo/**/*",
    "data/**/*",
    "logs/**/*",
]), {
    languageOptions: {
        globals: {
            ...globals.node,
            ...globals.jest,
            document: false,
            navigator: false,
            window: false,
        },

        ecmaVersion: 2017,
        sourceType: "commonjs",

        parserOptions: {
            parser: "babel-eslint",
            allowImportExportEverywhere: true,
        },
        env: {
          browser: true,
          es2021: true,
          node: true
        },
        extends: [
          'eslint:recommended',
          'plugin:vue/vue3-essential'
        ],
        overrides: [
          {
            env: {
              node: true
            },
            files: [
              '.eslintrc.{js,cjs}'
            ],
            parserOptions: {
              sourceType: 'script'
            }
          }
        ],
        plugins: [
          'vue'
        ],
        rules: {
          "yoda": "warn",
          eqeqeq: [ "warn", "smart" ],
          "linebreak-style": [ "warn", "unix" ],
          "no-unused-vars": [ "warn", {
            "args": "none"
          }],
          indent: [
            "warn",
            2,
            {
              ignoredNodes: [ "TemplateLiteral" ],
              SwitchCase: 1,
            },
          ],
          quotes: [ "off", "double" ],
          semi: "warn",
          "no-multi-spaces": [ "warn", {
            ignoreEOLComments: true,
          }],
          "array-bracket-spacing": [ "warn", "always", {
            "singleValue": true,
            "objectsInArrays": false,
            "arraysInArrays": false
          }],
          "space-before-function-paren": [ "warn", {
            "anonymous": "always",
            "named": "never",
            "asyncArrow": "always"
          }],
          "curly": "warn",
          "object-curly-spacing": [ "warn", "always" ],
          "object-curly-newline": "off",
          "object-property-newline": "warn",
          "comma-spacing": "warn",
          "brace-style": "warn",
          "no-var": "warn",
          "key-spacing": "warn",
          "keyword-spacing": "warn",
          "space-infix-ops": "warn",
          "arrow-spacing": "warn",
          "no-trailing-spaces": "warn",
          "no-constant-condition": [ "warn", {
            "checkLoops": true,
          }],
          "space-before-blocks": "warn",
          //'no-console': 'warn',
          "no-extra-boolean-cast": "off",
          "no-multiple-empty-lines": [ "warn", {
            "max": 1,
            "maxBOF": 0,
          }],
          "lines-between-class-members": [ "warn", "always", {
            exceptAfterSingleLine: true,
          }],
          "no-unneeded-ternary": "warn",
          "array-bracket-newline": [ "warn", "consistent" ],
          "eol-last": [ "warn", "always" ],
          //'prefer-template': 'error',
          "comma-dangle": [ "warn", "only-multiline" ],
          "no-empty": [ "warn", {
            "allowEmptyCatch": true
          }],
          "no-control-regex": "off",
          "one-var": [ "warn", "never" ],
          "max-statements-per-line": [ "warn", { "max": 1 }]
        }
    },
  }
]);
