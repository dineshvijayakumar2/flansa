-- Railway PostgreSQL: Check navbar and workspace settings
-- Run these in Railway PostgreSQL console

-- Step 1: Check navbar settings
SELECT * FROM "tabSingles" WHERE doctype = 'Navbar Settings';

-- Step 2: Check if navbar is hidden (look for hide_navbar field)
SELECT doctype, field, value FROM "tabSingles" 
WHERE doctype = 'Navbar Settings' AND field LIKE '%navbar%';

-- Step 3: Enable navbar if hidden (set hide_navbar = 0)
UPDATE "tabSingles" SET value = '0' 
WHERE doctype = 'Navbar Settings' AND field = 'hide_navbar';

-- Step 4: Check website settings that affect navbar
SELECT field, value FROM "tabSingles" 
WHERE doctype = 'Website Settings' 
AND field IN ('app_logo', 'brand_html', 'navbar_template');

-- Step 5: Check Flansa workspace visibility
SELECT name, title, is_hidden, public FROM "tabWorkspace" WHERE name = 'Flansa';

-- Step 6: Make Flansa workspace visible if hidden
UPDATE "tabWorkspace" SET is_hidden = 0, public = 1 WHERE name = 'Flansa';

-- Step 7: Check user permissions for current user
SELECT parent, role FROM "tabHas Role" WHERE parent = 'Administrator';

-- Step 8: Check all system settings that might affect navbar
SELECT doctype, field, value FROM "tabSingles" 
WHERE (field LIKE '%navbar%' OR field LIKE '%header%' OR field LIKE '%menu%')
AND value IS NOT NULL;