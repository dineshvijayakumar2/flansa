# Flansa - No-Code Platform for Citizen Developers

## Overview
Flansa is a powerful no-code platform built on Frappe Framework that enables citizen developers to create data-driven applications without writing code.

## Features
- **Multi-Application Support**: Create multiple applications within a single site
- **Visual Table Builder**: Design database tables with drag-and-drop interface
- **Advanced Field Types**: Lookup fields, summary fields, formula fields
- **Public Forms**: Create forms that can be submitted without login
- **Excel Import**: Automatically generate tables from Excel files
- **Relationship Management**: Define relationships between tables
- **Mobile Responsive**: Works on all devices

## Installation

### Prerequisites
- Frappe Bench installed
- Python 3.8+
- MariaDB
- Redis

### Setup
```bash
cd /path/to/frappe-bench
bench get-app flansa /path/to/flansa
bench new-site site-name
bench --site site-name install-app flansa
bench --site site-name migrate
```

## Architecture
Flansa follows a modular architecture:
- **Core Module**: Basic data structures (Application, Table, Field)
- **Builder Module**: Visual building tools
- **Public Module**: Public-facing features like forms

## Multi-Tenancy
Each Frappe site acts as an isolated tenant with its own:
- Database
- Users and permissions
- Applications and data

## License
MIT
