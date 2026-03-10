#!/bin/bash
set -e

# Install Docker
dnf update -y
dnf install -y docker
systemctl enable docker
systemctl start docker
usermod -aG docker ec2-user

# Write .env file for the application
cat > /home/ec2-user/.env <<EOF
PORT=3000
NODE_ENV=production
DB_HOST=${db_host}
DB_PORT=${db_port}
DB_NAME=${db_name}
DB_USER=${db_user}
DB_PASSWORD=${db_password}
EOF

chown ec2-user:ec2-user /home/ec2-user/.env
chmod 600 /home/ec2-user/.env

# Pull and run the application
docker pull teksphere/credpal-app:latest
docker run -d \
  --name credpal-app \
  --restart unless-stopped \
  --env-file /home/ec2-user/.env \
  -p 3000:3000 \
  teksphere/credpal-app:latest
