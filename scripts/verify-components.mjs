#!/usr/bin/env node
/**
 * Component Integrity Verification
 * Validates all components before deployment
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const SRC = './src';
const COMPONENTS = './src/components';

const COMPONENT_CLASSIFICATION = {
  // CRITICAL - Cannot fail
  critical: [
    'App.tsx',
    'AuthPage.tsx',
    'Logo.tsx',
    'MobileErrorBoundary.tsx',
  ],
  // IMPORTANT - Should not break core
  important: [
    'Lobby.tsx',
    'MeetingRoom.tsx',
    'Dashboard.tsx',
    'Sidebar.tsx',
    'MeetingControls.tsx',
  ],
  // OPTIONAL - Can fail silently
  optional: [
    'InstallBanner.tsx',
    'OnboardingPage.tsx',
    'ProfileMenu.tsx',
    'TranslationPanel.tsx',
    'SlideEditor.tsx',
    'CollaborativeEditor.tsx',
  ],
};

// Extract imports from a file
function getImports(content) {
  const importRegex = /import\s+.*?from\s+['"](.+?)['"]/g;
  const imports = [];
  let match;
  while ((match = importRegex.exec(content)) {
    imports.push(match[1]);
  }
  return imports;
}

// Extract JSX usage (components used in JSX)
function getJSXUsage(content) {
  // Match <ComponentName or <ComponentName />
  const jsxRegex = /<([A-Z][a-zA-Z0-9]*)\s*(?:\/|>|\s)/g;
  const components = [];
  let match;
  while ((match = jsxRegex.exec(content))) {
    components.push(match[1]);
  }
  return [...new Set(components)];
}

// Check a file for issues
function analyzeFile(filepath) {
  const content = readFileSync(filepath, 'utf-8');
  const imports = getImports(content);
  const jsxUsage = getJSXUsage(content);
  
  return { filepath, imports, jsxUsage };
}

// Main analysis
function runIntegrityCheck() {
  console.log('=' .repeat(50));
  console.log('COMPONENT INTEGRITY VERIFICATION');
  console.log('=' .repeat(50));
  console.log('');
  
  // Analyze App.tsx
  const appAnalysis = analyzeFile('./src/App.tsx');
  console.log('App.tsx Dependencies:');
  appAnalysis.imports.forEach(i => console.log('  - ' + i));
  console.log('');
  console.log('JSX Usage in App:');
  appAnalysis.jsxUsage.forEach(c => console.log('  - <' + c + ' />'));
  console.log('');
  
  // Verify all critical components exist
  console.log('COMPONENT CLASSIFICATION:');
  console.log('');
  console.log('CRITICAL:');
  COMPONENT_CLASSIFICATION.critical.forEach(c => {
    const exists = statSync(join(COMPONENTS, c)).isFile();
    console.log('  ' + c + ': ' + (exists ? 'OK' : 'MISSING'));
  });
  console.log('');
  console.log('IMPORTANT:');
  COMPONENT_CLASSIFICATION.important.forEach(c => {
    const exists = statSync(join(COMPONENTS, c)).isFile();
    console.log('  ' + c + ': ' + (exists ? 'OK' : 'MISSING'));
  });
  console.log('');
  console.log('OPTIONAL:');
  COMPONENT_CLASSIFICATION.optional.forEach(c => {
    const exists = statSync(join(COMPONENTS, c)).isFile();
    console.log('  ' + c + ': ' + (exists ? 'OK' : 'MISSING'));
  });
  
  console.log('');
  console.log('=' .repeat(50));
  console.log('VERIFICATION COMPLETE');
  console.log('=' .repeat(50));
}

runIntegrityCheck();
