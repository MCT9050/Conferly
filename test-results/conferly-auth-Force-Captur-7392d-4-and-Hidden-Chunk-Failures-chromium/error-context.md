# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: conferly-auth.spec.ts >> Force Capture Assets Directory 404 and Hidden Chunk Failures
- Location: tests/conferly-auth.spec.ts:4:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 1
```

# Page snapshot

```yaml
- main [ref=e3]:
  - generic [ref=e4]:
    - generic [ref=e5]:
      - generic [ref=e7]:
        - img "Conferly" [ref=e8]
        - generic [ref=e9]:
          - generic [ref=e10]: Conferly
          - generic [ref=e11]: Connecting with Purpose
      - heading "Conferly" [level=1] [ref=e12]
      - paragraph [ref=e13]: Welcome back. Sign in to continue.
    - generic [ref=e14]:
      - img [ref=e15]
      - paragraph [ref=e17]: Invalid login credentials
    - generic [ref=e18]:
      - generic [ref=e19]:
        - button "Sign In" [ref=e20]
        - button "Sign Up" [ref=e21]
      - generic [ref=e22]:
        - generic [ref=e23]:
          - generic [ref=e24]:
            - img [ref=e25]
            - text: Email Address
          - textbox "Email Address" [ref=e28]:
            - /placeholder: you@example.com
            - text: diagnostic-agent@conferly.site
        - generic [ref=e29]:
          - generic [ref=e30]:
            - img [ref=e31]
            - text: Password
          - generic [ref=e34]:
            - textbox "Password" [ref=e35]:
              - /placeholder: ••••••••
              - text: Password123!
            - button [ref=e36]:
              - img [ref=e37]
        - button "Sign In" [ref=e40]:
          - text: Sign In
          - img [ref=e41]
      - paragraph [ref=e43]:
        - text: Don't have an account?
        - button "Sign up free" [ref=e44]
        - button "Forgot your password?" [ref=e45]
    - generic [ref=e46]:
      - img [ref=e47]
      - generic [ref=e50]: Encrypted authentication • Works offline too
```

# Test source

```ts
  3   | 
  4   | test('Force Capture Assets Directory 404 and Hidden Chunk Failures', async ({ page }) => {
  5   |   const assetErrors: Array<{ url: string; status: number; type: string }> = [];
  6   |   const runtimeLogs: string[] = [];
  7   |   const consoleMessages: string[] = [];
  8   | 
  9   | 
  10  |   // 0. Capture ALL console messages including error
  11  |   page.on('console', (msg) => {
  12  |     const text = msg.text();
  13  |     consoleMessages.push(`[${msg.type().toUpperCase()}] ${text}`);
  14  |     if (msg.type() === 'error') {
  15  |       runtimeLogs.push(`[Console Error]: ${text}`);
  16  |     }
  17  |   });
  18  | 
  19  | 
  20  |   // 1. Intercept all responses specifically filtering for the /assets/ directory
  21  |   page.on('response', (response) => {
  22  |     const url = response.url();
  23  |     const status = response.status();
  24  |     
  25  |     // Log any asset drop or backend failure immediately
  26  |     if (status >= 400 && url.includes('/assets/')) {
  27  |       assetErrors.push({
  28  |         url,
  29  |         status,
  30  |         type: response.request().resourceType(),
  31  |       });
  32  |     }
  33  |   });
  34  | 
  35  | 
  36  |   // 2. Capture low-level link and resource load crashes
  37  |   page.on('requestfailed', (request) => {
  38  |     const failure = request.failure();
  39  |     // Check for any API failures
  40  |     if (request.url().includes('api') || request.url().includes('supabase') || request.url().includes('auth')) {
  41  |       runtimeLogs.push(`[API Request Failed]: ${request.url()} | Reason: ${failure?.errorText}`);
  42  |     } else if (request.url().includes('/assets/')) {
  43  |       runtimeLogs.push(`[Asset Fetch Failed]: ${request.url()} | Reason: ${failure?.errorText}`);
  44  |     }
  45  |   });
  46  | 
  47  | 
  48  |   // 3. Monitor React 19 dynamic import rejections
  49  |   page.on('pageerror', (err) => {
  50  |     runtimeLogs.push(`[Unhandled Code Exception]: ${err.message}\nStack: ${err.stack}`);
  51  |   });
  52  | 
  53  | 
  54  |   // Execute authentication steps against local staging container
  55  |   await page.goto('/');
  56  |   
  57  |   const getStarted = page.locator('text=/get started/i').first();
  58  |   await getStarted.click();
  59  | 
  60  | 
  61  |   await page.locator('input[type="email"]').fill('diagnostic-agent@conferly.site');
  62  |   await page.locator('input[type="password"]').fill('Password123!');
  63  | 
  64  | 
  65  |   // Wait for form to fully render
  66  |   await page.waitForTimeout(1000);
  67  | 
  68  |   const actionButton = page.locator('button:has-text("Log In"), button[type="submit"]').first();
  69  |   
  70  |   console.log('Triggering auth execution button click event...');
  71  |   await actionButton.click();
  72  | 
  73  | 
  74  |   // Force a short wait to ensure lazy-loaded asset chunks try to clear the network wire
  75  |   await page.waitForTimeout(2000);
  76  | 
  77  | 
  78  |   // Print exhaustive Asset Diagnostics Report directly to your container stdout
  79  |   console.log('\n==================================================');
  80  |   console.log('🚨 EXPLICIT ASSET DIRECTORY DIAGNOSTIC TRAFFIC LOG');
  81  |   console.log('==================================================');
  82  |   
  83  |   if (assetErrors.length > 0) {
  84  |     console.error('❌ CRITICAL 404/FETCH ASSET DROPS DETECTED:');
  85  |     assetErrors.forEach(err => {
  86  |       console.error(`  -> Status: ${err.status} | Type: ${err.type} | URL: ${err.url}`);
  87  |     });
  88  |   } else {
  89  |     console.log('✅ Zero 404 network errors captured inside the /assets/ directory paths.');
  90  |   }
  91  | 
  92  | 
  93  |   if (runtimeLogs.length > 0) {
  94  |     console.error('\n❌ HIDDEN COMPONENT AND SYSTEM CODES STACK:');
  95  |     console.error(runtimeLogs.join('\n'));
  96  |   }
  97  | 
  98  |   // Print all captured console messages
  99  |   console.log('\n--- ALL CONSOLE MESSAGES ---');
  100 |   consoleMessages.forEach(msg => console.log(msg));
  101 | 
  102 |   // STRICTER: Fail if any errors detected
> 103 |   expect(runtimeLogs.length).toBe(0);
      |                              ^ Error: expect(received).toBe(expected) // Object.is equality
  104 |   expect(assetErrors.length).toBe(0);
  105 | });
  106 | 
```