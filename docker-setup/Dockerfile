# Railway-Optimized Frappe + Flansa Dockerfile
FROM frappe/bench:latest

USER root

# Install system dependencies for Railway
RUN apt-get update && apt-get install -y \
    git \
    curl \
    netcat-traditional \
    postgresql-client \
    dnsutils \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

USER frappe
WORKDIR /home/frappe

# Initialize bench and get apps
RUN bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
WORKDIR /home/frappe/frappe-bench

# Install gunicorn for production server
RUN pip install gunicorn

# Get Flansa app
RUN bench get-app https://github.com/dineshvijayakumar2/flansa.git

# Pre-build assets during Docker build to reduce startup time
RUN echo "🔨 Pre-building assets during Docker build..."
RUN bench build --app frappe || echo "⚠️  Frappe pre-build failed, will retry at startup"
RUN bench build --app flansa || echo "⚠️  Flansa pre-build failed, will retry at startup"

# Copy startup script
COPY --chown=frappe:frappe railway-start.sh ./start.sh
RUN chmod +x start.sh

# Environment variables
ENV FRAPPE_SITE_NAME=${RAILWAY_PUBLIC_DOMAIN:-mysite.railway.app}
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
ENV DEVELOPER_MODE=${DEVELOPER_MODE:-0}

# Railway automatically provides these via DATABASE_URL and REDIS_URL
ENV DB_HOST=${MYSQLHOST:-mysql}
ENV DB_PORT=${MYSQLPORT:-3306}
ENV DB_NAME=${MYSQLDATABASE:-frappe}
ENV DB_USER=${MYSQLUSER:-root}
ENV DB_PASSWORD=${MYSQLPASSWORD}
ENV REDIS_HOST=${REDISHOST:-redis}
ENV REDIS_PORT=${REDISPORT:-6379}

EXPOSE ${PORT:-8000}

CMD ["./start.sh"]