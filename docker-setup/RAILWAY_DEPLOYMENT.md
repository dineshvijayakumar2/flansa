# Railway Deployment Guide for Flansa

## Overview
This guide documents the production deployment of Flansa (Frappe-based application) on Railway.

## Prerequisites

### Railway Services Required:
1. **PostgreSQL Database**
2. **Redis** (optional but recommended for background jobs)
3. **Flansa Application** (Docker deployment)

## Setup Instructions

### 1. PostgreSQL Service Setup

Create a PostgreSQL service in Railway with these settings:

```
Service Name: postgres (or your choice)
Template: PostgreSQL
```

**Important Variables:**
- `PGDATABASE`: Will be auto-generated (usually "railway")
- `PGUSER`: Will be auto-generated (usually "postgres")
- `PGPASSWORD`: Auto-generated secure password
- `DATABASE_URL`: Auto-generated connection string

### 2. Redis Service Setup (Optional)

Create a Redis service in Railway:

```
Service Name: redis (or your choice)
Template: Redis
```

**Variables:**
- `REDIS_URL`: Auto-generated with authentication

### 3. Flansa Application Setup

Create a new service for Flansa:

```
Service Name: flansa
Source: GitHub Repository
Branch: railway-fresh (or main with docker-setup)
```

### 4. Environment Variables

In your Flansa service, add these **reference variables** (not regular variables):

```bash
# PostgreSQL References (link to Postgres service)
DATABASE_URL=${{postgres.DATABASE_URL}}
PGHOST=${{postgres.PGHOST}}
PGPORT=${{postgres.PGPORT}}
PGUSER=${{postgres.PGUSER}}
PGPASSWORD=${{postgres.PGPASSWORD}}
PGDATABASE=${{postgres.PGDATABASE}}

# Redis Reference (if using Redis)
REDIS_URL=${{redis.REDIS_URL}}

# Application Settings
ADMIN_PASSWORD=your-secure-admin-password
PORT=8080
```

**Note:** Replace `postgres` and `redis` with your actual service names if different.

### 5. Railway Configuration

In your Flansa service settings:

1. **Build Command:** (leave empty - Dockerfile handles it)
2. **Start Command:** (leave empty - Dockerfile CMD handles it)
3. **Root Directory:** `/docker-setup`
4. **Dockerfile Path:** `./Dockerfile.production`

## How It Works

### Key Concepts:

1. **No Database Creation**: Uses `--no-setup-db` flag
   - Railway's PostgreSQL already exists
   - We only create Frappe/Flansa tables inside it
   - Avoids permission and password conflicts

2. **Credential Management**:
   - Extracts credentials from `DATABASE_URL`
   - Sets `db_user` in config (fixes Frappe bug)
   - Uses Railway's actual passwords

3. **Redis Integration**:
   - Automatically detects `REDIS_URL`
   - Configures three Redis databases (cache, queue, socketio)
   - Falls back gracefully if Redis unavailable

## Troubleshooting

### Common Issues:

1. **Authentication Failed for User "railway"**
   - Ensure `db_user` is in site_config.json
   - Check that PGUSER matches actual database user

2. **Duplicate Module Def Error**
   - Flansa was partially installed
   - Use `--force` flag on install
   - Run migrations with `--skip-failing`

3. **Redis Connection Refused**
   - Add Redis service to Railway
   - Ensure REDIS_URL reference is set

4. **Transaction Errors**
   - Disable developer_mode in production
   - Ensure migrations have run
   - Clear cache after deployment

## Production Script Flow

The `railway-production.sh` script:

1. **Extracts credentials** from DATABASE_URL
2. **Tests connections** to PostgreSQL (and Redis if available)
3. **Creates site** with `--no-setup-db` (first run only)
4. **Installs Flansa** application
5. **Runs migrations** to sync database
6. **Updates configurations** with correct credentials
7. **Builds assets** for production
8. **Starts server** on specified PORT

## Files

- `railway-production.sh`: Clean production startup script
- `Dockerfile.production`: Optimized Docker configuration
- `RAILWAY_DEPLOYMENT.md`: This documentation

## Key Learnings

1. **Frappe Bug**: Uses `db_name` as user if `db_user` not specified
2. **Railway Specifics**: Can't drop/create system databases
3. **--no-setup-db**: Essential for managed databases
4. **Reference Variables**: Use `${{service.VARIABLE}}` syntax
5. **Password Management**: Must use Railway's actual passwords

## Support

For issues or questions:
- Check Railway logs for detailed error messages
- Ensure all environment variables are set correctly
- Verify PostgreSQL and Redis services are running
- Run migrations if DocTypes are missing