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

# Skip asset building during Docker build (OOM issues in Railway)
# Assets will be built at runtime when BUILD_ASSETS=true
RUN echo "Assets will be built at runtime to avoid memory issues"

# Copy production startup script (smart version)
COPY --chown=frappe:frappe railway-smart-start.sh ./start.sh
RUN chmod +x start.sh

# Expose port (will be overridden by environment)
EXPOSE 8080

# Deployment version - increment for changes
ENV DEPLOYMENT_VERSION=v8_smart_deployment_active

# Start the application
CMD ["./start.sh"]