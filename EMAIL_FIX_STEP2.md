# Step 2: Configure Site URL

## 🔧 **Instructions:**

### **Site URL Setting**
1. **Find "Site URL" field**
2. **Set it to:** `https://www.conferly.site`
3. **Remove any localhost URLs**

### **Redirect URLs Setting**
1. **Find "Redirect URLs" section**
2. **Add these URLs:**
   ```
   https://www.conferly.site/*
   http://localhost:3000/*  (for development)
   ```

## 📸 **What It Should Look Like:**

```
URL Configuration
├── Site URL: https://www.conferly.site
├── Redirect URLs:
│   ├── https://www.conferly.site/*
│   └── http://localhost:3000/*
└── Additional Settings
```

## ⚠️ **Important Notes:**
- **Site URL** is the base URL for your app
- **Redirect URLs** allow specific pages after authentication
- **Wildcard (*)** allows all sub-paths
- **Keep localhost** for development testing

## ✅ **Next Step:**
Click **"Save"** button at the bottom, then proceed to Step 3.
