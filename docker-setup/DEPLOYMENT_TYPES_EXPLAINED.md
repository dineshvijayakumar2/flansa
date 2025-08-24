# Frappe Deployment Types Explained

## 🎯 Three Types of Changes in Frappe

### 1. **Code Changes** (Python/JavaScript) - SIMPLE
**What**: Changing business logic, fixing bugs in .py or .js files
**Examples**:
```python
# Before: flansa/api.py
def calculate_tax():
    return amount * 0.10  # Bug: wrong rate

# After: flansa/api.py  
def calculate_tax():
    return amount * 0.18  # Fixed: correct rate
```

**How to Deploy**:
```bash
# Just push the code
git push origin railway-fresh

# Railway Variables:
BUILD_ASSETS=false
RUN_MIGRATIONS=false
```
**Time**: 2-3 minutes
**What happens**: Only copies new Python/JS files, restarts server

---

### 2. **Database Changes** (DocTypes/Fields) - MEDIUM
**What**: Adding new fields, creating DocTypes, changing field types
**Examples**:
- Added new field "GST Number" to Customer DocType
- Created new DocType "Tax Invoice"
- Changed field type from Int to Float
- Made a field mandatory

**In Frappe, this happens when you**:
```bash
# Locally you do:
bench --site mysite.local add-custom-field
bench --site mysite.local new-doctype "Tax Invoice"
# Or use the UI to customize DocTypes
```

**How to Deploy**:
```bash
# Push the code
git push origin railway-fresh

# Railway Variables:
BUILD_ASSETS=false
RUN_MIGRATIONS=true  # This runs bench migrate
```
**Time**: 5-7 minutes
**What happens**: Runs `bench migrate` to update database schema

---

### 3. **Major Changes** (Framework/Assets) - FULL
**What**: CSS changes, new app installation, Frappe upgrades
**Examples**:
- Changed CSS styles
- Added new JavaScript libraries
- Installed new Frappe app
- Upgraded Frappe version
- First deployment after removing service

**How to Deploy**:
```bash
# Push the code
git push origin railway-fresh

# Railway Variables:
BUILD_ASSETS=true     # Rebuilds CSS/JS
RUN_MIGRATIONS=true   # Updates database
```
**Time**: 10-15 minutes
**What happens**: Full rebuild including assets, migrations, cache clear

---

## 📊 Quick Decision Guide

Ask yourself:

### Did I change Python files (.py)?
→ **Simple deployment** (no migrations needed)

### Did I add/modify DocType fields?
→ **Medium deployment** (migrations needed)

### Did I change CSS/JS or is site broken?
→ **Full deployment** (assets + migrations)

---

## 🎮 Real Examples

### Example 1: Fix a calculation bug
```python
# Changed: flansa/utils.py
def calculate_discount():
    return price * 0.1  # Changed from 0.15
```
**Deploy**: Simple (BUILD_ASSETS=false, RUN_MIGRATIONS=false)

### Example 2: Add GST field to Sales Invoice
```bash
# Added field via Frappe UI
# New field: gst_number (Data type)
```
**Deploy**: Medium (BUILD_ASSETS=false, RUN_MIGRATIONS=true)

### Example 3: Your current situation (CSS not loading)
```bash
# Site was removed, CSS/JS not built
```
**Deploy**: Full (BUILD_ASSETS=true, RUN_MIGRATIONS=true)

---

## 🚀 Step-by-Step for Each Type

### Simple Deployment (Code only)
1. Make Python/JS changes locally
2. Test: `bench --site mysite.local reload`
3. Push: `git push origin railway-fresh`
4. Railway Variables:
   - BUILD_ASSETS=**false**
   - RUN_MIGRATIONS=**false**
5. Deploy takes 2-3 minutes

### Medium Deployment (Database changes)
1. Add fields/DocTypes locally
2. Test: `bench --site mysite.local migrate`
3. Push: `git push origin railway-fresh`
4. Railway Variables:
   - BUILD_ASSETS=**false**
   - RUN_MIGRATIONS=**true**
5. Deploy takes 5-7 minutes

### Full Deployment (Everything)
1. Make any changes
2. Push: `git push origin railway-fresh`
3. Railway Variables:
   - BUILD_ASSETS=**true**
   - RUN_MIGRATIONS=**true**
4. Deploy takes 10-15 minutes

---

## 💡 Pro Tips

### Tip 1: Batch Simple Changes
Instead of deploying each bug fix:
```bash
# Fix bug 1
# Fix bug 2  
# Fix bug 3
git add . && git commit -m "Fix: Multiple bugs"
git push  # One deployment for all
```

### Tip 2: Check What Changed
```bash
# See what files changed
git status

# If only .py files → Simple
# If .json files (DocTypes) → Medium  
# If .css/.js files → Full
```

### Tip 3: When in Doubt
If unsure, use:
- BUILD_ASSETS=true
- RUN_MIGRATIONS=true

It's slower but always works!

---

## 🎯 Your Current Deployment

Since you removed Flansa deployment (but kept database):

1. **First deployment** (NOW):
   ```env
   BUILD_ASSETS=true      # Fix CSS
   RUN_MIGRATIONS=true    # Ensure DB is ready
   ADMIN_PASSWORD=yourpass
   ```

2. **Future code changes**:
   ```env
   BUILD_ASSETS=false     # CSS already built
   RUN_MIGRATIONS=false   # No DB changes
   ```

3. **When you add new fields**:
   ```env
   BUILD_ASSETS=false     # No CSS changes
   RUN_MIGRATIONS=true    # Update database
   ```

This way, most deployments will be fast (2-3 min) instead of slow (15 min)!