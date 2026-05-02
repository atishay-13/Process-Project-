# Team Task Manager - Frontend

React-based frontend application for the Team Task Manager.

## Technology Stack

- **React 18.x** - UI framework
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing
- **Axios** - HTTP client for API communication
- **Tailwind CSS** - Utility-first CSS framework

## Project Structure

```
frontend/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── common/        # Generic components (Button, Input, Card)
│   │   ├── layout/        # Layout components (Header, Sidebar, Footer)
│   │   └── features/      # Feature-specific components
│   ├── pages/             # Page-level components
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Dashboard.jsx
│   │   ├── Projects.jsx
│   │   └── Tasks.jsx
│   ├── contexts/          # React Context for state management
│   │   └── AuthContext.jsx
│   ├── services/          # API communication layer
│   │   ├── api.js         # Axios instance with interceptors
│   │   ├── authService.js
│   │   ├── projectService.js
│   │   └── taskService.js
│   ├── hooks/             # Custom React hooks
│   │   └── useAuth.js
│   ├── utils/             # Utility functions
│   │   └── validators.js
│   └── App.jsx            # Root component with routing
├── public/                # Static assets
├── index.html             # HTML entry point
├── vite.config.js         # Vite configuration
├── tailwind.config.js     # Tailwind CSS configuration
└── package.json           # Dependencies and scripts
```

## Responsive Design

The application uses a mobile-first approach with the following breakpoints:

- **Mobile**: Default (no prefix) - Base styles for mobile devices
- **Tablet**: `tablet:` prefix - 768px and above
- **Desktop**: `desktop:` prefix - 1920px and above

Example usage:
```jsx
<div className="text-sm tablet:text-base desktop:text-lg">
  Responsive text
</div>
```

## Environment Configuration

Create a `.env` file in the frontend directory with the following variables:

```env
VITE_API_URL=http://localhost:5000
```

For production, update `VITE_API_URL` to point to your deployed backend API.

## Available Scripts

### `npm run dev`
Starts the development server on port 3000 with hot module replacement.

### `npm run build`
Builds the application for production to the `dist` folder.
- Optimized and minified using esbuild
- Code splitting with separate chunks for vendor and API libraries
- Ready for deployment

### `npm run preview`
Previews the production build locally.

## Development Guidelines

### Component Organization

1. **Common Components**: Generic, reusable UI components (Button, Input, Card, Modal)
2. **Layout Components**: Page structure components (Header, Sidebar, Footer, Navigation)
3. **Feature Components**: Domain-specific components (TaskList, ProjectCard, DashboardWidget)
4. **Page Components**: Top-level route components that compose other components

### State Management

- Use React Context API for global state (authentication, theme)
- Use local component state for UI-specific state
- Custom hooks for reusable stateful logic

### API Communication

All API calls should go through the service layer:
- `api.js`: Configured Axios instance with interceptors
- `authService.js`: Authentication-related API calls
- `projectService.js`: Project management API calls
- `taskService.js`: Task management API calls

### Styling Guidelines

- Use Tailwind CSS utility classes for styling
- Follow mobile-first responsive design
- Use consistent spacing scale (4px base unit)
- Ensure touch-friendly targets on mobile (minimum 44x44 pixels)

## Key Features

### Authentication Flow
- JWT-based authentication with access and refresh tokens
- Automatic token refresh on 401 responses
- Protected routes that redirect unauthenticated users

### Responsive Design
- Mobile-first approach
- Optimized layouts for mobile, tablet, and desktop
- Touch-friendly UI elements

### API Integration
- Centralized API service with Axios
- Request/response interceptors for token management
- Consistent error handling

## Next Steps

The following components need to be implemented:

1. **Authentication**
   - AuthContext provider
   - Login page
   - Signup page
   - Protected route component

2. **Dashboard**
   - Task summary cards
   - Overdue task indicators
   - Project filter

3. **Project Management**
   - Project list
   - Project detail view
   - Create/delete project forms

4. **Task Management**
   - Task list with filters
   - Task creation form
   - Status update functionality

5. **Layout**
   - Header with navigation
   - Responsive navigation menu
   - Footer (if needed)

## Build Configuration

The Vite configuration includes:
- Code splitting for vendor and API libraries
- API proxy for development (proxies `/api` to backend)
- Optimized production builds with minification
- Source maps disabled in production

## Deployment

The application is configured for deployment to Railway:

1. Build command: `npm run build`
2. Start command: `npx serve -s dist -p $PORT`
3. Environment variable: `VITE_API_URL` (set to production API URL)

The build output in the `dist` folder is a static site that can be served by any static file server.
