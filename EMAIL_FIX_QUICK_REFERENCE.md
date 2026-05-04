# Email Confirmation Fix - Quick Reference

## 🚀 **5-Minute Fix Summary**

### **1. Supabase Dashboard**
- URL: https://supabase.com/dashboard
- Project: `neymqmyzmsberwlowlpw`
- Go to: Authentication → URL Configuration

### **2. URL Settings**
```
Site URL: https://www.conferly.site
Redirect URLs:
- https://www.conferly.site/*
- http://localhost:3000/*
```

### **3. Email Template**
- Use: `supabase/email-templates/confirm-signup-minimal.html`
- Subject: `Welcome to Conferly! Confirm your email`
- Keep: `{{ .ConfirmationURL }}` variable

### **4. Save & Test**
- Click Save button
- Wait 5 minutes for propagation
- Test with new email address

## ⚡ **Expected Result**
- Users click confirmation link → `https://www.conferly.site` ✅
- User automatically signed in → Dashboard ✅
- Works on all devices and email clients ✅

## 🔧 **Files You Have Ready:**
- `EMAIL_FIX_STEP1.md` - Dashboard access
- `EMAIL_FIX_STEP2.md` - URL configuration  
- `EMAIL_FIX_STEP3.md` - Template update
- `EMAIL_FIX_STEP4.md` - Testing guide
- `confirm-signup-minimal.html` - Email template

## 🎯 **Impact:**
- ✅ **Fixes critical user onboarding issue**
- ✅ **Enables proper email confirmation flow**
- ✅ **Works for all production users**
- ✅ **Removes localhost redirect problem**

---

**This is the #1 critical issue blocking your beta launch. Fix this and your app is ready!** 🚀
