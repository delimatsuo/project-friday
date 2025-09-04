/**
 * ESLint Configuration for Project Friday Cloud Functions
 */

module.exports = {
  root: true,
  env: {
    es6: true,
    node: true,
    jest: true,
  },
  extends: [
    "eslint:recommended",
    "google",
  ],
  parser: "@babel/eslint-parser",
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    requireConfigFile: false,
    babelOptions: {
      presets: ["@babel/preset-env"],
    },
  },
  rules: {
    // Adjust Google style guide rules for our preferences
    "quotes": ["error", "single", { "allowTemplateLiterals": true }],
    "indent": ["error", 2],
    "max-len": ["error", {
      "code": 120,
      "tabWidth": 2,
      "ignoreUrls": true,
      "ignoreStrings": true,
      "ignoreTemplateLiterals": true,
      "ignoreComments": true,
    }],
    
    // Import/Export rules
    "import/no-unresolved": "off", // Firebase Functions handles this
    "import/extensions": ["error", "always", {
      "js": "always",
    }],
    
    // Console and logging
    "no-console": "off", // We use console for logging in Cloud Functions
    "no-restricted-globals": ["error", "name", "length"],
    
    // Code quality
    "no-unused-vars": ["error", { 
      "varsIgnorePattern": "^_",
      "argsIgnorePattern": "^_",
    }],
    "no-trailing-spaces": "error",
    "eol-last": "error",
    "comma-dangle": ["error", "never"],
    "semi": ["error", "always"],
    
    // Function and variable naming
    "camelcase": ["error", { 
      "properties": "never",
      "ignoreDestructuring": true,
      "allow": [
        "^[A-Z][A-Z0-9_]*$", // Allow CONSTANT_CASE
        "CallSid", "AccountSid", "From", "To", // Twilio webhook parameters
        "CallStatus", "CallDuration", "Direction",
        "SpeechResult", "Confidence",
      ],
    }],
    
    // Object and array formatting
    "object-curly-spacing": ["error", "always"],
    "array-bracket-spacing": ["error", "never"],
    "computed-property-spacing": ["error", "never"],
    
    // Function spacing
    "space-before-function-paren": ["error", {
      "anonymous": "always",
      "named": "never",
      "asyncArrow": "always",
    }],
    
    // Arrow function rules
    "arrow-spacing": "error",
    "arrow-parens": ["error", "as-needed"],
    "prefer-arrow-callback": "error",
    
    // Async/await rules
    "require-await": "error",
    "no-return-await": "error",
    
    // Error handling
    "no-throw-literal": "error",
    "prefer-promise-reject-errors": "error",
    
    // Documentation
    "valid-jsdoc": ["error", {
      "requireReturn": false,
      "requireReturnDescription": false,
      "preferType": {
        "String": "string",
        "Number": "number",
        "Boolean": "boolean",
        "object": "Object",
      },
    }],
    "require-jsdoc": ["error", {
      "require": {
        "FunctionDeclaration": true,
        "MethodDefinition": true,
        "ClassDeclaration": true,
        "ArrowFunctionExpression": false,
        "FunctionExpression": false,
      },
    }],
    
    // Security rules
    "no-eval": "error",
    "no-implied-eval": "error",
    "no-new-func": "error",
    "no-script-url": "error",
    
    // Performance
    "no-loop-func": "error",
    "no-inner-declarations": "error",
  },
  
  // Override rules for specific file patterns
  overrides: [
    {
      files: ["**/*.test.js", "**/*.spec.js"],
      env: {
        jest: true,
      },
      rules: {
        "no-unused-expressions": "off",
        "max-len": "off",
        "require-jsdoc": "off",
      },
    },
    {
      files: ["index.js"],
      rules: {
        "max-len": ["error", { "code": 140 }], // Slightly longer for main file
      },
    },
  ],
  
  // Global variables specific to Cloud Functions
  globals: {
    // Firebase Admin SDK globals
    "admin": "readonly",
    "functions": "readonly",
    
    // Test globals (when running tests)
    "describe": "readonly",
    "it": "readonly",
    "test": "readonly",
    "expect": "readonly",
    "beforeEach": "readonly",
    "afterEach": "readonly",
    "beforeAll": "readonly",
    "afterAll": "readonly",
    "jest": "readonly",
  },
  
  // Ignore patterns
  ignorePatterns: [
    "node_modules/",
    "lib/",
    "coverage/",
    "*.min.js",
  ],
  
  // Settings for import resolution
  settings: {
    "import/resolver": {
      "node": {
        "extensions": [".js", ".json"],
      },
    },
  },
};