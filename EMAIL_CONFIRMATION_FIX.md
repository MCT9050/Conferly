# Fix Email Confirmation Redirect Issue

## 🔍 **The Problem**

Users clicking email confirmation links are being redirected to local development URLs instead of your production site `https://www.conferly.site`.

## 🛠️ **Step-by-Step Solution**

### **Step 1: Configure Supabase Auth URLs (Most Important)**

1. **Go to Supabase Dashboard**
   - Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project: `neymqmyzmsberwlowlpw`

2. **Update URL Configuration**
   - Go to **Authentication** → **URL Configuration** (in the left sidebar)
   - Set **Site URL** to: `https://www.conferly.site`
   
3. **Add Redirect URLs**
   In the "Redirect URLs" section, add:
   ```
   https://www.conferly.site/*
   http://localhost:3000/*  (for development)
   ```

4. **Save Changes**
   - Click the **Save** button at the bottom

### **Step 2: Update Email Templates**

1. **Go to Email Templates**
   - Navigate to **Authentication** → **Email Templates**
   - Select **"Confirm signup"** template

2. **Update the Template**
   - Use the content from `supabase/email-templates/confirm-signup-minimal.html`
   - Ensure the `{{ .ConfirmationURL }}` is present (this will automatically use the correct URL)

3. **Set Subject**
   - Subject: `Welcome to Conferly! Confirm your email`

4. **Save** the template

### **Step 3: Test the Fix**

1. **Clear Browser Cache**
   - Clear your browser's cache and cookies
   - Or use an incognito/private window

2. **Test Registration**
   - Try signing up with a new email address
   - Check the confirmation email you receive
   - The link should now point to `https://www.conferly.site`

3. **Verify Redirect**
   - Click the confirmation link
   - It should redirect to your production site
   - User should be automatically signed in

## 🎯 **How It Works**

### **Before Fix:**
```
User clicks email link → Redirects to localhost:3000 → ❌ Broken
```

### **After Fix:**
```
User clicks email link → Redirects to https://www.conferly.site → ✅ Works
```

### **Supabase URL Resolution:**
1. Supabase uses your **Site URL** setting as the base
2. The `{{ .ConfirmationURL }}` in email templates automatically uses this
3. No need to specify `emailRedirectTo` in code

## 🔧 **Alternative Solutions**

### **Option A: Environment-Based URLs**
If you need different URLs for development vs production:

```typescript
// In useAuth.ts
const getRedirectUrl = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000';
  }
  return 'https://www.conferly.site';
};

// Then use:
emailRedirectTo: getRedirectUrl()
```

### **Option B: Custom Landing Page**
Create a dedicated confirmation page that handles the redirect:

```typescript
// URL: https://www.conferly.site/confirm
// This page would extract tokens and complete the signup
```

## 📱 **Mobile Users**

The fix also ensures mobile email clients work correctly:
- Gmail app
- Apple Mail
- Outlook mobile
- Web-based email clients

## 🚀 **Verification Checklist**

- [ ] Supabase Site URL set to `https://www.conferly.site`
- [ ] Redirect URLs include `https://www.conferly.site/*`
- [ ] Email template uses `{{ .ConfirmationURL }}`
- [ ] Test with new email address
- [ ] Test on mobile device
- [ ] Test in different email clients

## 🆘 **Troubleshooting**

### **Still redirecting to localhost?**
1. Double-check Supabase URL settings
2. Clear browser cache
3. Wait 5-10 minutes for changes to propagate
4. Try a different browser

### **Email template not working?**
1. Use the minimal template to avoid keyword blocking
2. Ensure `{{ .ConfirmationURL }}` is present
3. Check for typos in the template

### **Users still having issues?**
1. Check if they're clicking an old confirmation email
2. Have them request a new confirmation email
3. Verify the email address is correct

## 📊 **Expected Result**

After applying this fix:
- ✅ Email links redirect to production site
- ✅ Users are automatically signed in
- ✅ Works on all devices and email clients
- ✅ No more localhost redirect issues

---

**This fix ensures your email confirmation works correctly for all users, regardless of their device or email client!**
