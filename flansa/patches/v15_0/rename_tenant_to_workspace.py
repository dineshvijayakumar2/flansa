
import frappe

def execute():
    """Migrate tenant_id fields to workspace_id"""
    
    # List of DocTypes that have tenant_id field
    doctypes_to_migrate = [
        "Flansa Application",
        "Flansa Table", 
        "Flansa Relationship",
        "Flansa Saved Report",
        "Flansa Form Config",
        "Flansa Logic Field",
        "Flansa Computed Field",
        "Flansa Workspace User"
    ]
    
    for doctype in doctypes_to_migrate:
        try:
            table_name = f"tab{doctype}"
            
            # Check if table exists and has tenant_id column
            if frappe.db.table_exists(table_name):
                columns = frappe.db.sql("""
                    SELECT COLUMN_NAME 
                    FROM INFORMATION_SCHEMA.COLUMNS 
                    WHERE TABLE_NAME = %s AND COLUMN_NAME = 'tenant_id'
                    AND TABLE_SCHEMA = DATABASE()
                """, (table_name,))
                
                if columns:
                    # Rename the column
                    print(f"Renaming tenant_id to workspace_id in {doctype}")
                    frappe.db.sql(f"""
                        ALTER TABLE `{table_name}` 
                        CHANGE COLUMN `tenant_id` `workspace_id` VARCHAR(140)
                    """)
                    
        except Exception as e:
            print(f"Error migrating {doctype}: {e}")
            
    print("Migration completed: tenant_id -> workspace_id")
