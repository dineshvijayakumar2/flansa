#!/bin/bash
# PostgreSQL Schema Fix for Railway - Add missing tenant_id columns

echo "🔧 RAILWAY POSTGRESQL SCHEMA FIX"
echo "Adding missing tenant_id columns to Flansa tables"
echo "================================================="

# Get database connection details from environment
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-frappe}
DB_NAME=${DB_NAME:-flansa}

echo "📋 Database: $DB_NAME on $DB_HOST:$DB_PORT"

# Connect to PostgreSQL and fix schema
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" << 'EOF'

-- Fix missing tenant_id columns
DO $$
DECLARE
    table_name TEXT;
    tables_to_fix TEXT[] := ARRAY[
        'tabFlansa Table',
        'tabFlansa Application', 
        'tabFlansa Field',
        'tabFlansa Logic Field',
        'tabFlansa Relationship',
        'tabFlansa Saved Report',
        'tabFlansa Form Config'
    ];
BEGIN
    FOREACH table_name IN ARRAY tables_to_fix
    LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = table_name) THEN
            -- Check if tenant_id column exists
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_name = table_name 
                AND column_name = 'tenant_id'
            ) THEN
                EXECUTE format('ALTER TABLE %I ADD COLUMN tenant_id VARCHAR(140)', table_name);
                RAISE NOTICE '✅ Added tenant_id column to %', table_name;
            ELSE
                RAISE NOTICE '⚠️  Column tenant_id already exists in %', table_name;
            END IF;
            
            -- Add index for better performance
            EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I (tenant_id)', 
                          'idx_' || replace(lower(table_name), ' ', '_') || '_tenant', 
                          table_name);
        ELSE
            RAISE NOTICE '❌ Table % does not exist', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🎉 Schema fix completed!';
END $$;

-- Update any existing records with default tenant_id
UPDATE "tabFlansa Table" SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE "tabFlansa Application" SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE "tabFlansa Logic Field" SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE "tabFlansa Relationship" SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE "tabFlansa Saved Report" SET tenant_id = 'default' WHERE tenant_id IS NULL;
UPDATE "tabFlansa Form Config" SET tenant_id = 'default' WHERE tenant_id IS NULL;

-- Show final status
SELECT 
    schemaname,
    tablename,
    attname as column_name,
    typname as column_type
FROM pg_attribute 
JOIN pg_class ON pg_class.oid = pg_attribute.attrelid 
JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace 
JOIN pg_type ON pg_type.oid = pg_attribute.atttypid 
WHERE pg_attribute.attnum > 0 
    AND NOT pg_attribute.attisdropped 
    AND pg_namespace.nspname = 'public'
    AND pg_class.relname LIKE 'tab%Flansa%'
    AND pg_attribute.attname = 'tenant_id'
ORDER BY tablename;

EOF

echo "✅ PostgreSQL schema fix completed!"