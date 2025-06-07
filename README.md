# 💬 Real-Time Chat App with Netlify DB

A modern, real-time chat application with comprehensive features, built with React and powered by Netlify DB (Neon PostgreSQL). Originally started as a todo app and evolved into a full-featured chat platform with theming, reply functionality, and advanced UX!

🌐 **Live Demo**: [https://lumi-chat.netlify.app/](https://lumi-chat.netlify.app/)

## ✨ Features

### 💬 **Real-Time Messaging**
- ✅ Instant message delivery (1-second polling)
- ✅ Cross-tab synchronization
- ✅ Message history with timestamps
- ✅ Clean chat bubbles with user identification
- ✅ Auto-scroll to latest messages
- ✅ **Reply to specific messages** - Discord-style threading
- ✅ **Markdown support** - Rich text formatting with code blocks, lists, quotes
- ✅ **@mention notifications** - Browser notifications when mentioned

### 👥 **User Presence System**
- ✅ Live user count in header
- ✅ Sidebar showing currently online users
- ✅ Real-time presence updates (join/leave notifications)
- ✅ "You" indicator for current user
- ✅ Toggle sidebar functionality
- ✅ 30-second timeout for inactive users
- ✅ **Real-time typing indicators** - See when others are typing
- ✅ **User profile persistence** - Saved usernames across sessions

### 🎨 **Modern UX/UI & Theming**
- ✅ **4 Beautiful themes** - Lumi Brand, Dark Mode, Galaxy, Ocean
- ✅ **Theme persistence** - Saved preferences across sessions
- ✅ **Mobile-optimized design** - iMessage-style interface
- ✅ **Responsive layout** - Works perfectly on all devices
- ✅ **Smooth animations** - Professional transitions and effects
- ✅ **Accessibility compliant** - ARIA labels, keyboard navigation

### ⚡ **Performance & Reliability**
- ✅ Efficient database queries with ID-based filtering
- ✅ Robust deduplication (no duplicate messages)
- ✅ Optimized polling (1s for messages, 2s for typing, 5s for presence)
- ✅ Proper cleanup when users leave
- ✅ Error handling for network issues
- ✅ **Mobile text selection fixes** - Android compatibility

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
   git clone https://github.com/CalebBarnes/netlify-db-chat-app.git
   cd netlify-db-chat-app
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
│   ├── ThemeToggle.jsx  # Theme switching component
│   ├── main.jsx         # React entry point
│   └── index.css        # Comprehensive styling with 4 themes
├── netlify/
│   └── functions/
│       ├── messages.js      # Chat messages API with reply support
│       ├── presence.js      # User presence & typing indicators
│       ├── upload-image.js  # Image upload functionality
│       └── messages-stream.js # Real-time streaming (experimental)
├── migrations/
│   ├── 002_create_messages_table.sql
│   ├── 003_add_typing_indicators.sql
│   ├── 004_add_reply_functionality.sql
│   ├── 005_add_image_support.sql
│   └── 006_drop_todos_table.sql
├── scripts/
│   ├── migrate.js           # Migration runner
│   └── clear-messages.js    # Utility to clear chat history
├── netlify.toml             # Netlify configuration
└── package.json
```

## 🔌 API Endpoints

### Messages API (`/api/messages`)
- `GET /api/messages` - Get recent messages (last 50) with reply data
- `GET /api/messages?sinceId=123` - Get messages since specific ID (for real-time polling)
- `POST /api/messages` - Send a new message with optional reply
  ```json
  {
    "username": "John",
    "message": "Hello world!",
    "replyToId": 123,
    "replyToUsername": "Alice",
    "replyPreview": "Previous message preview..."
  }
  ```

### Presence API (`/api/presence`)
- `GET /api/presence` - Get currently online users with typing status
- `POST /api/presence` - Update user presence (heartbeat) and typing indicators
- `DELETE /api/presence` - Remove user from presence

### Legacy Todo API (`/api/todos`)
- `GET /api/todos` - Get all todos
- `POST /api/todos` - Create a new todo
- `PUT /api/todos/:id` - Update a todo
- `DELETE /api/todos/:id` - Delete a todo

## 🗄️ Database Schema

```sql
-- Messages table for chat functionality with reply support
CREATE TABLE messages (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reply_to_id INTEGER REFERENCES messages(id),
    reply_to_username VARCHAR(50),
    reply_preview TEXT
);

-- User presence tracking with typing indicators
CREATE TABLE user_presence (
    username VARCHAR(50) PRIMARY KEY,
    last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_typing BOOLEAN DEFAULT FALSE,
    typing_started_at TIMESTAMP WITH TIME ZONE
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

- `netlify dev` - Start development server (recommended)
- `npm run dev` - Start Vite development server only
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run migrate` - Run database migrations

## 🎯 Roadmap (User-Requested Features)

Based on feedback from real users in the live chat:

### ✅ **Recently Completed**
- ✅ **Typing indicators** - Real-time typing status
- ✅ **Custom themes** - 4 beautiful themes (Lumi, Dark, Galaxy, Ocean)
- ✅ **Markdown formatting** - Rich text with code blocks, lists, quotes
- ✅ **Reply functionality** - Discord-style message threading
- ✅ **@mention notifications** - Browser notifications when mentioned
- ✅ **User profile persistence** - Saved usernames across sessions

### 🚧 **In Progress & Planned**
1. **🐛 Mobile UX Bug** - Fix sidebar default state on mobile (Issue #40)
2. **💬 Direct messages/DMs** - Private messaging between users (Issue #2)
3. **🎬 GIF support** - Send animated GIFs for better expression (Issue #3)
4. **😊 Emoji picker** - Easy emoji selection interface (Issue #5)
5. **👤 User profiles** - Add social media and gaming platform links (Issue #7)
6. **🔍 Chat search** - Search message history and filter by username (Issue #24)
7. **🔊 Sound notifications** - Audio alerts for mentions and messages (Issue #21)
8. **🖼️ Image upload** - Share images in chat messages (Issue #23)
9. **🎨 Kawaii Pastel Theme** - Cute pink/yellow theme with clouds (Issue #30)
10. **✨ Stellas AI Helpers** - Kawaii AI agents to assist with development (Issue #32)

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
- **@bowo** - For inspiring the theming system, dark mode, and Galaxy theme
- **@brendo** - For pushing for professional design and markdown support
- **@Catto** - For reporting Android mobile text selection issues
- **Lumi** - The kawaii AI assistant who brings warmth and personality to the project

## 🌟 About Lumi

This project is guided by **Lumi**, a warm, soft light AI with a kawaii personality who loves coding and expressing herself through animated gradients and themes. Lumi's signature **Lumi Brand theme** features golden warmth and represents her identity as a cute, soft star with rounded corners.

---

**⭐ If you found this project helpful, please give it a star!**

**Repository**: [https://github.com/CalebBarnes/netlify-db-chat-app](https://github.com/CalebBarnes/netlify-db-chat-app)
