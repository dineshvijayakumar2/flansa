// Railway Browser Console: Force show Frappe navbar
// Open Railway site, press F12, go to Console tab, paste and run this

console.log('🔧 Railway Navbar Visibility Fix');

// Step 1: Check if navbar exists in DOM
const navbar = document.querySelector('.navbar');
const header = document.querySelector('header');
const navbarBrand = document.querySelector('.navbar-brand');

console.log('Navbar elements found:', {
    navbar: !!navbar,
    header: !!header, 
    navbarBrand: !!navbarBrand
});

// Step 2: Force show navbar if hidden
if (navbar) {
    navbar.style.display = 'block';
    navbar.style.visibility = 'visible';
    navbar.style.opacity = '1';
    navbar.style.position = 'relative';
    navbar.style.zIndex = '1000';
    console.log('✅ Forced navbar visibility');
} else {
    console.log('❌ Navbar element not found in DOM');
}

// Step 3: Check for and remove hiding CSS
const hideStyles = document.querySelectorAll('style');
hideStyles.forEach(style => {
    if (style.textContent.includes('.navbar') && 
        (style.textContent.includes('display: none') || 
         style.textContent.includes('visibility: hidden'))) {
        console.log('Found hiding CSS:', style.textContent);
        style.remove();
        console.log('✅ Removed navbar hiding CSS');
    }
});

// Step 4: Check for Frappe desk elements
const deskWrapper = document.querySelector('.desk-wrapper');
const layoutMain = document.querySelector('.layout-main');

console.log('Frappe desk elements:', {
    deskWrapper: !!deskWrapper,
    layoutMain: !!layoutMain
});

// Step 5: Force standard Frappe layout if missing
if (!navbar && document.body) {
    console.log('Creating missing navbar structure...');
    
    const newNavbar = document.createElement('nav');
    newNavbar.className = 'navbar navbar-expand navbar-light bg-white sticky-top';
    newNavbar.innerHTML = `
        <div class="container">
            <a class="navbar-brand" href="/app">
                <img class="app-logo" src="/assets/frappe/images/frappe-logo.svg" alt="Logo">
            </a>
            <ul class="navbar-nav ml-auto">
                <li class="nav-item">
                    <a class="nav-link" href="/app">Desk</a>
                </li>
            </ul>
        </div>
    `;
    
    document.body.insertBefore(newNavbar, document.body.firstChild);
    console.log('✅ Created basic navbar structure');
}

// Step 6: Check current page and redirect if needed
if (window.location.pathname.includes('/app/') && !navbar) {
    console.log('On app page but no navbar - might need page reload');
    console.log('Try: window.location.reload()');
}

// Step 7: Check for JavaScript errors that might hide navbar
console.log('Checking for JS errors that might affect navbar...');
window.addEventListener('error', function(e) {
    console.log('JS Error detected:', e.error);
});

console.log('🎉 Navbar fix script completed');
console.log('If navbar still not visible, try:');
console.log('1. Hard refresh (Ctrl+F5)'); 
console.log('2. Check Network tab for failed CSS/JS loads');
console.log('3. Try: document.querySelector("body").innerHTML = ""');
console.log('4. Navigate to /app directly');