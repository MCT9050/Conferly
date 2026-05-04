# Cloudflare Turnstile Setup for Conferly

## 🎯 **Why Turnstile?**
- Bot protection without annoying CAPTCHAs
- Privacy-focused (no tracking)
- Invisible to users
- Free for your usage level
- Professional security feature

## 📋 **Setup Steps**

### **Step 1: Create Widget**
1. **Go to:** https://dash.cloudflare.com/?to=/:account/turnstile
2. **Click:** "Add widget"
3. **Settings:**
   - **Widget name:** "Conferly Supabase Auth"
   - **Hostname:** `www.conferly.site`
   - **Widget mode:** Managed (recommended)
4. **Click:** "Create"
5. **Copy:** Sitekey and Secret Key

### **Step 2: Frontend Integration**
Add Turnstile to your auth forms:

```html
<!-- In <head> of index.html -->
<script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
```

### **Step 3: Update AuthPage Component**
Add Turnstile widget to signup form:

```jsx
// Add before submit button in AuthPage.tsx
<div 
  className="cf-turnstile" 
  data-sitekey="YOUR_SITEKEY" 
  data-theme="dark"
  data-size="normal"
>
</div>
```

### **Step 4: Edge Function for Validation**
Create verification function:

```typescript
// supabase/functions/verify-turnstile/index.ts
Deno.serve(async (req) => {
  const { token } = await req.json();
  
  const result = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: Deno.env.get('TURNSTILE_SECRET_KEY'),
      response: token,
    }),
  });

  const outcome = await result.json();

  if (!outcome.success) {
    return new Response(JSON.stringify({ error: "Invalid Turnstile token" }), { 
      status: 403 
    });
  }

  return new Response(JSON.stringify({ success: true }), { status: 200 });
});
```

### **Step 5: Update Auth Flow**
Modify signup to validate Turnstile first:

```typescript
// In useAuth.ts before signUp
const turnstileToken = getTurnstileToken();
if (!turnstileToken) {
  setError('Please complete the security verification');
  return;
}

// Validate token
const isValid = await verifyTurnstileToken(turnstileToken);
if (!isValid) {
  setError('Security verification failed');
  return;
}

// Proceed with signup
const { data, error } = await supabase.auth.signUp({...});
```

## 🔧 **Configuration Details**

### **Widget Settings:**
- **Sitekey:** Public key (frontend)
- **Secret Key:** Private key (backend only)
- **Domain:** `www.conferly.site`
- **Mode:** Managed (auto-selects challenge)

### **Test Keys (for development):**
- **Sitekey:** `1x00000000000000000000AA`
- **Secret:** `1x0000000000000000000000000000000AA`

## 🚀 **Benefits**

### **Security:**
- Prevents automated bot signups
- Reduces spam accounts
- Protects against credential stuffing
- No user friction

### **User Experience:**
- Invisible to legitimate users
- No annoying puzzles
- Fast verification
- Mobile-friendly

### **Professional:**
- Enterprise-grade security
- Privacy-focused
- GDPR compliant
- Free tier available

## 📊 **Implementation Priority**

| Priority | Task | Time |
|----------|------|------|
| **High** | Create Turnstile widget | 5 min |
| **High** | Add to signup form | 15 min |
| **Medium** | Edge function validation | 30 min |
| **Low** | Add to login form | 15 min |

## ✅ **Next Steps**

1. **Create widget** in Cloudflare dashboard
2. **Add widget to AuthPage component**
3. **Create verification Edge Function**
4. **Update signup flow**
5. **Test with real users**

---

**This will give Conferly professional-grade bot protection!** 🛡️
