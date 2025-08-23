# Frappe + Flansa Docker Deployment

Production-ready Docker deployment for Frappe with Flansa application.

## 🚀 Quick Start

### Railway Deployment
```bash
# 1. Push to GitHub
git push origin main

# 2. In Railway:
# - Create PostgreSQL service
# - Create Redis service (optional)
# - Create new service from GitHub repo
# - Set environment variables
# - Deploy
```

### Local Development
```bash
# Build and run with docker-compose
docker-compose up --build

# Access at http://localhost:8080
```

## 📁 Essential Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Production Docker configuration |
| `railway-production-v2.sh` | Enhanced Railway startup script with fixes |
| `railway_migration_fix.py` | Railway-specific migration patches |
| `docker-compose.yml` | Local development setup |
| `RAILWAY_DEPLOYMENT.md` | Detailed Railway guide |

## 🔧 Key Features

- **No Database Creation**: Uses `--no-setup-db` for managed databases
- **Auto Redis Detection**: Configures Redis if REDIS_URL is present  
- **Frappe Bug Fix**: Handles db_user configuration issue
- **Railway Service Patches**: Bypasses local service checks for managed services
- **Enhanced Migration**: Multiple fallback strategies for database setup
- **Production Ready**: Pre-built assets, optimized startup
- **Multi-Database**: Works with PostgreSQL and MariaDB

## 🔐 Environment Variables

### Required
```bash
DATABASE_URL=postgresql://user:pass@host:5432/dbname
ADMIN_PASSWORD=secure-admin-password
```

### Optional
```bash
REDIS_URL=redis://user:pass@host:6379
PORT=8080
```

## 🚢 Deployment Platforms

### Railway
- PostgreSQL and Redis services
- Reference variables for credentials
- See `RAILWAY_DEPLOYMENT.md` for details

### AWS ECS
- Build and push to ECR
- Configure with RDS PostgreSQL
- ElastiCache for Redis

### Docker Compose (Local)
- Includes MariaDB and Redis
- Volumes for persistence
- Development mode support

## 🔍 How It Works

1. **Extract Credentials**: From DATABASE_URL
2. **Test Connection**: Verify database access
3. **Create Site**: Using existing database (--no-setup-db)
4. **Install Flansa**: With migrations
5. **Configure**: Set db_user in configs
6. **Start Server**: On specified PORT

## 🐛 Troubleshooting

### Authentication Failed
- Check DATABASE_URL is correct
- Ensure db_user is in site_config.json
- Verify PostgreSQL credentials

### Redis Connection Refused
- Add Redis service if needed
- Check REDIS_URL is set
- Or disable with empty redis_cache config

### Flansa Pages Not Working
- Run migrations: `bench migrate`
- Build assets: `bench build --app flansa`
- Clear cache: `bench clear-cache`

## 📚 Documentation

- [RAILWAY_DEPLOYMENT.md](RAILWAY_DEPLOYMENT.md) - Complete Railway guide
- [Frappe Documentation](https://frappeframework.com)
- [Docker Documentation](https://docs.docker.com)

## 🔒 Security

In production, always:
- Use strong ADMIN_PASSWORD
- Secure database credentials
- Enable HTTPS/TLS
- Regular security updates

## 📝 License

MIT License - See LICENSE file for details