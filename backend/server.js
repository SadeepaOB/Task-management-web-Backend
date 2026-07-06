const express = require('express');
const cors = require('cors');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const dotenv = require('dotenv');
const connectDB = async () => {
  // We'll call this inside server file
};

// Load env variables
dotenv.config();

const connectDatabase = require('./config/db');
const errorHandler = require('./middleware/errorMiddleware');

// Route imports
const authRoutes = require('./routes/authRoutes');
const reportRoutes = require('./routes/reportRoutes');
const projectRoutes = require('./routes/projectRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const aiRoutes = require('./routes/aiRoutes');

// Connect to Database
connectDatabase();

const app = express();

// CORS middleware configuration
// Allows credentials (cookies/sessions) to be shared with Vite frontend at localhost:5173
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Body Parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session handling with MongoDB store
app.use(
  session({
    name: 'sid', // Cookie name
    secret: process.env.SESSION_SECRET || 'supersecretkeyformyweeklyreportgeneratorapp123!',
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({
      mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/weekly-report-db',
      collectionName: 'sessions',
      ttl: 60 * 60 * 24 * 7, // Session TTL: 7 days
    }),
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // true in production (requires HTTPS)
      maxAge: 1000 * 60 * 60 * 24 * 7, // Cookie TTL: 7 days
      sameSite: 'lax', // Needed for cross-origin cookie sharing locally
    },
  })
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/ai', aiRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Weekly Report Generator API is running' });
});

// Error handling middleware (must be registered last)
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
});
