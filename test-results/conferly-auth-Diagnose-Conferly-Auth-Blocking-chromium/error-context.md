# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: conferly-auth.spec.ts >> Diagnose Conferly Auth Blocking
- Location: tests/conferly-auth.spec.ts:3:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 0
Received: 4
```

# Test source

```ts
  11  |     consoleLogs.push(text);
  12  |     if (msg.type() === 'error') {
  13  |       consoleErrors.push(text);
  14  |     }
  15  |   });
  16  | 
  17  |   // 1. Catch crash / unhandled exceptions with full stack trace
  18  |   page.on('pageerror', (exception) => {
  19  |     console.error('\n🚨 CRITICAL RUNTIME EXCEPTION DETECTED:');
  20  |     console.error(`Message: ${exception.message}`);
  21  |     console.error(`Stack Trace:\n${exception.stack}`); // This exposes the exact Vite bundle line
  22  |     consoleErrors.push(`[Unhandled Exception]: ${exception.message}`);
  23  |     consoleErrors.push(`[Stack]: ${exception.stack}`);
  24  |   });
  25  | 
  26  |   // 2. Monitor Supabase & Livekit endpoint communication
  27  |   page.on('response', (response) => {
  28  |     const status = response.status();
  29  |     const url = response.url();
  30  |     // Check for auth-related API calls
  31  |     if (url.includes('supabase') || url.includes('livekit') || url.includes('auth')) {
  32  |       if (status >= 400) {
  33  |         networkErrors.push(`[Network Error] ${status} - URL: ${url}`);
  34  |       } else if (status >= 200 && status < 300) {
  35  |         consoleLogs.push(`[Network Success] ${status} - URL: ${url}`);
  36  |       }
  37  |     }
  38  |   });
  39  | 
  40  |   // Navigate directly to auth page using hash routing (site uses #/auth)
  41  |   console.log('Navigating to auth page...');
  42  |   await page.goto('/#/auth');
  43  | 
  44  |   // Wait for page to load
  45  |   await page.waitForLoadState('networkidle');
  46  |   
  47  |   // Get page title/content for debugging
  48  |   const title = await page.title();
  49  |   console.log('Page title:', title);
  50  |   
  51  |   // Check what's on the page
  52  |   const bodyText = await page.locator('body').innerText().catch(() => 'N/A');
  53  |   console.log('Page content preview:', bodyText.substring(0, 500));
  54  | 
  55  |   // 3. Look for Sign In or Sign Up button to verify auth form is loaded
  56  |   const signInBtn = page.locator('button:has-text("Sign In")').first();
  57  |   const signUpBtn = page.locator('button:has-text("Sign Up")').first();
  58  |   
  59  |   const hasAuthForm = await signInBtn.isVisible().catch(() => false) || await signUpBtn.isVisible().catch(() => false);
  60  |   
  61  |   if (!hasAuthForm) {
  62  |     console.log('⚠️ Auth form not visible - checking for alternative auth triggers...');
  63  |     // Try clicking "Get Started" if it exists
  64  |     const getStarted = page.locator('text=/get started/i').first();
  65  |     if (await getStarted.isVisible().catch(() => false)) {
  66  |       console.log('Found Get Started button, clicking...');
  67  |       await getStarted.click();
  68  |       await page.waitForTimeout(2000);
  69  |     }
  70  |   }
  71  | 
  72  |   // 4. Fill credentials to test form submission event dispatching
  73  |   const emailInput = page.locator('input[type="email"], input[name="email"], input#email').first();
  74  |   const passwordInput = page.locator('input[type="password"], input[name="password"], input#password').first();
  75  |   
  76  |   if (await emailInput.isVisible().catch(() => false)) {
  77  |     console.log('Filling test credentials...');
  78  |     await emailInput.fill('agent-test@conferly.site');
  79  |     await passwordInput.fill('SecurePass123!');
  80  |   } else {
  81  |     consoleErrors.push('❌ Email input field not found on page');
  82  |   }
  83  | 
  84  |   // Locating the authentication Login / Sign Up buttons
  85  |   const authButton = page.locator('button:has-text("Sign In"), button:has-text("Sign Up"), button[type="submit"]').first();
  86  |   const isAuthButtonVisible = await authButton.isVisible().catch(() => false);
  87  |   
  88  |   if (!isAuthButtonVisible) {
  89  |     consoleErrors.push('❌ Auth button not found on page');
  90  |   } else {
  91  |     console.log('Clicking the authentication button...');
  92  |     // Force click skips Playwright's actionability checks to see if the DOM element is dead
  93  |     await authButton.click({ force: true }); 
  94  | 
  95  |     // Give the browser 3 seconds to process any failing state or async promise
  96  |     await page.waitForTimeout(3000); 
  97  |   }
  98  | 
  99  |   // Print diagnostic log
  100 |   console.log('\n=== CONFERLY INTERCEPT LOGS ===');
  101 |   console.log('--- Console Logs ---');
  102 |   console.log(consoleLogs.join('\n'));
  103 |   
  104 |   if (consoleErrors.length > 0) {
  105 |     console.error('❌ Browser Errors Found:\n', consoleErrors.join('\n'));
  106 |   }
  107 |   if (networkErrors.length > 0) {
  108 |     console.error('❌ Network/Cloudflare Failures Found:\n', networkErrors.join('\n'));
  109 |   }
  110 | 
> 111 |   expect(consoleErrors.length + networkErrors.length).toBe(0);
      |                                                       ^ Error: expect(received).toBe(expected) // Object.is equality
  112 | });
```