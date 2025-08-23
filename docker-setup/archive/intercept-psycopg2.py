#!/usr/bin/env python3
"""
Intercept and fix psycopg2 connection attempts
This catches the exact point where the wrong user is being used
"""
import os
import sys

# Get the correct user from environment
CORRECT_USER = os.environ.get('PGUSER', 'postgres')
CORRECT_PASSWORD = os.environ.get('PGPASSWORD', '')

print(f"🎯 Intercepting psycopg2 to force user: {CORRECT_USER}", flush=True)

# Import psycopg2 and patch it
import psycopg2

# Store the original connect function
original_connect = psycopg2.connect

def intercepted_connect(*args, **kwargs):
    """Intercept and fix connection parameters"""
    
    # Log what we're receiving
    if kwargs.get('user'):
        print(f"🔧 Intercepted connection attempt with user: {kwargs.get('user')}", flush=True)
    
    # If DSN is provided as first argument
    if args and isinstance(args[0], str):
        dsn = args[0]
        print(f"🔧 Original DSN: {dsn}", flush=True)
        
        # Replace railway user with correct user in DSN
        if 'user=railway' in dsn:
            import re
            # Replace user in DSN
            dsn = re.sub(r'user=railway', f'user={CORRECT_USER}', dsn)
            # Also update password if needed
            if CORRECT_PASSWORD:
                dsn = re.sub(r'password=\S+', f'password={CORRECT_PASSWORD}', dsn)
            
            print(f"🔧 Modified DSN to use user={CORRECT_USER}", flush=True)
            args = (dsn,) + args[1:]
    
    # If user is in kwargs
    if 'user' in kwargs:
        old_user = kwargs['user']
        if old_user == 'railway':
            print(f"🔧 Replacing user 'railway' with '{CORRECT_USER}'", flush=True)
            kwargs['user'] = CORRECT_USER
            # Also update password
            if CORRECT_PASSWORD:
                kwargs['password'] = CORRECT_PASSWORD
    
    # If there's a 'railway' database name and we need a different one
    if 'dbname' in kwargs and kwargs['dbname'] == 'railway':
        # Keep railway as the database name (that's correct)
        pass
    
    try:
        # Try connection with modified parameters
        return original_connect(*args, **kwargs)
    except Exception as e:
        print(f"❌ Connection failed even after interception: {e}", flush=True)
        print(f"   Final kwargs: {kwargs}", flush=True)
        raise

# Replace psycopg2.connect globally
psycopg2.connect = intercepted_connect

print("✅ psycopg2.connect interception active", flush=True)

# Also patch at the psycopg2 module level
sys.modules['psycopg2'].connect = intercepted_connect

print("🚀 Interception complete - all connections will use correct user", flush=True)