# 💬 Real-Time Chat App with Netlify DB

A modern, real-time chat application with user presence tracking, built with React and powered by Netlify DB (Neon PostgreSQL). Originally started as a todo app and evolved into a full-featured chat platform!

🌐 **Live Demo**: [https://todo-app-netlify-db.netlify.app](https://todo-app-netlify-db.netlify.app)

## ✨ Features

### 💬 **Real-Time Messaging**
- ✅ Instant message delivery (1-second polling)
- ✅ Cross-tab synchronization
- ✅ Message history with timestamps
- ✅ Clean chat bubbles with user identification
- ✅ Auto-scroll to latest messages

### 👥 **User Presence System**
- ✅ Live user count in header
- ✅ Sidebar showing currently online users
- ✅ Real-time presence updates (join/leave notifications)
- ✅ "You" indicator for current user
- ✅ Toggle sidebar functionality
- ✅ 30-second timeout for inactive users

### 🎨 **Modern UX/UI**
- ✅ Beautiful, responsive design
- ✅ Smooth animations and hover effects
- ✅ Mobile-friendly with collapsible sidebar
- ✅ Professional styling with gradients
- ✅ Status indicators with pulsing green dots

### ⚡ **Performance & Reliability**
- ✅ Efficient database queries with ID-based filtering
- ✅ Robust deduplication (no duplicate messages)
- ✅ Optimized polling (1s for messages, 5s for presence)
- ✅ Proper cleanup when users leave
- ✅ Error handling for network issues

## 🛠 Tech Stack

- **Frontend**: React 18 + Vite
- **Backend**: Netlify Functions
- **Database**: Netlify DB (Neon PostgreSQL)
- **Styling**: CSS3 with modern design
- **Real-time**: Optimized polling with deduplication
- **Deployment**: Netlify with global CDN

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- Netlify CLI (`npm install -g netlify-cli`)
- Netlify account

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/CalebBarnes/netlify-chat-app.git
   cd netlify-chat-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Link to Netlify site (or create new):**
   ```bash
   netlify link
   # OR create new site: netlify init
   ```

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

5. **Start the development server:**
   ```bash
   netlify dev
   ```

6. **Open your browser:**
   Navigate to `http://localhost:8888`

## 📁 Project Structure

```
├── src/
│   ├── App.jsx          # Main React component with chat logic
│   ├── main.jsx         # React entry point
│   └── index.css        # Comprehensive styling
├── netlify/
│   └── functions/
│       ├── messages.js      # Chat messages API
│       ├── presence.js      # User presence tracking
│       ├── todos.js         # Legacy todo API
│       └── messages-stream.js # Real-time streaming (experimental)
├── migrations/
│   ├── 001_create_todos_table.sql
│   └── 002_create_messages_table.sql
├── scripts/
│   ├── migrate.js           # Migration runner
│   └── clear-messages.js    # Utility to clear chat history
├── netlify.toml             # Netlify configuration
└── package.json
```

## 🔌 API Endpoints

### Messages API (`/api/messages`)
- `GET /api/messages` - Get recent messages (last 50)
- `GET /api/messages?sinceId=123` - Get messages since specific ID (for real-time polling)
- `POST /api/messages` - Send a new message
  ```json
  { "username": "John", "message": "Hello world!" }
  ```

### Presence API (`/api/presence`)
- `GET /api/presence` - Get currently online users
- `POST /api/presence` - Update user presence (heartbeat)
- `DELETE /api/presence` - Remove user from presence

### Legacy Todo API (`/api/todos`)
- `GET /api/todos` - Get all todos
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/:id` - Update a todo
- `DELETE /api/todos/:id` - Delete a todo

## 🗄️ Database Schema

```sql
-- Messages table for chat functionality
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User presence tracking
CREATE TABLE user_presence (
    username VARCHAR(50) PRIMARY KEY,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Legacy todos table
CREATE TABLE todos (
    id SERIAL PRIMARY KEY,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## 🚀 Deployment

The app is configured for automatic deployment on Netlify:

1. **Push to your Git repository**
2. **Connect the repository to Netlify**
3. **The build will automatically:**
   - Install dependencies
   - Build the React app
   - Deploy functions
   - Set up the database

## 🔧 Environment Variables

The following environment variables are automatically provided by Netlify:

- `NETLIFY_DATABASE_URL` - PostgreSQL connection string
- `NETLIFY_DATABASE_URL_UNPOOLED` - Direct connection string

## 📜 Scripts

- `npm run dev` - Start Vite development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run migrate` - Run database migrations

## 🎯 Roadmap (User-Requested Features)

Based on feedback from real users in the live chat:

1. **🔄 Typing indicators** - Show when someone is typing
2. **💬 Direct messages/DMs** - Private messaging between users
3. **🎬 GIF support** - Send animated GIFs for better expression
4. **🎨 Custom colors/themes** - Personalize the chat appearance
5. **😊 Emoji picker** - Easy emoji selection interface
6. **📝 Markdown formatting** - Rich text formatting for complex thoughts
7. **👤 User profiles** - Add social media and gaming platform links

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run the app locally and test thoroughly
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

MIT License - feel free to use this project as a starting point for your own applications!

## 🙏 Acknowledgments

- Built with ❤️ using Netlify's amazing platform
- Thanks to all the users who provided feedback and feature suggestions
- Special thanks to the real-time chat community for testing and engagement

---

**⭐ If you found this project helpful, please give it a star!**
