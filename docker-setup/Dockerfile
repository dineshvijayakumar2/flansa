# Production Dockerfile for Frappe + Flansa
# Works with Railway, AWS ECS, and other container platforms
FROM frappe/bench:latest

USER root

# Install PostgreSQL client for database operations
RUN apt-get update && apt-get install -y \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

USER frappe
WORKDIR /home/frappe

# Initialize bench with Frappe v15
RUN bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench

WORKDIR /home/frappe/frappe-bench

# Install production dependencies
RUN pip install gunicorn

# Get Flansa app from GitHub
RUN bench get-app https://github.com/dineshvijayakumar2/flansa.git

# Pre-build assets to reduce startup time
RUN bench build --app frappe || true && \
    bench build --app flansa || true

# Copy production startup script (v2 with Railway fixes)
COPY --chown=frappe:frappe railway-production-v2.sh ./start.sh
COPY --chown=frappe:frappe railway_migration_fix.py ./railway_migration_fix.py
RUN chmod +x start.sh && chmod +x railway_migration_fix.py

# Expose port (will be overridden by environment)
EXPOSE 8080

# Force rebuild trigger - PostgreSQL database viewer fix
ENV REBUILD_TRIGGER=v4_postgres_dbviewer_fix

# Start the application
CMD ["./start.sh"]