# Step 3: Update Email Templates

## 🔧 **Instructions:**

### **Access Email Templates**
1. **In Authentication section**, click **"Email Templates"**
2. **Select "Confirm signup"** template
3. **Replace content** with our minimal template

### **Template Content to Use:**
Copy content from: `supabase/email-templates/confirm-signup-minimal.html`

### **Subject Line:**
Set subject to: `Welcome to Conferly! Confirm your email`

## 📸 **What It Should Look Like:**

```
Email Templates
├── Confirm signup  ← SELECT THIS
│   ├── Subject: Welcome to Conferly! Confirm your email
│   ├── Body: [Paste minimal template content]
│   └── Variables: {{ .ConfirmationURL }}
├── Reset password
└── Change email address
```

## ⚠️ **Important:**
- **Use minimal template** (avoids blocked keywords)
- **Keep {{ .ConfirmationURL }}** variable
- **Don't modify the variable syntax**
- **Test with a new email** after saving

## ✅ **Next Step:**
Save the template and proceed to Step 4 for testing.
