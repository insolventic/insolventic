<div align="center">
  <img src="public/images/insolventic-logo.png" alt="Insolventic Logo" width="200" />
</div>

# INSOLVENTIC 🧩

![Insolventic Logo](https://img.shields.io/badge/INSOLVENTIC-Sistema%20de%20Gesti%C3%B3n%20de%20Procesos%20de%20Insolvencia-blue?style=for-the-badge)
[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?style=for-the-badge&logo=vercel)](https://insolventic.vercel.app)
[![Built with Next.js](https://img.shields.io/badge/Built%20with-Next.js-black?style=for-the-badge&logo=next.js)](https://nextjs.org)
[![Built with React](https://img.shields.io/badge/Built%20with-React-61DAFB?style=for-the-badge&logo=react)](https://reactjs.org)
[![UI: Shadcn](https://img.shields.io/badge/UI-Shadcn-black?style=for-the-badge)](https://ui.shadcn.com/)

## 📋 Overview

INSOLVENTIC is a comprehensive system designed for managing insolvency processes. It serves as a powerful tool for legal professionals, offering a streamlined approach to handle debtor cases, creditor relations, document generation, and hearing management in compliance with Colombian insolvency law.

**Live demo:** [https://insolventic.vercel.app](https://insolventic.vercel.app)

## ✨ Features

- **🏢 Multi-database Support:** Manage separate databases for different insolvency operators (Armonia, Constructores de Paz)
- **👥 User Management:** Role-based access control with comprehensive user administration
- **📂 Case Management:** Complete tracking of insolvency cases from initiation to resolution
- **👨‍💼 Debtor Profiles:** Comprehensive debtor information management with financial status tracking
- **💰 Creditor Management:** Track and manage all creditors involved in insolvency processes
- **📝 Document Generation:** Automated generation of legal documents from templates
- **📅 Hearing Scheduling:** Manage and track case-related hearings and meetings
- **📊 Dashboard Analytics:** Visual representation of case statistics and KPIs
- **🔔 Notifications:** System alerts for important deadlines and events
- **🔒 Secure Authentication:** Role-based access with secure login credentials

## 🚀 Getting Started

### Prerequisites

- Node.js 18.x or higher
- npm or yarn
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/Nick220505/insolventic.git

# Navigate to the project directory
cd insolventic

# Install dependencies
npm install
# or
yarn install

# Run the development server
npm run dev
# or
yarn dev
```

The application will be available at `http://localhost:3000`.

## 🔧 Environment Variables

Create a `.env` file in the root directory with the following variables:

```bash
# Database Configuration
DATABASE_URL="postgresql://user:password@host:port/database"
```

## 📱 Application Structure

The project follows a modular component-based architecture:

```
insolventic/
├── src/
│   ├── components/           # Reusable UI components
│   │   ├── auth/             # Authentication components
│   │   ├── cases/            # Case management components
│   │   ├── creditors/        # Creditor management components
│   │   ├── dashboard/        # Dashboard and analytics components
│   │   ├── debtors/          # Debtor management components
│   │   ├── documents/        # Document generation components
│   │   ├── hearings/         # Hearing management components
│   │   ├── ui/               # UI components (buttons, cards, etc.)
│   │   └── users/            # User management components
│   ├── lib/                  # Utility functions and types
│   └── app/                  # Next.js app router pages
└── public/                   # Static assets
```

## 📝 Key Components

### Dashboard

The Dashboard provides an overview of all cases, recent activities, and key performance indicators. It includes:

- Recent cases summary
- Task management
- Activity tracking
- Quick statistics

### Case Management

Comprehensive case management system with features for:

- Creating and tracking insolvency cases
- Document attachment
- Status updates
- Timeline visualization
- Creditor and debt tracking

### Document Generator

Powerful document generation system that:

- Creates legal documents from templates
- Supports multiple document types
- Allows for customization of key fields
- Exports to standard formats

### User Administration

Complete user management system with:

- Role-based permissions
- User creation and editing
- Activity logging
- Profile management

## 👨‍💻 Development

### Technology Stack

- **Frontend:** React with Next.js
- **UI Components:** Shadcn UI
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **State Management:** React Hooks
- **Forms:** React Hook Form
- **Notifications:** Sonner
- **Authentication:** Custom JWT authentication

## 🏷️ Versioning Strategy

This project uses [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Increment | When                             |
| --------- | -------------------------------- |
| **MAJOR** | Breaking changes                 |
| **MINOR** | New backward-compatible features |
| **PATCH** | Bug fixes                        |

### How it works

- **Source of truth**: `package.json → version`
- **Centralized config**: `src/config/version.ts` reads from `package.json` and exposes helpers
- **UI indicator**: A subtle version badge is displayed in the bottom-left corner of the app (`INSOLVENTIC v0.1.0`)
- **Environment labels**: The badge appends `-dev` or `-staging` based on `NEXT_PUBLIC_APP_ENV` / `NODE_ENV`

### Creating a release

```bash
# 1. Update version in package.json
npm version patch   # 0.1.0 → 0.1.1
npm version minor   # 0.1.0 → 0.2.0
npm version major   # 0.1.0 → 1.0.0

# 2. Push with tag
git push origin dev --tags
```

When a `v*` tag is pushed, the GitHub Actions workflow (`.github/workflows/release.yml`) automatically creates a GitHub Release with changelog notes.

### Changelog

All notable changes are documented in [CHANGELOG.md](./CHANGELOG.md) following the [Keep a Changelog](https://keepachangelog.com/) format.

## 📄 License

This project is proprietary and confidential. Unauthorized copying, transfer, or reproduction of the contents is strictly prohibited.

## 👏 Acknowledgements

- Built for legal professionals specializing in insolvency processes
- Designed to streamline compliance with Colombian insolvency law
- Developed to improve efficiency in legal document management

---

© 2025 INSOLVENTIC - Sistema de Gestión de Procesos de Insolvencia
