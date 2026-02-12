# DanceHub

The application is deployed and available at **[https://dancehub-phi.vercel.app/](https://dancehub-phi.vercel.app/)**.

## Running Locally

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [MongoDB](https://www.mongodb.com/) database (local or [MongoDB Atlas](https://www.mongodb.com/atlas))

### Installation

1. Clone the repository and navigate to the application folder:

```bash
git clone <repository-url>
cd task-manager-v1/aplikacia
```

2. Install dependencies:

```bash
npm install
```

3. Create a `.env.local` file inside the `aplikacia` folder with the following variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
```

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.
