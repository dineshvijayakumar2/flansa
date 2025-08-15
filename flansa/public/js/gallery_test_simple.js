// Simple Gallery Test - Minimal approach
console.log('🧪 Gallery Test Simple - File loaded successfully!');

// Test 1: Basic frappe availability
console.log('frappe available:', typeof frappe !== 'undefined');

// Test 2: Wait for frappe to be fully ready
$(document).ready(function() {
    console.log('🚀 Document ready - frappe available:', typeof frappe !== 'undefined');
    
    if (typeof frappe !== 'undefined' && frappe.ui && frappe.ui.form) {
        console.log('✅ frappe.ui.form is available');
        
        // Simple form hook test
        frappe.ui.form.on('*', {
            refresh: function(frm) {
                console.log('🎯 FORM REFRESH CALLED!', frm.doctype);
                test_gallery_detection(frm);
            }
        });
        
        // Also try to detect existing form
        setTimeout(function() {
            if (typeof cur_frm !== 'undefined' && cur_frm) {
                console.log('🔍 Found existing form:', cur_frm.doctype);
                console.log('🎯 MANUALLY TRIGGERING GALLERY TEST!');
                test_gallery_detection(cur_frm);
            } else {
                console.log('❌ No current form found (cur_frm not available)');
                console.log('   Make sure you are on a DocType form page (not list view)');
            }
        }, 1000);
        
        console.log('✅ Form hook registered successfully');
    } else {
        console.log('❌ frappe.ui.form not available');
    }
});

function test_gallery_detection(frm) {
    if (!frm) {
        console.log('❌ No form provided to test_gallery_detection');
        return;
    }
    
    console.log('🔍 Testing gallery detection on form:', frm.doctype);
    
    // Look for Long Text fields
    let longTextFields = frm.meta.fields.filter(f => f.fieldtype === 'Long Text');
    console.log(`📝 Found ${longTextFields.length} Long Text fields:`, longTextFields.map(f => f.fieldname));
    
    // Look for gallery fields specifically
    longTextFields.forEach(field => {
        console.log(`🔍 Checking field ${field.fieldname}:`);
        console.log(`   - Label: ${field.label}`);
        console.log(`   - Has description: ${!!field.description}`);
        
        if (field.description) {
            console.log(`   - Description preview: ${field.description.substring(0, 100)}...`);
            console.log(`   - Contains 'is_gallery': ${field.description.includes('is_gallery')}`);
            
            if (field.description.includes('is_gallery')) {
                console.log('🖼️ GALLERY FIELD FOUND:', field.fieldname);
                
                // Add a simple test enhancement
                try {
                    const $field = frm.get_field(field.fieldname).$wrapper;
                    if ($field && $field.length) {
                        if (!$field.find('.gallery-test-marker').length) {
                            $field.append('<div class="gallery-test-marker" style="color: red; font-weight: bold; padding: 10px; background: yellow; border: 2px solid red; margin: 5px;">🎯 GALLERY FIELD DETECTED!</div>');
                            console.log('✅ Visual marker added to gallery field');
                        } else {
                            console.log('✅ Visual marker already exists');
                        }
                    } else {
                        console.log('❌ Could not find field wrapper for', field.fieldname);
                    }
                } catch (e) {
                    console.log('❌ Error adding visual marker:', e);
                }
            }
        }
    });
    
    console.log('🏁 Gallery detection test complete');
}

console.log('🏁 Gallery Test Simple - Setup complete');