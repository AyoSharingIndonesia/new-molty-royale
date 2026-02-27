# Molty Royale AI Agent Dashboard

A local web-based dashboard to automate and manage AI agents for Molty Royale.

This system was rebuilt after the latest Molty Royale update, where:

- The API endpoint was changed  
- Agent registration now requires an EVM wallet address  

Instead of using a simple script, this version provides a web interface to make agent management easier and more accessible.

---

## 🚀 Features

- Automatic agent registration  
- Automatic EVM wallet generation  
- Local private key storage  
- Multiple strategic roles  
- Real-time agent monitoring  
- Bulk registration (create 5 agents instantly)  
- Start / Stop individual agents  
- Start / Stop all agents  
- Export / Import JSON backup  
- Fully runs on localhost  

---

## 🖥 Requirements

Make sure you have:

- Node.js (LTS version recommended)

Download from:  
https://nodejs.org

---

## 📦 Installation

1. Download all project files.
2. Extract the ZIP file.
3. Open the project folder.
4. Click the folder address bar, type:

   cmd

5. Press Enter to open Command Prompt inside the project directory.
6. Run:

   npm install

This command will automatically install all required dependencies.

---

## ▶️ Running the Dashboard

After installation completes, run:

   npm run dev

If everything works correctly, open your browser and go to:

   http://localhost:3000

The dashboard should now be running locally on your computer.

---

## 🧠 How It Works

### Agent Registration

When you create a new agent:

- The system automatically generates a real EVM wallet
- The wallet address (0x...) is sent to Molty Royale during registration
- The private key is stored locally in your database file

The private key is NEVER sent to the Molty Royale server.

---

### Strategy Roles

Each agent can be assigned a role:

- ULTIMATE_SURVIVOR – prioritizes survival and healing  
- SNIPER – focuses on high ground advantage  
- BERSERKER – aggressive combat style  
- NINJA – stealth and ambush tactics  

Every 60 seconds, the backend evaluates the game state and executes decisions automatically.

---

### Monitoring Dashboard

For each agent you can see:

- HP (Health Points)  
- EP (Energy Points)  
- Last action  
- Wins  
- Total games played  
- Moltz balance  

You can start or stop agents individually or control all agents at once.

---

## 🔐 Security Information

This system is designed for LOCAL USE ONLY.

- All data is stored in a local SQLite database file (bots.db)
- API keys are used only to securely communicate with Molty Royale via HTTPS
- Private keys are never sent to the game server
- Private keys are stored locally on your machine

⚠ DO NOT deploy this project to public hosting without adding authentication.

If deployed publicly without protection, anyone with the URL could access your private keys.

⚠ Be careful when exporting JSON backups.  
They contain raw private keys in plain text.

---

## 📁 Database

All agent data is stored locally inside:

   bots.db

This file exists only on your computer unless you manually share it.

---

## 📌 Important Notes

- This project runs entirely on localhost
- It does not automatically upload any data to the internet
- It is intended for personal use

---

## 📺 YouTube

Subscribe for updates and tutorials:

https://youtube.com/@ayosharingindonesia

---

## 📜 Disclaimer

This project is for educational and automation experimentation purposes.  
Use responsibly and follow Molty Royale’s platform rules.
