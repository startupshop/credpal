# credpal-app

Production-ready Node.js REST API with full DevOps pipeline — containerisation, CI/CD, infrastructure as code, and zero-downtime deployment.

**Live:** `https://cred.aggregatorlink.pw`

---

## Endpoints

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/health` | Liveness probe — confirms process is alive, no DB check |
| GET | `/status` | Readiness probe — includes DB connectivity check |
| POST | `/process` | Accepts JSON body, returns processed result |

All endpoints return JSON. Application runs on port **3000**.

---

## Run Locally

**Prerequisites:** Node.js 20+

```bash
git clone https://github.com/startupshop/credpal.git
cd credpal
npm install
cp .env.example .env   # edit values as needed
npm start
```

Test the endpoints:
```bash
curl http://localhost:3000/health
curl http://localhost:3000/status
curl -X POST http://localhost:3000/process \
  -H "Content-Type: application/json" \
  -d '{"input": "test"}'
```

Run tests:
```bash
npm test
```

---

## Run with Docker

**Prerequisites:** Docker + Docker Compose

```bash
cp .env.example .env   # edit DB credentials if needed
docker compose up --build
```

This starts two containers:
- `credpal-app` — Node.js API on port 3000
- `credpal-postgres` — PostgreSQL 15 on the internal network

The app waits for Postgres to pass its healthcheck before starting. `/status` will show `"db":"connected"` once both are up.

```bash
curl http://localhost:3000/status
# {"status":"ok","uptime":...,"db":"connected"}
```

Stop:
```bash
docker compose down
```

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Port the app listens on | `3000` |
| `NODE_ENV` | Environment name | `development` |
| `DB_HOST` | PostgreSQL host | — |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | — |
| `DB_USER` | Database user | — |
| `DB_PASSWORD` | Database password | — |

Copy `.env.example` to `.env` for local use. Never commit `.env`.

---

## CI/CD Pipeline

**GitHub Actions — two workflows:**

| Workflow | Trigger | Jobs |
|----------|---------|------|
| `ci.yml` | Push to `main`, PRs to `main` | Install → Test → Build image → Push to DockerHub |
| `deploy.yml` | After CI passes on `main` | Manual approval → Rolling deploy to EC2 |

**Secrets required in GitHub repository settings:**

| Secret | Description |
|--------|-------------|
| `DOCKERHUB_USERNAME` | DockerHub account username |
| `DOCKERHUB_TOKEN` | DockerHub access token |
| `EC2_HOST` | EC2 public IP |
| `EC2_SSH_KEY` | SSH private key (PEM content) |
| `EC2_USER` | EC2 login user (`ec2-user`) |

**Manual approval:** The deploy job runs under the `production` GitHub Environment. A designated reviewer must approve before deployment proceeds. This satisfies the manual approval gate requirement for production deployments.

---

## Infrastructure

Provisioned with Terraform (`terraform/`) in `us-east-1`:

| Resource | Details |
|----------|---------|
| VPC | `10.0.0.0/16`, 2 public subnets (us-east-1a, us-east-1b) |
| Security Groups | ALB: port 80 open. App: port 3000 from ALB only + SSH |
| EC2 | `t3.micro`, Amazon Linux 2023 |
| ALB | Internet-facing, HTTP port 80, forwards to EC2:3000 |

**HTTPS** is terminated at the Cloudflare edge. `cred.aggregatorlink.pw` is a CNAME pointing to the ALB DNS name with Cloudflare proxy enabled. Cloudflare issues and renews the TLS certificate automatically — no ACM required.

```
User (HTTPS) → Cloudflare Edge (TLS terminated) → ALB (HTTP:80) → EC2:3000 (Docker, non-root)
```

To provision infrastructure:
```bash
cd terraform
cp terraform.tfvars.example terraform.tfvars   # fill in your values
terraform init
terraform plan
terraform apply
# outputs: alb_dns_name (use as Cloudflare CNAME target), ec2_public_ip (use as EC2_HOST secret)
```

---

## Key Decisions

**Cloudflare for HTTPS instead of ACM**
Nameservers are managed in Cloudflare. Enabling the proxy on the ALB CNAME gives automatic TLS at the edge with zero certificate management overhead. SSL mode is set to Flexible — Cloudflare terminates TLS, forwards HTTP to the ALB. ACM is unnecessary given Cloudflare is already in the stack.

**Non-root container**
The Dockerfile creates a dedicated `appuser` and switches to it before the CMD instruction. The process inside the container never runs as root, limiting blast radius if the application is compromised.

**Liveness vs readiness split**
`/health` is a pure liveness check — it never hits the database. This prevents a DB outage from killing the container via health check restarts. `/status` is the readiness check and surfaces actual DB connectivity, giving the load balancer accurate signal about whether to route traffic.

**DB failure tolerance**
The application starts regardless of DB state. `/status` reports `"db":"connected"` or `"db":"unreachable"` without crashing. In production the app container runs standalone on EC2; PostgreSQL is a local development dependency managed via docker-compose.

**Rolling deployment**
Zero-downtime is achieved by pulling the new image and restarting the container on EC2. The ALB health check on `/health` ensures traffic only routes to the instance once it is ready. The deploy workflow is gated behind a manual approval step using a GitHub `production` environment.

**No secrets in repository**
All runtime secrets live in GitHub Secrets. The EC2 instance receives its `.env` file via Terraform user_data at provisioning time — never through the repository. `.env` and `terraform.tfvars` are both listed in `.gitignore`.
