# Nereus Tech Personal Website

A modern, high-performance personal website built with Go, HTMX, and Tailwind CSS. Features a blog system, project showcase, and real-time GitHub contribution tracking.

## 🌟 Features

- **Blog System**: Write and manage blog posts with markdown support
- **Project Showcase**: Display personal projects with live demos
- **GitHub Integration**: Real-time contribution graph
- **Interactive Fish Tank**: Creative JavaScript animation
- **HTMX Integration**: Dynamic content without complex JavaScript
- **Mobile Responsive**: Fully responsive design with mobile-first approach

## 🚀 Tech Stack

- **Backend**: Go (Chi Router)
- **Frontend**: HTMX, Tailwind CSS
- **Template Engine**: Templ
- **Database**: SQLite
- **Deployment**: Containerized with Docker, Traefik, and automated deployments

## 📋 Prerequisites

- Go 1.21 or higher
- Node.js and npm (for Tailwind CSS)
- Make
- Docker and Docker Compose (for deployment)

## 🔧 Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/nereus_main_site.git
cd nereus_main_site
```

2. Create and configure your `.env` file
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Install dependencies
```bash
go mod download
npm install
```

4. Build the CSS
```bash
make css
```

5. Run the development server
```bash
make run
```

## 🔐 Environment Variables

Create a `.env` file in the root directory with the following variables:

```env
# Server Configuration
ENV=development
DEV_PORT=8080

# Security
ADMIN_PASSWORD=your_secure_password_here

# Logging
LOG_LEVEL=INFO

# GitHub Integration
GITHUB_TOKEN=your_github_token

# Database
DB_PATH=./data/blog.db
```

## 🛠️ Development

### Running in Development Mode

There are several options for development mode, depending on your needs:

1. **All-in-one development environment:**
```bash
make dev-all
```
This will:
- Watch and generate Templ templates
- Watch and compile Tailwind CSS for all stylesheets
- Run the server with live reload

2. **Basic development mode (without CSS watching):**
```bash
make dev
```
This will:
- Watch and generate Templ templates
- Run the server

3. **Manual setup for more control:**

Start the Tailwind CSS compiler:
```bash
make css-watch
```

Generate templates:
```bash
templ generate
```

or watch for template changes:
```bash
templ generate --watch
```

Run the server:
```bash
make run
```

## 🚀 Deployment

### Quick Production Deployment

For a quick production deployment, use the provided scripts:

1. **Build the Docker image locally (recommended for development):**
```bash
./scripts/build_docker.sh
```
This script will:
- Generate Templ templates
- Build the Docker image
- Optionally push to Docker Hub

2. **Deploy on your VPS:**
```bash
./scripts/vps_deploy.sh
```
This script will:
- Set up Traefik configuration
- Deploy the application with SSL
- Configure automatic certificate renewal
- Set up automatic updates

### DNS Configuration

Make sure to set up these DNS records pointing to your VPS:
- `tylergilman.com` - Main website
- `traefik.tylergilman.com` - Traefik dashboard (password protected)

### Troubleshooting Deployment

If you encounter network issues during deployment:
1. Try building the image locally and pushing to Docker Hub
2. On your VPS, use option 2 in the deploy script to pull from Docker Hub
3. Check the logs with `docker-compose -f docker-compose.prod.yml logs -f`

## 💻 Usage

### Managing Blog Posts

1. Access the admin interface at `/admin/blog`
2. Use your admin password to authenticate
3. Create, edit, or delete blog posts
4. Posts support markdown formatting

### Project Showcase

1. Projects are displayed at `/projects`
2. Features GitHub contribution tracking
3. Interactive fish tank demonstration

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details

## 👤 Author

Tyler Gilman
- Website: [nereustech.net](https://nereustech.net)
- GitHub: [@TylerGilman](https://github.com/TylerGilman)
- LinkedIn: [Tyler Gilman](https://www.linkedin.com/in/tyler-gilman-991b84223/)

## 🙏 Acknowledgments

- [HTMX](https://htmx.org/) for the excellent hypermedia system
- [Tailwind CSS](https://tailwindcss.com/) for the utility-first CSS framework
- [Chi Router](https://github.com/go-chi/chi) for the lightweight Go router
- [Traefik](https://traefik.io/) for the powerful edge router