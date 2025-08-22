#!/bin/bash
# Debug Railway database credentials
set -e

echo "🔍 Railway Database Credentials Debug"
echo "===================================="

echo "Raw Railway Environment Variables:"
echo "   DATABASE_URL: ${DATABASE_URL}"
echo "   PGUSER: ${PGUSER}"
echo "   PGHOST: ${PGHOST}"
echo "   PGPORT: ${PGPORT}"
echo "   PGPASSWORD: ${PGPASSWORD}"
echo "   PGDATABASE: ${PGDATABASE}"

echo ""
echo "🔍 Parsing DATABASE_URL components:"
if [ -n "$DATABASE_URL" ]; then
    # Extract user from DATABASE_URL
    URL_USER=$(echo $DATABASE_URL | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    echo "   User from DATABASE_URL: '$URL_USER'"
    
    # Extract password from DATABASE_URL
    URL_PASSWORD=$(echo $DATABASE_URL | sed -n 's/.*:\/\/[^:]*:\([^@]*\)@.*/\1/p')
    echo "   Password from DATABASE_URL: '${URL_PASSWORD}'"
    
    # Extract host from DATABASE_URL
    URL_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
    echo "   Host from DATABASE_URL: '$URL_HOST'"
    
    # Extract port from DATABASE_URL
    URL_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    echo "   Port from DATABASE_URL: '$URL_PORT'"
    
    # Extract database from DATABASE_URL
    URL_DB=$(echo $DATABASE_URL | sed -n 's/.*\/\(.*\)$/\1/p')
    echo "   Database from DATABASE_URL: '$URL_DB'"
else
    echo "   DATABASE_URL is empty!"
fi

echo ""
echo "🔍 Credential Comparison:"
echo "   PGUSER vs URL_USER: '$PGUSER' vs '$URL_USER'"
echo "   PGPASSWORD vs URL_PASSWORD: '$PGPASSWORD' vs '$URL_PASSWORD'"
echo "   PGHOST vs URL_HOST: '$PGHOST' vs '$URL_HOST'"

if [ "$PGUSER" != "$URL_USER" ]; then
    echo "   ⚠️  USER MISMATCH!"
fi

if [ "$PGPASSWORD" != "$URL_PASSWORD" ]; then
    echo "   ⚠️  PASSWORD MISMATCH!"
fi

if [ "$PGHOST" != "$URL_HOST" ]; then
    echo "   ⚠️  HOST MISMATCH!"
fi

echo ""
echo "🧪 Testing connection with different user combinations:"

# Test with DATABASE_URL user
echo "🧪 Testing with DATABASE_URL credentials..."
PGPASSWORD="$URL_PASSWORD" psql -h "$URL_HOST" -p "$URL_PORT" -U "$URL_USER" -d "$URL_DB" -c "SELECT 1;" 2>&1 | head -5 || echo "❌ DATABASE_URL credentials failed"

# Test with environment variables
echo "🧪 Testing with environment variable credentials..."
PGPASSWORD="$PGPASSWORD" psql -h "$PGHOST" -p "$PGPORT" -U "$PGUSER" -d "${PGDATABASE:-railway}" -c "SELECT 1;" 2>&1 | head -5 || echo "❌ Environment variable credentials failed"

# Test connecting to postgres database (default)
echo "🧪 Testing connection to 'postgres' database..."
PGPASSWORD="$URL_PASSWORD" psql -h "$URL_HOST" -p "$URL_PORT" -U "$URL_USER" -d "postgres" -c "SELECT 1;" 2>&1 | head -5 || echo "❌ Connection to postgres database failed"

# List available databases if we can connect
echo "🧪 Trying to list databases..."
PGPASSWORD="$URL_PASSWORD" psql -h "$URL_HOST" -p "$URL_PORT" -U "$URL_USER" -d "postgres" -c "\l" 2>&1 | head -10 || echo "❌ Could not list databases"