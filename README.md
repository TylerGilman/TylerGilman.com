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
- **Deployment**: Amazon EC2

## 📋 Prerequisites

- Go 1.21 or higher
- Node.js and npm (for Tailwind CSS)
- Make

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

# SSL Configuration (Production)
SSL_CERT_PATH=/path/to/cert
SSL_KEY_PATH=/path/to/key

# Logging
LOG_LEVEL=INFO

# GitHub Integration
GITHUB_TOKEN=your_github_token
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

### Project Structure

```
.
├── handlers/          # HTTP request handlers
├── public/           # Static assets
├── views/            # Templates and views
│   ├── auth/        # Authentication templates
│   ├── blog/        # Blog-related templates
│   ├── components/  # Reusable components
│   ├── layouts/     # Layout templates
│   └── projects/    # Project showcase templates
├── main.go          # Application entry point
└── Makefile         # Build and run commands
```

## 🚀 Deployment

### Amazon EC2 Deployment

1. Set up an EC2 instance with Ubuntu
2. Install required dependencies
3. Set up SSL certificates
4. Configure environment variables
5. Build and run the application

```bash
# On your EC2 instance
git clone https://github.com/yourusername/nereus_main_site.git
cd nereus_main_site
make build
./bin/app
```

### SSL Configuration

Make sure to set up SSL certificates for HTTPS:
1. Obtain SSL certificates (e.g., using Let's Encrypt)
2. Update SSL_CERT_PATH and SSL_KEY_PATH in your environment variables
3. The server will automatically use HTTPS in production mode

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
