const { FlatCompat } = require("@eslint/eslintrc");
const globals = require("globals");

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

module.exports = [
  {
    ignores: [
      "eslint.config.js",
      "node_modules",
      "dist",
      "build",
      ".expo",
      "android",
      "ios",
      ".turbo",
      ".expo-shared",
    ],
  },
  ...compat.config({
    extends: ["expo"],
  }),
  // Enforce typography consistency: never import Text from react-native.
  // Use "@/components/Themed" Text instead (it supports variants + theme colors).
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          paths: [
            {
              name: "react-native",
              importNames: ["Text"],
              message:
                'Import Text from "@/components/Themed" to keep typography consistent.',
            },
          ],
        },
      ],
    },
  },
  // Allowed exceptions: Themed wrapper and global font setup.
  {
    files: ["components/Themed.tsx", "app/_layout.tsx", "components/ui/Button.tsx"],
    rules: {
      "no-restricted-imports": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.{js,jsx,ts,tsx}", "**/*.test.{js,jsx,ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.jest,
      },
    },
  },
];

