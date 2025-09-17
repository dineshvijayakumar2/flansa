# Flansa - Enterprise No-Code Platform for Citizen Developers

## 🚀 Overview
Flansa is an enterprise-grade no-code platform built on the Frappe Framework that empowers citizen developers to create sophisticated data-driven applications without writing code. Designed for multi-tenant SaaS deployment with AWS integration.

## ✨ Core Features

### 📊 Application Building
- **Multi-Application Support**: Create unlimited applications within workspaces
- **Visual Table Builder**: Design database tables with intuitive drag-and-drop interface
- **Dynamic DocType Generation**: Automatic Frappe DocType creation for seamless integration
- **Excel/CSV Import**: Instantly generate tables from spreadsheets with auto-field detection
- **Mobile Responsive**: Fully responsive design for all devices

### 🔧 Advanced Field System
- **FlansaLogic Engine**: Unified calculation engine with zero cold start
- **Logic Fields**: Dynamic calculations, lookups, conditions, and formulas
- **Field Types**: 15+ field types including Text, Number, Date, Dropdown, File, Link, Checkbox
- **Relationship Management**: One-to-many and many-to-many relationships
- **Summary Fields**: Aggregate calculations across related records
- **Virtual Fields**: Computed fields without database storage

### 🎨 User Experience
- **Record Viewer**: Clean, modern interface for data management
- **Gallery View**: Visual card-based data presentation
- **Grid View**: Spreadsheet-like data editing
- **Report Builder**: Visual report creation with filters and aggregations
- **Public Forms**: Embeddable forms for external data collection
- **Custom Views**: Save and share filtered data views

### 🏢 Multi-Tenant Architecture
- **Workspace Isolation**: Complete data separation between tenants
- **Dynamic Workspace Resolution**: Automatic tenant context from domain/subdomain
- **Tenant-Specific Configuration**: Per-workspace customization
- **Resource Limits**: Configurable limits per workspace (users, tables, storage)

### ☁️ AWS S3 Integration (Production-Ready)
- **Organized File Storage**: Multi-tenant S3 structure with workspace isolation
- **Smart Organization**: `workspace/attachments/table_id/year/month/` hierarchy
- **Automatic S3 Upload**: Seamless file storage with presigned URLs
- **S3 Deletion**: Automatic cleanup when files are removed
- **URL Encoding Support**: Handles special characters and spaces correctly
- **Migration Tools**: Convert existing flat structure to organized hierarchy

## 🏗️ Architecture

### Core Modules
```
flansa/
├── flansa_core/          # Core business logic
│   ├── api/              # API endpoints
│   ├── doctype/          # Flansa DocTypes
│   ├── page/             # UI pages
│   ├── s3_integration/   # AWS S3 handling
│   └── workspace_service.py  # Multi-tenant management
├── flansa_public/        # Public-facing features
├── aws-fixes/            # AWS deployment utilities
└── hooks.py              # Frappe integration hooks
```

### Key Components
- **FlansaLogic Engine**: Virtual field calculation system
- **Workspace Service**: Multi-tenant context management
- **S3 Integration**: Production-ready file storage
- **Dynamic DocType System**: Runtime table generation
- **Field Management**: Advanced field type handling

## 🚀 Deployment

### Local Development
```bash
cd /path/to/frappe-bench
bench get-app https://github.com/dineshvijayakumar2/flansa.git
bench new-site mysite.local
bench --site mysite.local install-app flansa
bench --site mysite.local migrate
bench start
```

### AWS ECS Deployment
```bash
# SSH into ECS container
~/aws-ecs-connect.sh

# Update from GitHub
cd /home/frappe/frappe-bench/apps/flansa
git pull origin main
bench --site flansa.local clear-cache
bench --site flansa.local migrate
supervisorctl restart frappe:
```

### S3 Configuration
```json
{
  "use_s3": 1,
  "s3_bucket": "your-bucket",
  "s3_folder_path": "flansa-files",
  "aws_access_key_id": "YOUR_KEY",
  "aws_secret_access_key": "YOUR_SECRET",
  "aws_s3_region_name": "us-east-1"
}
```

## 📋 Current Implementation Status

### ✅ Completed Features
- Multi-workspace/tenant architecture
- Complete CRUD operations for applications, tables, and fields
- FlansaLogic calculation engine with virtual fields
- AWS S3 integration with organized folder structure
- Dynamic DocType generation and synchronization
- Record viewer with attachment support
- Gallery and grid views
- Report builder with saved reports
- Public form functionality
- Excel/CSV import with auto-field detection
- Relationship management (1-to-many, many-to-many)
- Field conversion and migration utilities
- Workspace context resolution from domain

### 🔄 In Progress
- Performance optimizations for large datasets
- Advanced permission system
- Workflow automation
- API documentation

### 📅 Planned Features
- Webhook integrations
- Advanced automation rules
- Template marketplace
- Mobile app
- Real-time collaboration
- Advanced analytics dashboard

## 🛠️ Development Tools

### Useful Scripts (aws-fixes/)
- `migrate_all_s3_files_robust.py` - Migrate files to organized S3 structure
- `test_improved_s3_structure.py` - Validate S3 folder organization
- `debug_s3_deletion_issues.py` - Troubleshoot S3 deletion
- `test_upload_api_with_new_structure.py` - Verify upload API

### Bench Commands
```bash
# Console access
bench --site mysite.local console

# Clear cache after changes
bench --site mysite.local clear-cache

# Run migrations
bench --site mysite.local migrate

# Execute scripts
exec(open('/path/to/script.py').read())
```

## 📚 Technical Stack
- **Framework**: Frappe v15
- **Backend**: Python 3.11
- **Database**: MariaDB/PostgreSQL
- **Cache**: Redis
- **File Storage**: AWS S3
- **Deployment**: Docker/AWS ECS
- **Frontend**: Vue.js (Frappe UI)

## 🔒 Security Features
- Row-level security through workspace isolation
- Encrypted S3 storage with IAM policies
- Presigned URLs for secure file access
- SQL injection prevention
- XSS protection
- CSRF tokens

## 📝 License
MIT

## 🤝 Contributing
Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## 📧 Support
For issues and feature requests, please use the GitHub issue tracker.

---
Built with ❤️ on Frappe Framework | Deployed on AWS