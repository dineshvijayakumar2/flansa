# Railway Navbar Fix - Deployment Instructions

## Problem
Railway Frappe deployment has `frappe.boot.home_page = "setup-wizard"` which prevents navbar creation, even though database values are correct.

## Solution
Force navbar creation regardless of boot conditions using `railway-navbar-force.js`.

## Deployment Steps

### 1. Copy JavaScript file to public folder
```bash
cp docker-setup/railway-fixes/railway-navbar-force.js flansa/public/js/
```

### 2. Update hooks.py
Add as **FIRST** item in `app_include_js`:
```python
app_include_js = [
    "/assets/flansa/js/railway-navbar-force.js",  # ADD THIS FIRST
    "/assets/flansa/js/flansa-browser-cache-manager.js",
    # ... rest of existing files
]
```

### 3. Update Procfile (if needed)
```bash
web: bench --site flansa-production-4543.up.railway.app serve --port $PORT
```

### 4. Deploy to Railway
```bash
git add .
git commit -m "Fix: Add Railway navbar force script"
git push origin railway-fresh
```

### 5. Test in Railway browser console
After deployment, check:
```javascript
// Should see these console messages:
// "🚂 Railway Navbar Force Fix loading..."
// "🔧 Force creating navbar for Railway..."
// "✅ Frappe toolbar created" OR "✅ Manual navbar created"

// Check navbar exists
document.querySelector('.navbar')
```

## How it works
1. **Method 1**: Force creates Frappe toolbar bypassing setup-wizard check
2. **Method 2**: Creates manual navbar if Frappe method fails
3. **Timing**: Runs 2 seconds after DOM ready to ensure Frappe is loaded
4. **Fallback**: Works on route changes too

## Expected Result
- Working navbar with Flansa logo
- Home, User dropdown with Profile/Workspace/Logout
- Proper 60px body padding
- No more navbar visibility issues