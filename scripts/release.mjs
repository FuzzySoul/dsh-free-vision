#!/usr/bin/env node
/**
 * Release helper: bump version, update changelog, tag.
 * Usage: node scripts/release.mjs [major|minor|patch]   (default: patch)
 */
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'

const bump = process.argv[2] || 'patch'
const pkgPath = new URL('../package.json', import.meta.url)
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [major, minor, patch] = pkg.version.split('.').map(Number)
const next = bump === 'major' ? [major + 1, 0, 0]
  : bump === 'minor' ? [major, minor + 1, 0]
  : [major, minor, patch + 1]
const version = next.join('.')

console.log('Bumping ' + pkg.version + ' -> ' + version + ' (' + bump + ')')
execSync('git diff --quiet && git diff --cached --quiet', { stdio: 'pipe' }) // ensure clean tree

pkg.version = version
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + String.fromCharCode(10), 'utf-8')

// Move [Unreleased] entries into the new version section.
const changelogPath = new URL('../CHANGELOG.md', import.meta.url)
let changelog = readFileSync(changelogPath, 'utf-8')
if (changelog.includes('## [Unreleased]')) {
  const today = new Date().toISOString().slice(0, 10)
  changelog = changelog.replace(
    '## [Unreleased]' + String.fromCharCode(10),
    '## [Unreleased]' + String.fromCharCode(10) + String.fromCharCode(10) + '## [' + version + '] - ' + today + String.fromCharCode(10),
  )
  writeFileSync(changelogPath, changelog, 'utf-8')
}

execSync('git add package.json CHANGELOG.md && git commit -m "chore: release v' + version + '"')
execSync('git tag v' + version)
console.log('Committed and tagged v' + version + '.')
console.log('Next: git push --follow-tags, then publish via CI workflow (or: npm publish)')
