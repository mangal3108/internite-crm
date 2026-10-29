#!/bin/bash
# Internite CRM Hostinger VPS Deployment Script
# Run this on your Hostinger VPS after uploading files

set -e

APP_DIR="/home/internite"
BACKEND_JAR="internite-crm-backend-1.0.0.jar"

echo "=== Internite CRM Deployment Setup ==="

# 1. Install Java 17 if not present
if ! java -version 2>&1 | grep -q "17"; then
    echo "Installing Java 17..."
    sudo apt update
    sudo apt install -y openjdk-17-jre-headless
fi

# 2. Create app directory
sudo mkdir -p $APP_DIR
sudo mkdir -p $APP_DIR/backend
sudo mkdir -p $APP_DIR/frontend

# 3. Create environment file
cat > $APP_DIR/backend/.env << 'ENVEOF'
# ─── Internite CRM Production Environment ───
# IMPORTANT: Update these values!

# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/nexacrm?retryWrites=true&w=majority
MONGODB_DB=nexacrm

# JWT Secret (CHANGE THIS to a random 64+ char string!)
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_64_CHARACTER_SECRET_STRING_FOR_PRODUCTION_USE

# Server
PORT=8080

# CORS - Update with your actual frontend URL
CORS_ORIGINS=

# Cookie settings for HTTP (change to true when you add SSL)
AUTH_COOKIE_SECURE=true
AUTH_COOKIE_SAME_SITE=None

# Redis (disable if not using Redis)
REDIS_HOST=localhost
REDIS_PORT=6379

# Logging
APP_LOG_LEVEL=INFO
ENVEOF

echo "Created .env file at $APP_DIR/backend/.env"
echo ">>> IMPORTANT: Edit the .env file and change JWT_SECRET! <<<"

# 4. Create systemd service for the backend
sudo tee /etc/systemd/system/internite.service > /dev/null << 'SERVICEEOF'
[Unit]
Description=Internite CRM Backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/home/internite/backend
ExecStart=/usr/bin/java -jar /home/internite/backend/internite-crm-backend-1.0.0.jar
Restart=always
RestartSec=10
EnvironmentFile=/home/internite/backend/.env

[Install]
WantedBy=multi-user.target
SERVICEEOF

# 5. Reload systemd and start the service
sudo systemctl daemon-reload
sudo systemctl enable internite
sudo systemctl start internite

echo ""
echo "=== Deployment Complete ==="
echo "Backend running on port 8080"
echo "Frontend files should be served by CloudPanel (Nginx)"
echo ""
echo "Next steps:"
echo "1. Edit $APP_DIR/backend/.env and set a real JWT_SECRET"
echo "2. In CloudPanel, create a Static site pointing to $APP_DIR/frontend"
echo "3. In CloudPanel, set up a reverse proxy for the API on port 8080"
echo "4. Restart: sudo systemctl restart internite"
echo "5. Check logs: sudo journalctl -u internite -f"
