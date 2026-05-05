# Deploy Turnstile Edge Function

## 🔧 **Command to Run:**

```bash
supabase functions deploy verify-turnstile
```

## 📋 **What This Does:**
- Deploys the Turnstile verification function to Supabase
- Makes the function available at `/functions/v1/verify-turnstile`
- Links the secret key you just added
- Enables server-side token validation

## ✅ **Expected Output:**
```
Deployed function verify-turnstile
Function URL: https://[project-id].supabase.co/functions/v1/verify-turnstile
```

## 🎯 **After Deployment:**
1. **Test the function** is accessible
2. **Verify signup flow** works with Turnstile
3. **Check bot protection** is active

## 🚀 **Ready to Test:**
Once deployed, your signup form will have full bot protection!
