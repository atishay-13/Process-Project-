# Team Task Manager

A full-stack web application for collaborative project and task management with role-based access control.

## Project Structure

```
team-task-manager/
├── backend/              # Node.js + Express API server
│   ├── src/
│   │   ├── routes/       # API route definitions
│   │   ├── controllers/  # Request handlers
│   │   ├── middleware/   # Express middleware
│   │   ├── services/     # Business logic
│   │   ├── utils/        # Utility functions
│   │   ├── prisma/       # Prisma schema and migrations
│   │   └── server.js     # Application entry point
│   ├── package.json
│   └── .env.example
│
└── frontend/             # React + Vite application
    ├── src/
    │   ├── components/   # React components
    │   ├── pages/        # Page components
    │   ├── contexts/     # React Context providers
    │   ├── services/     # API service layer
    │   ├── hooks/        # Custom React hooks
    │   └── utils/        # Utility functions
    ├── package.json
    └── .env.example
```

## Technology Stack

**Frontend:**
- React 18.x
- Vite
- React Router
- Axios
- Tailwind CSS

**Backend:**
- Node.js 18.x
- Express 4.x
- Prisma 5.x
- PostgreSQL 15.x
- JWT Authentication
- bcrypt

## Getting Started

### Prerequisites

- Node.js 18.x or higher
- PostgreSQL 15.x
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Update `.env` with your database credentials and JWT secret

5. Run Prisma migrations (after schema is created):
```bash
npm run migrate
```

6. Start development server:
```bash
npm run dev
```

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Copy environment variables:
```bash
cp .env.example .env
```

4. Start development server:
```bash
npm run dev
```

## Development

- Backend runs on `http://localhost:5000`
- Frontend runs on `http://localhost:5173`

## Next Steps

Follow the implementation tasks in `.kiro/specs/team-task-manager/tasks.md` to build out the application features.
