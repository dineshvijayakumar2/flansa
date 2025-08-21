# Frappe + Flansa Docker Deployment Guide

## Overview
This guide covers local testing and Railway.com deployment of Frappe with Flansa app.

## Local Testing

### Prerequisites
- Docker and Docker Compose installed
- Git access to Flansa repository
- At least 4GB RAM for containers

### Quick Start
```bash
# Navigate to docker setup
cd /home/ubuntu/frappe-bench/docker-setup

# Build and start services
docker-compose up --build

# Access application
open http://localhost:8000/app/flansa
```

### Build Options

#### Option 1: Full ERPNext Base (Dockerfile)
```bash
docker build -t frappe-flansa:latest .
```

#### Option 2: Simple Bench Base (Dockerfile.simple) 
```bash
docker build -f Dockerfile.simple -t frappe-flansa-simple:latest .
```

### Local Testing Commands
```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f frappe-flansa

# Shell access
docker-compose exec frappe-flansa bash

# Database access
docker-compose exec mariadb mysql -u frappe -pfrappe123 frappe_db

# Stop services
docker-compose down

# Clean restart
docker-compose down -v && docker-compose up --build
```

## Railway.com Deployment

### 1. Repository Setup
```bash
# Create deployment repository
git init flansa-docker
cd flansa-docker

# Copy Docker files
cp /path/to/docker-setup/* .

# Commit to Git
git add .
git commit -m "Initial Frappe+Flansa Docker setup"
git remote add origin <your-railway-repo-url>
git push origin main
```

### 2. Railway Configuration

#### Environment Variables
Set in Railway dashboard:
```
FRAPPE_SITE_NAME=your-site.railway.app
ADMIN_PASSWORD=your-secure-password
DB_PASSWORD=your-db-password
SECRET_KEY=your-secret-key
ENCRYPTION_KEY=your-encryption-key
DEVELOPER_MODE=0
```

#### Services Required
1. **Web Service**: Frappe+Flansa app
2. **Database**: PostgreSQL or MySQL add-on
3. **Cache**: Redis add-on

### 3. Railway Dockerfile
Create `railway.Dockerfile`:
```dockerfile
# Use the simple version for Railway
FROM frappe/bench:latest

WORKDIR /home/frappe/frappe-bench
USER root

# Install dependencies
RUN apt-get update && apt-get install -y git curl netcat-traditional && rm -rf /var/lib/apt/lists/*

USER frappe

# Clone Flansa
RUN bench init --skip-redis-config-generation . && cd apps && git clone https://github.com/dineshvijayakumar2/flansa.git flansa

# Copy start script
COPY start.sh .
RUN chmod +x start.sh

EXPOSE 8000
CMD ["./start.sh"]
```

### 4. Railway Start Script
Update for Railway environment:
```bash
#!/bin/bash
set -e

# Railway provides DATABASE_URL and REDIS_URL
export DB_HOST=$(echo $DATABASE_URL | cut -d'@' -f2 | cut -d':' -f1)
export DB_PORT=$(echo $DATABASE_URL | cut -d':' -f4 | cut -d'/' -f1)
export REDIS_HOST=$(echo $REDIS_URL | cut -d'@' -f2 | cut -d':' -f1)

# Use Railway's PORT variable
export PORT=${PORT:-8000}

# Site setup and start
bench new-site $FRAPPE_SITE_NAME --mariadb-root-password $DB_PASSWORD --admin-password $ADMIN_PASSWORD
bench --site $FRAPPE_SITE_NAME install-app flansa
bench serve --host 0.0.0.0 --port $PORT
```

## Production Considerations

### Security
- Change all default passwords
- Use environment variables for secrets
- Enable HTTPS (Railway provides SSL)
- Set up proper backup strategy

### Performance
```dockerfile
# Add to Dockerfile for production
ENV FRAPPE_WORKERS=4
ENV FRAPPE_TIMEOUT=300
```

### Monitoring
```yaml
# Add to docker-compose.yml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/api/method/ping"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 180s
```

### Backup Strategy
```bash
# Database backup
docker-compose exec mariadb mysqldump -u frappe -pfrappe123 frappe_db > backup.sql

# Files backup
docker-compose exec frappe-flansa tar -czf /tmp/sites-backup.tar.gz sites/
docker cp container_name:/tmp/sites-backup.tar.gz ./
```

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean Docker cache
docker system prune -a

# Rebuild without cache
docker-compose build --no-cache
```

#### Database Connection
```bash
# Check database logs
docker-compose logs mariadb

# Test connection
docker-compose exec frappe-flansa ping mariadb
```

#### Permission Issues
```bash
# Fix file permissions
docker-compose exec frappe-flansa chown -R frappe:frappe /home/frappe/frappe-bench
```

### Logs and Debugging
```bash
# Application logs
docker-compose logs frappe-flansa

# Database logs  
docker-compose logs mariadb

# Interactive debugging
docker-compose exec frappe-flansa bash
```

## Testing Checklist

### Local Testing
- [ ] Services start without errors
- [ ] Database connection established
- [ ] Flansa workspace accessible
- [ ] Admin login works
- [ ] Tenant management functions
- [ ] Database viewer operational

### Production Testing
- [ ] SSL certificate valid
- [ ] Environment variables set
- [ ] Database backups working
- [ ] Performance monitoring
- [ ] Error logging configured

## Support

### Resources
- Frappe Documentation: https://frappeframework.com/docs
- Railway Documentation: https://docs.railway.app
- Flansa Repository: https://github.com/dineshvijayakumar2/flansa

### Common Commands
```bash
# Site management
bench --site mysite.local migrate
bench --site mysite.local clear-cache
bench --site mysite.local backup

# App management
bench install-app flansa
bench --site mysite.local install-app flansa
bench update --reset
```

---
**Status**: Ready for deployment after successful local testing