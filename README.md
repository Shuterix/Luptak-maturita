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

3. Set up a MongoDB database and get your connection string:

   1. Go to [MongoDB Atlas](https://www.mongodb.com/atlas) and create a free account (or sign in).
   2. Click **Build a Database** and choose the free **M0** tier.
   3. Create a database user with a username and password.
   4. In the **Network Access** tab, click **Add IP Address** and allow your current IP (or `0.0.0.0/0` for all IPs).
   5. Go back to **Database** → click **Connect** → choose **Drivers**.
   6. Copy the connection string — it looks like this:
      ```
      mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
      ```
   7. Replace `<username>` and `<password>` with the database user credentials you created in step 3.

4. Create a `.env.local` file inside the `aplikacia` folder and paste your connection string:

```
MONGODB_URI=mongodb+srv://youruser:yourpassword@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
JWT_SECRET=your_jwt_secret
```

5. Start the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.
