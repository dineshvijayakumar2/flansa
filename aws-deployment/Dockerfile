# AWS App Runner Optimized Frappe + Flansa Dockerfile  
# Based on proven Railway setup with AWS adaptations
FROM frappe/bench:latest

USER root

# Install system dependencies (reusing Railway's proven setup)
RUN apt-get update && apt-get install -y \
    git \
    curl \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

USER frappe
WORKDIR /home/frappe

# Initialize bench and get apps (same as Railway)
RUN bench init --skip-redis-config-generation --frappe-branch version-15 frappe-bench
WORKDIR /home/frappe/frappe-bench

# Install gunicorn for production server (same as Railway)
RUN pip install gunicorn

# Get Flansa app (same as Railway)
RUN bench get-app https://github.com/dineshvijayakumar2/flansa.git

# Pre-build assets during Docker build (same as Railway approach)
RUN echo "🔨 Pre-building assets during Docker build..." && \
    bench build --app frappe || echo "⚠️ Frappe pre-build failed, will retry at startup" && \
    bench build --app flansa || echo "⚠️ Flansa pre-build failed, will retry at startup"

# Copy AWS startup script (adapted from railway-start.sh)
COPY --chown=frappe:frappe aws-start.sh ./start.sh
RUN chmod +x start.sh

# Environment variables (adapted from Railway)
ENV ADMIN_PASSWORD=${ADMIN_PASSWORD:-admin123}
ENV DEVELOPER_MODE=${DEVELOPER_MODE:-0}
ENV AWS_REGION=${AWS_REGION:-us-east-1}

# AWS App Runner uses PORT environment variable
EXPOSE ${PORT:-8000}

CMD ["./start.sh"]