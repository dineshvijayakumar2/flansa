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

# Copy production startup script
COPY --chown=frappe:frappe railway-production.sh ./start.sh
RUN chmod +x start.sh

# Expose port (will be overridden by environment)
EXPOSE 8080

# Start the application
CMD ["./start.sh"]