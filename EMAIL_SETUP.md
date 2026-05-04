# Setting Up Custom Email Confirmation in Supabase

This guide will help you replace the default Supabase email template with our custom, professional confirmation email.

## 📧 Current Template vs New Template

### Default Supabase Template:
```
<h2>Confirm your signup</h2>
<p>Follow this link to confirm your user:</p>
<p><a href="{{ .ConfirmationURL }}">Confirm your mail</a></p>
```

### Our New Professional Template:
- Beautiful gradient design with Conferly branding
- Welcome message with emoji
- Feature highlights
- Clear call-to-action button
- Security notice
- Help contact information
- Mobile-responsive design

## 🛠️ Setup Instructions

### Option 1: Via Supabase Dashboard (Recommended)

1. **Go to Supabase Dashboard**
   - Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Select your project: `neymqmyzmsberwlowlpw`

2. **Access Email Templates**
   - Go to **Authentication** → **Email Templates**
   - Click on **"Confirm signup"** template

3. **Replace the Content**
   - Copy the content from `supabase/email-templates/confirm-signup.html`
   - Paste it into the template editor
   - Set **Subject** to: `Welcome to Conferly! 🎉 Confirm your email`
   - Click **Save**

### Option 2: Via SQL (Advanced)

```sql
-- Update the confirmation email template
UPDATE auth.mfa_factors 
SET email_template = 'YOUR_HTML_CONTENT_HERE'
WHERE factor_type = 'email';
```

## 🎨 Template Features

Our custom email template includes:

- **Professional Design**: Gradient colors matching Conferly brand
- **Clear Instructions**: Step-by-step guidance for users
- **Feature Preview**: Shows users what they'll get after confirmation
- **Security Notice**: Builds trust and provides safety information
- **Help Links**: Direct access to support
- **Mobile Responsive**: Works perfectly on all devices
- **Expiration Warning**: Creates urgency for confirmation

## 📱 Mobile Optimization

The template is fully responsive with:
- Touch-friendly buttons
- Readable fonts on mobile
- Proper spacing for small screens
- Optimized images and icons

## 🔧 Testing the Setup

1. **Test Registration Flow**
   - Try signing up with a new email
   - Check if the new template is used
   - Verify the confirmation link works

2. **Test Resend Functionality**
   - Use the "Resend Confirmation Email" button
   - Verify the new template is sent again

3. **Check Spam Filters**
   - Test with different email providers
   - Ensure emails don't go to spam

## 📊 Expected Results

After setup, users will receive:
- ✅ Professional welcome email
- ✅ Clear confirmation instructions
- ✅ Feature highlights
- ✅ Security information
- ✅ Help contact details
- ✅ Mobile-friendly experience

## 🚀 Additional Improvements

Consider also updating:
- **Password Reset** email template
- **Magic Link** email template
- **Change Email Address** confirmation template

## 📞 Support

If you encounter issues:
1. Check Supabase email settings
2. Verify custom SMTP configuration
3. Test with different email addresses
4. Contact Supabase support if needed

---

**Result**: Your users will now receive a beautiful, professional confirmation email that matches the Conferly brand and provides excellent user experience!
