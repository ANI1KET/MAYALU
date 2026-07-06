# Deployment Guide — Mayalu Wears API

## Local Development

```bash
# 1. Clone and install
git clone <repo>
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and fill in all required values

# 3. Generate secrets
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"  # JWT_SECRET
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"  # ADMIN_SECRET_KEY

# 4. Start PostgreSQL
docker compose up postgres -d

# 5. Push schema and seed
npm run db:push
npm run db:seed

# 6. Start dev server
npm run start:dev
# → http://localhost:3000/api/v1
# → http://localhost:3000/api/docs (Swagger)
```

## Docker (Full Stack)

```bash
docker compose up --build
# API:      http://localhost:3000/api/v1
# Adminer:  http://localhost:8080
```

---

## Production: VPS + NGINX + SSL

### 1. Server Setup (Ubuntu 22.04)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
sudo apt install -y nodejs

# Install PostgreSQL 16
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo tee /etc/apt/trusted.gpg.d/pgdg.asc &>/dev/null
sudo apt update && sudo apt install -y postgresql-16

# Enable extensions
sudo -u postgres psql mayalu_wears -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\"; CREATE EXTENSION IF NOT EXISTS citext; CREATE EXTENSION IF NOT EXISTS ltree; CREATE EXTENSION IF NOT EXISTS pgcrypto; CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# Install PM2
npm install -g pm2
```

### 2. Build and Deploy

```bash
# On server
git pull origin main
npm ci --production=false
npm run build
npm run db:migrate     # production migration (not push)
npm run db:seed        # only on first deploy

# Start with PM2
pm2 start dist/main.js --name mayalu-api -i max
pm2 save
pm2 startup
```

### 3. NGINX Configuration

```nginx
# /etc/nginx/sites-available/mayalu-api
server {
    listen 80;
    server_name api.mayaluwears.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.mayaluwears.com;

    ssl_certificate     /etc/letsencrypt/live/api.mayaluwears.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.mayaluwears.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         HIGH:!aNULL:!MD5;

    client_max_body_size 20M;

    location /api/ {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Upgrade $http_upgrade;
        proxy_set_header   Connection 'upgrade';
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_set_header   X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 60s;
    }
}
```

```bash
# Enable site and SSL
sudo ln -s /etc/nginx/sites-available/mayalu-api /etc/nginx/sites-enabled/
sudo certbot --nginx -d api.mayaluwears.com
sudo nginx -t && sudo systemctl reload nginx
```

### 4. Production Environment Variables

```env
NODE_ENV=production
PORT=3000
CORS_ORIGINS=https://mayaluwears.com,https://admin.mayaluwears.com
DATABASE_URL=postgresql://mayalu:STRONG_PASSWORD@localhost:5432/mayalu_wears
JWT_SECRET=<64-char-random-hex>
ADMIN_SECRET_KEY=<32-char-random-hex>
SMS_PROVIDER=sparrow
SPARROW_SMS_TOKEN=<your-token>
SPARROW_SMS_FROM=MayaluWears
SMS_DEBUG=false
CLOUDINARY_CLOUD_NAME=<your-cloud>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>
LOG_LEVEL=log
LOG_PRETTY=false
```

### 5. Database Backups

```bash
# Daily backup cron
0 2 * * * pg_dump -U mayalu mayalu_wears | gzip > /backups/mayalu_$(date +%Y%m%d).sql.gz

# Restore
gunzip -c backup.sql.gz | psql -U mayalu mayalu_wears
```

### 6. Health Monitoring

```bash
# PM2 monitoring
pm2 monit

# Logs
pm2 logs mayalu-api --lines 100

# Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

---

## Database Commands

```bash
npm run db:push      # Push schema changes (dev only — no migration files)
npm run db:generate  # Generate SQL migration files
npm run db:migrate   # Apply migrations (production)
npm run db:studio    # Open Drizzle Studio at http://localhost:4983
npm run db:seed      # Seed plans, categories, attributes, delivery zones
```

## Scaling Considerations

- **Read replicas**: Point Drizzle to replica for GET-heavy routes.
- **Redis cache**: Replace in-memory delivery cache with Redis for multi-instance.
- **Queue**: Move SMS and notifications to Bull/BullMQ for reliability.
- **CDN**: Serve Cloudinary media via CDN for faster image loading.
- **Horizontal scaling**: API is stateless (JWT cookies) — run multiple instances behind NGINX upstream.
