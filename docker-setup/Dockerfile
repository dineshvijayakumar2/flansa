# Frappe + Flansa Docker Image
FROM frappe/erpnext:v15.75.0

# Set working directory
WORKDIR /home/frappe/frappe-bench

# Switch to root for installations
USER root

# Install additional system dependencies
RUN apt-get update && apt-get install -y \
    git \
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

# Switch back to frappe user
USER frappe

# Remove ERPNext completely and install Flansa
RUN if [ -d "apps/erpnext" ]; then rm -rf apps/erpnext; fi \
    && sed -i '/erpnext/d' sites/apps.txt 2>/dev/null || true \
    && git clone https://github.com/dineshvijayakumar2/flansa.git apps/flansa \
    && pip install -e apps/flansa \
    && echo "frappe" > sites/apps.txt \
    && echo "flansa" >> sites/apps.txt

# Copy apps.json for Railway deployment
COPY --chown=frappe:frappe apps.json /home/frappe/frappe-bench/

# Set environment variables
ENV FRAPPE_SITE_NAME=mysite.local
ENV DEVELOPER_MODE=0
ENV ADMIN_PASSWORD=admin123
ENV DB_HOST=mariadb
ENV DB_PORT=3306
ENV DB_NAME=frappe_db
ENV DB_USER=frappe
ENV DB_PASSWORD=frappe123
ENV REDIS_HOST=redis
ENV REDIS_PORT=6379

# Create sites directory and basic site config
RUN mkdir -p sites/mysite.local \
    && echo '{\n "db_name": "frappe_db",\n "db_password": "frappe123",\n "developer_mode": 0\n}' > sites/mysite.local/site_config.json

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD bench --site $FRAPPE_SITE_NAME list-apps || exit 1

# Start script
COPY --chown=frappe:frappe start.sh /home/frappe/frappe-bench/
RUN chmod +x start.sh

CMD ["./start.sh"]