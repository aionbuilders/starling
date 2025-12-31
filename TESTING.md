# Testing Before Publication

This document describes how to test @aionbuilders/starling before publishing to npm.

## Prerequisites

Before testing, ensure dependencies are installed:

```bash
bun install
```

If you encounter npm registry authentication issues (401 errors), you may need to:
- Check your npm authentication token
- Verify network connectivity
- Clear npm cache: `bun cache clean`

## 1. Build Tests

### Run the build

```bash
bun run build
```

Expected output:
- `dist/index.js` created (minified bundle)
- No build errors
- Bundle size should be reasonable (< 50KB)

Check build output:

```bash
ls -lh dist/
```

### Verify build content

```bash
cat dist/index.js | head -20
```

The file should:
- Be minified
- Contain the bundled code
- Have proper module exports

## 2. TypeScript Definitions

### Generate type definitions

```bash
bun run generate-types
```

Expected output:
- `dist/index.d.ts` created
- `dist/index.d.ts.map` created (source map)
- No TypeScript errors

Check generated types:

```bash
ls -lh dist/*.d.ts*
cat dist/index.d.ts | head -30
```

The type file should export:
- `Starling` class
- `ConnectionClosedError` class
- `LocalStorageSessionStorage` and `InMemorySessionStorage` classes

## 3. Import Tests

### Test Node.js import

Create a test file:

```bash
cat > test-import.js << 'EOF'
import { Starling, ConnectionClosedError } from './dist/index.js';

console.log('✓ Starling imported:', typeof Starling);
console.log('✓ ConnectionClosedError imported:', typeof ConnectionClosedError);

// Test basic instantiation
try {
  const starling = new Starling({ url: 'ws://localhost:3000' });
  console.log('✓ Starling instantiated successfully');
  console.log('✓ State:', starling.state);
} catch (error) {
  console.error('✗ Error:', error.message);
}
EOF
```

Run the test:

```bash
node test-import.js
```

Clean up:

```bash
rm test-import.js
```

### Test Bun import

```bash
cat > test-import-bun.js << 'EOF'
import { Starling, ConnectionClosedError, LocalStorageSessionStorage, InMemorySessionStorage } from './dist/index.js';

console.log('✓ All exports imported successfully');
console.log('✓ Starling:', typeof Starling);
console.log('✓ ConnectionClosedError:', typeof ConnectionClosedError);
console.log('✓ LocalStorageSessionStorage:', typeof LocalStorageSessionStorage);
console.log('✓ InMemorySessionStorage:', typeof InMemorySessionStorage);
EOF

bun test-import-bun.js
rm test-import-bun.js
```

## 4. Browser Test (Manual)

Create a test HTML file:

```bash
cat > test-browser.html << 'EOF'
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Starling Browser Test</title>
</head>
<body>
  <h1>Starling Browser Test</h1>
  <div id="output"></div>

  <script type="module">
    import { Starling } from './dist/index.js';

    const output = document.getElementById('output');

    try {
      const starling = new Starling({ url: 'ws://localhost:3000' });
      output.innerHTML += '<p>✓ Starling imported and instantiated</p>';
      output.innerHTML += `<p>✓ State: ${starling.state}</p>`;
      output.innerHTML += '<p>✓ Browser test passed!</p>';
    } catch (error) {
      output.innerHTML += `<p>✗ Error: ${error.message}</p>`;
    }
  </script>
</body>
</html>
EOF
```

Open in browser:

```bash
# Using Python
python3 -m http.server 8000

# OR using Bun
bun --hot index.html

# Then open: http://localhost:8000/test-browser.html
```

Clean up:

```bash
rm test-browser.html
```

## 5. Package Contents Test

### Dry-run npm pack

```bash
npm pack --dry-run
```

This shows what will be published. Verify:

✓ **Included files:**
- `dist/index.js`
- `dist/index.d.ts`
- `dist/index.d.ts.map`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`
- `package.json`

✗ **NOT included:**
- `src/` directory
- `tests/` directory
- `tsc/` directory
- `.claude/` directory
- Test files (`*.test.js`)
- Config files (`.gitignore`, `jsconfig.json`)

### Check package size

```bash
npm pack
tar -tzf aionbuilders-starling-1.0.0.tgz | head -20
rm aionbuilders-starling-1.0.0.tgz
```

The tarball should contain only the files listed above.

## 6. TypeScript Integration Test

Create a TypeScript test file:

```typescript
// test-types.ts
import { Starling, ConnectionClosedError } from './dist/index.js';

const starling: Starling = new Starling({
  url: 'ws://localhost:3000',
  timeout: 10000,
  requestTimeout: 5000,
  sessionRecovery: {
    enabled: true,
    autoRecover: true,
    autoRefresh: true
  }
});

async function test() {
  await starling.connect();

  const response = await starling.request('test.method', { key: 'value' });

  starling.on('chat:message', (data, context) => {
    console.log(data, context);
  });

  await starling.subscribe('room:lobby');
  await starling.unsubscribe('room:lobby');
}

// Type checking only - don't run
// test();
```

Check types:

```bash
tsc --noEmit test-types.ts
rm test-types.ts
```

## 7. Pre-publication Checklist

Before running `bun publish`, verify:

- [ ] `package.json`:
  - [ ] `"private": true` is **removed**
  - [ ] `version` is set to `"1.0.0"`
  - [ ] `description`, `keywords`, `author`, `license` are set
  - [ ] `repository`, `bugs`, `homepage` URLs are correct
  - [ ] `files` array includes `"dist/"`, `"README.md"`, `"LICENSE"`, `"CHANGELOG.md"`
  - [ ] Dependencies use proper version ranges (no `link:`)

- [ ] Build:
  - [ ] `bun run build` succeeds
  - [ ] `dist/index.js` exists and is minified

- [ ] Types:
  - [ ] `bun run generate-types` succeeds
  - [ ] `dist/index.d.ts` exists
  - [ ] All exports are typed

- [ ] Documentation:
  - [ ] README.md is comprehensive
  - [ ] CHANGELOG.md documents v1.0.0
  - [ ] LICENSE file exists

- [ ] Package:
  - [ ] `npm pack --dry-run` shows correct files
  - [ ] No source files in package
  - [ ] Bundle size is reasonable

## 8. Publication

Once all tests pass:

```bash
# Stable release
bun publish

# Or use the helper script
bun run release:stable
```

## Troubleshooting

### Build fails with "Could not resolve" errors

Make sure dependencies are installed:

```bash
bun install
```

### TypeScript generation fails

Check that TypeScript is installed:

```bash
bunx tsc --version
```

### Import test fails

Check that the build was successful and `dist/index.js` exists:

```bash
ls -la dist/
```

### Package includes source files

Check `.npmignore` is configured correctly and `files` array in `package.json` only includes `dist/`.

## Notes

- Always test in a clean environment before publishing
- Consider testing on multiple Node.js/Bun versions
- Test both ESM and CommonJS imports if supporting both
- Verify bundle size hasn't increased significantly between versions
