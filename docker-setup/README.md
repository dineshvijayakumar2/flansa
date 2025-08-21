# Frappe + Flansa Docker Setup

This Docker configuration provides a complete setup for running Frappe with the Flansa app.

## Quick Start

### 1. Build and Run
```bash
# Clone or navigate to this directory
cd /home/ubuntu/frappe-bench/docker-setup

# Build and start services
docker-compose up --build

# Access the application
# Homepage: http://localhost:8000/app/flansa
# Login: Administrator / admin123
```

### 2. Development Mode
```bash
# For development with hot reloading
DEVELOPER_MODE=1 docker-compose up --build
```

## Services

- **frappe-flansa**: Main application (Port 8080, internal 8000)
- **mariadb**: Database (Port 3307, internal 3306) 
- **redis**: Cache (Port 6380, internal 6379)

## Configuration

### Environment Variables
Copy `.env.example` to `.env` and modify:

```bash
cp .env.example .env
# Edit .env with your settings
```

### Key Settings
- `FRAPPE_SITE_NAME`: Site name (default: mysite.local)
- `ADMIN_PASSWORD`: Admin password (default: admin123)
- `DB_PASSWORD`: Database password
- `DEVELOPER_MODE`: Enable for development (0/1)

## Access Points

### Application
- **Homepage**: http://localhost:8080/app/flansa
- **Admin**: http://localhost:8080/app/flansa (Login: Administrator)

### Flansa Features
- **Flansa Workspace**: Main tenant management
- **Switch Tenant**: Multi-tenant switching
- **Register Tenant**: New tenant creation  
- **Database Viewer**: System database access

## Database Access

### Via Docker
```bash
docker-compose exec mariadb mysql -u frappe -pfrappe123 frappe_db
```

### Via Host (if port exposed)
```bash
mysql -h localhost -P 3307 -u frappe -pfrappe123 frappe_db
```

## Troubleshooting

### Check Services
```bash
# View logs
docker-compose logs -f frappe-flansa

# Check service status
docker-compose ps

# Restart services
docker-compose restart
```

### Database Issues
```bash
# Reset database
docker-compose down -v
docker-compose up --build
```

### Build Issues
```bash
# Clean build
docker-compose down
docker system prune -f
docker-compose build --no-cache
```

## Data Persistence

Volumes are created for:
- `mariadb_data`: Database files
- `redis_data`: Cache data
- `frappe_sites`: Site configurations
- `frappe_logs`: Application logs

## Production Deployment

For Railway.com deployment:
1. Use the Dockerfile
2. Set environment variables in Railway
3. Configure database service
4. Update ADMIN_PASSWORD and security keys

## Health Checks

Services include health checks:
- MariaDB: Database connectivity
- Redis: Cache availability  
- Frappe: Application responsiveness

## Security Notes

**Change these in production:**
- ADMIN_PASSWORD
- DB_PASSWORD  
- SECRET_KEY
- ENCRYPTION_KEY