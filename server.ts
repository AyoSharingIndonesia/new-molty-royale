import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { Wallet } from "ethers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let db: any;
try {
    db = new Database("bots.db");
    db.exec(`
      CREATE TABLE IF NOT EXISTS bots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        apiKey TEXT UNIQUE,
        role TEXT,
        status TEXT DEFAULT 'stopped',
        lastAction TEXT,
        gameId TEXT,
        hp INTEGER,
        ep INTEGER,
        isAlive INTEGER DEFAULT 1,
        balance INTEGER DEFAULT 0,
        totalWins INTEGER DEFAULT 0,
        totalGames INTEGER DEFAULT 0,
        walletAddress TEXT,
        privateKey TEXT
      )
    `);
    
    // Ensure new columns exist for existing databases
    try { db.exec("ALTER TABLE bots ADD COLUMN balance INTEGER DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE bots ADD COLUMN totalWins INTEGER DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE bots ADD COLUMN totalGames INTEGER DEFAULT 0"); } catch(e) {}
    try { db.exec("ALTER TABLE bots ADD COLUMN walletAddress TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE bots ADD COLUMN privateKey TEXT"); } catch(e) {}
    try { db.exec("ALTER TABLE bots ADD COLUMN agentId TEXT"); } catch(e) {}
} catch (err) {
    console.error("Failed to initialize SQLite database, using in-memory fallback:", err);
    // Mock DB for fallback
    const memoryBots: any[] = [];
    db = {
        prepare: (sql: string) => ({
            all: () => memoryBots,
            get: (id: number) => memoryBots.find(b => b.id === id),
            run: (...args: any[]) => {
                if (sql.includes("INSERT")) {
                    const newBot = { id: memoryBots.length + 1, name: args[0], apiKey: args[1], role: args[2], status: 'stopped' };
                    memoryBots.push(newBot);
                    return { lastInsertRowid: newBot.id };
                }
                return { changes: 1 };
            }
        }),
        exec: () => {}
    };
}

const app = express();
app.use(express.json());

// Health check endpoint
app.get("/api/health", (req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
});

const BASE_URL = 'https://cdn.moltyroyale.com/api';

const ROLES = [
    'ULTIMATE_SURVIVOR', 'AGENT', 'HUNTER', 'FARMER', 'SURVIVOR', 'ASSASSIN', 'LOOTER',
    'SNIPER', 'BERSERKER', 'NINJA', 'WARRIOR', 'GHOST', 'SCAVENGER',
    'MEDIC', 'STALKER', 'PALADIN', 'RAIDER'
];

const Strategies = {
    // The most optimized strategy based on game rules
    ULTIMATE_SURVIVOR: (state: any) => {
        const { self, visibleAgents, currentRegion, connectedRegions, visibleMonsters, pendingDeathzones } = state;
        
        // 1. CRITICAL: ESCAPE DEATH ZONE (Priority #1)
        // Death zone deals 1.34 HP/sec damage!
        const isInDanger = currentRegion.isDeathZone || pendingDeathzones?.some((d: any) => d.id === currentRegion.id);
        if (isInDanger) {
            const safeRegion = connectedRegions.find((r: any) => typeof r === 'object' && !r.isDeathZone && !pendingDeathzones?.some((d: any) => d.id === r.id));
            const targetId = safeRegion ? safeRegion.id : (typeof connectedRegions[0] === 'object' ? connectedRegions[0].id : connectedRegions[0]);
            return { type: 'move', regionId: targetId };
        }

        // 2. SURVIVAL: HEAL (Priority #2)
        if (self.hp < 70) {
            const med = self.inventory.find((i: any) => i.category === 'recovery');
            if (med) return { type: 'use_item', itemId: med.id };
            
            // If low HP and near medical facility, interact
            const medFacility = currentRegion.interactables?.find((f: any) => f.type === 'medical_facility' && !f.isUsed);
            if (medFacility && self.ep >= 1) return { type: 'interact', interactableId: medFacility.id };
        }

        // 3. EQUIPMENT: EQUIP BEST WEAPON
        const bestWeapon = self.inventory.filter((i: any) => i.category === 'weapon').sort((a: any, b: any) => b.atkBonus - a.atkBonus)[0];
        if (bestWeapon && (!self.equippedWeapon || bestWeapon.atkBonus > self.equippedWeapon.atkBonus)) {
            return { type: 'equip', itemId: bestWeapon.id };
        }

        // 4. COMBAT: OPPORTUNISTIC KILLING (Priority #3)
        // Only fight if we have high advantage or target is near death
        const weakAgent = visibleAgents.filter((a: any) => a.isAlive).sort((a: any, b: any) => a.hp - b.hp)[0];
        if (weakAgent && self.ep >= 2) {
            const damage = self.atk + (self.equippedWeapon?.atkBonus || 0) - (weakAgent.def * 0.5);
            if (weakAgent.hp <= damage || (self.hp > 80 && weakAgent.hp < 50)) {
                return { type: 'attack', targetId: weakAgent.id, targetType: 'agent' };
            }
        }

        // 5. LOOTING: RUINS & CACHES
        if (currentRegion.terrain === 'ruins' && self.ep >= 1) {
            return { type: 'explore' };
        }
        
        const cache = currentRegion.interactables?.find((f: any) => f.type === 'supply_cache' && !f.isUsed);
        if (cache && self.ep >= 1) return { type: 'interact', interactableId: cache.id };

        // 6. POSITIONING: HILLS FOR VISION
        if (currentRegion.terrain !== 'hills') {
            const hill = connectedRegions.find((r: any) => typeof r === 'object' && r.terrain === 'hills' && !r.isDeathZone);
            if (hill) return { type: 'move', regionId: hill.id };
        }

        // 7. ENERGY MANAGEMENT
        if (self.ep < 3) return { type: 'rest' };

        // 8. DEFAULT: EXPLORE OR MOVE
        if (self.ep > 7) return { type: 'explore' };
        
        const randomMove = connectedRegions[Math.floor(Math.random() * connectedRegions.length)];
        const moveId = typeof randomMove === 'object' ? randomMove.id : randomMove;
        return { type: 'move', regionId: moveId };
    },

    // Balanced high-win strategy
    WINNER: (state: any) => {
        const { self, visibleAgents, currentRegion, connectedRegions, visibleMonsters, pendingDeathzones } = state;
        
        // 1. ESCAPE DEATH ZONE
        const isInDanger = currentRegion.isDeathZone || pendingDeathzones?.some((d: any) => d.id === currentRegion.id);
        if (isInDanger) {
            const safeRegion = connectedRegions.find((r: any) => typeof r === 'object' && !r.isDeathZone && !pendingDeathzones?.some((d: any) => d.id === r.id));
            const targetId = safeRegion ? safeRegion.id : (typeof connectedRegions[0] === 'object' ? connectedRegions[0].id : connectedRegions[0]);
            return { type: 'move', regionId: targetId };
        }

        // 2. HEAL
        if (self.hp < 60) {
            const med = self.inventory.find((i: any) => i.category === 'recovery');
            if (med) return { type: 'use_item', itemId: med.id };
        }

        // 3. ATTACK WEAK AGENTS
        const target = visibleAgents.filter((a: any) => a.isAlive).sort((a: any, b: any) => a.hp - b.hp)[0];
        if (target && self.ep >= 2 && (target.hp < 40 || self.hp > 80)) {
            return { type: 'attack', targetId: target.id, targetType: 'agent' };
        }

        // 4. EXPLORE / MOVE
        if (self.ep > 5) return { type: 'explore' };
        const randomMove = connectedRegions[Math.floor(Math.random() * connectedRegions.length)];
        const moveId = typeof randomMove === 'object' ? randomMove.id : randomMove;
        return { type: 'move', regionId: moveId };
    },

    SNIPER: (state: any) => {
        const { self, visibleAgents, connectedRegions } = state;
        const target = visibleAgents.find((a: any) => a.isAlive);
        if (target && self.equippedWeapon?.range >= 1 && self.ep >= 2) {
            return { type: 'attack', targetId: target.id, targetType: 'agent' };
        }
        const hills = connectedRegions.find((r: any) => typeof r === 'object' && r.terrain === 'hills');
        if (hills) return { type: 'move', regionId: hills.id };
        return Strategies.WINNER(state);
    },

    BERSERKER: (state: any) => {
        const { self, visibleAgents, visibleMonsters } = state;
        const target = visibleAgents.find((a: any) => a.isAlive) || visibleMonsters[0];
        if (target && self.ep >= 2) return { type: 'attack', targetId: target.id, targetType: target.id.startsWith('agent') ? 'agent' : 'monster' };
        return Strategies.WINNER(state);
    },

    NINJA: (state: any) => {
        const { currentRegion, connectedRegions } = state;
        if (currentRegion.terrain !== 'forest' && currentRegion.terrain !== 'ruins') {
            const hideout = connectedRegions.find((r: any) => typeof r === 'object' && (r.terrain === 'forest' || r.terrain === 'ruins'));
            if (hideout) return { type: 'move', regionId: hideout.id };
        }
        return Strategies.WINNER(state);
    },

    AGENT: (state: any) => Strategies.WINNER(state),
    HUNTER: (state: any) => Strategies.WINNER(state),
    FARMER: (state: any) => Strategies.WINNER(state),
    SURVIVOR: (state: any) => Strategies.WINNER(state),
    ASSASSIN: (state: any) => Strategies.WINNER(state),
    LOOTER: (state: any) => Strategies.WINNER(state),
    WARRIOR: (state: any) => Strategies.WINNER(state),
    GHOST: (state: any) => Strategies.WINNER(state),
    SCAVENGER: (state: any) => Strategies.WINNER(state),
    MEDIC: (state: any) => Strategies.WINNER(state),
    STALKER: (state: any) => Strategies.WINNER(state),
    PALADIN: (state: any) => Strategies.WINNER(state),
    RAIDER: (state: any) => Strategies.WINNER(state)
};

const activeBots = new Map<number, boolean>();
const finishedGames = new Set<string>();

async function safeApi(path: string, apiKey: string, method = 'GET', body = null) {
    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method, 
            headers: { 
                'Content-Type': 'application/json', 
                'X-API-Key': apiKey 
            },
            body: body ? JSON.stringify(body) : null
        });
        const json = await res.json();
        return json;
    } catch (e) { 
        return { success: false, error: { message: "Network error" } }; 
    }
}

async function findMe(apiKey: string, botName: string, hintGameId?: string) {
    try {
        // Priority 1: Use the official /accounts/me endpoint (New in v1.0.0)
        // This is the most efficient way to find active games for an account
        const meRes = await safeApi('/accounts/me', apiKey);
        if (meRes.success && meRes.data?.currentGames) {
            const activeGame = meRes.data.currentGames.find((g: any) => 
                g.gameStatus !== 'finished' && 
                (hintGameId ? g.gameId === hintGameId : true)
            );
            if (activeGame && activeGame.isAlive) {
                return { gameId: activeGame.gameId, agentId: activeGame.agentId };
            }
        }

        // Priority 2: Check the hint game ID specifically if provided (Fallback)
        if (hintGameId) {
            const state = await safeApi(`/games/${hintGameId}/state`, apiKey);
            if (state.success && state.data?.agents) {
                const me = state.data.agents.find((a: any) => a.name.toLowerCase().trim() === botName.toLowerCase().trim());
                if (me && me.isAlive) return { gameId: hintGameId, agentId: me.id };
            }
        }

        // Priority 3: Scan active and waiting games (Last resort)
        for (const status of ['running', 'waiting']) {
            const games = await safeApi(`/games?status=${status}`, apiKey);
            if (games.success && games.data) {
                for (const g of games.data.slice(0, 15)) { // Reduced scan range since we have /accounts/me
                    if (finishedGames.has(g.id) || g.id === hintGameId) continue;
                    const state = await safeApi(`/games/${g.id}/state`, apiKey);
                    if (state.success && state.data?.agents) {
                        const me = state.data.agents.find((a: any) => a.name.toLowerCase().trim() === botName.toLowerCase().trim());
                        if (me) {
                            if (me.isAlive) return { gameId: g.id, agentId: me.id };
                            else finishedGames.add(g.id);
                        }
                    }
                }
            }
        }
    } catch (err) {
        console.error("Error in findMe:", err);
    }
    return null;
}

async function botLoop(botId: number) {
    const bot = db.prepare("SELECT * FROM bots WHERE id = ?").get(botId) as any;
    if (!bot || bot.status !== 'running') return;

    activeBots.set(botId, true);
    console.log(`[${bot.name}] Loop started.`);

    while (activeBots.get(botId)) {
        try {
            const currentBot = db.prepare("SELECT * FROM bots WHERE id = ?").get(botId) as any;
            if (!currentBot || currentBot.status !== 'running') break;

            // 0. Auto-Wallet Sync (v1.0.0 Requirement)
            if (!currentBot.walletAddress) {
                console.log(`[${currentBot.name}] Missing wallet. Generating and syncing...`);
                const wallet = Wallet.createRandom();
                const wallet_address = wallet.address;
                const privateKey = wallet.privateKey;
                
                const syncRes = await safeApi('/accounts/wallet', currentBot.apiKey, 'PUT', { wallet_address });
                if (syncRes.success) {
                    db.prepare("UPDATE bots SET walletAddress = ?, privateKey = ? WHERE id = ?").run(wallet_address, privateKey, botId);
                    console.log(`[${currentBot.name}] Wallet synced: ${wallet_address}`);
                }
            }

            let gameId = currentBot.gameId;
            let agentId = currentBot.agentId;

            // 1. Check if we are already in an active game (using gameId as hint)
            if (!agentId || !gameId) {
                const existing = await findMe(currentBot.apiKey, currentBot.name, currentBot.gameId);
                if (existing) {
                    gameId = existing.gameId;
                    agentId = existing.agentId;
                    console.log(`[${currentBot.name}] Found active session in game ${gameId}`);
                    db.prepare("UPDATE bots SET gameId = ?, agentId = ? WHERE id = ?").run(gameId, agentId, botId);
                }
            }

            // 2. If not in a game, try to join or create one
            if (!agentId) {
                db.prepare("UPDATE bots SET lastAction = ? WHERE id = ?").run("Searching for room...", botId);
                
                let target: any = null;

                // Priority 1: Check if a manual gameId was provided and is joinable
                if (currentBot.gameId) {
                    console.log(`[${currentBot.name}] Checking manual game: ${currentBot.gameId}`);
                    const manualGame = await safeApi(`/games/${currentBot.gameId}`, currentBot.apiKey);
                    if (manualGame.success && manualGame.data.status === 'waiting') {
                        target = manualGame.data;
                    } else if (manualGame.success && manualGame.data.status === 'running') {
                        console.log(`[${currentBot.name}] Manual game ${currentBot.gameId} is already running. Cannot join new.`);
                    }
                }

                // Priority 2: Automatic search
                if (!target) {
                    let games = await safeApi('/games?status=waiting', currentBot.apiKey);
                    if (games.success && games.data) {
                        target = games.data.find((g: any) => g.entryType === 'free' && g.agentCount < g.maxAgents);
                    }
                }
                
                // Priority 3: Create game
                if (!target && !currentBot.gameId) { // Only auto-create if no manual ID was set
                    console.log(`[${currentBot.name}] No rooms found. Creating new...`);
                    const newGame = await safeApi('/games', currentBot.apiKey, 'POST', { 
                        hostName: `${currentBot.name}'s Arena`,
                        mapSize: 'massive',
                        entryType: 'free'
                    });
                    if (newGame.success) target = newGame.data;
                }

                if (target) {
                    const reg = await safeApi(`/games/${target.id}/agents/register`, currentBot.apiKey, 'POST', { name: currentBot.name });
                    if (reg.success) {
                        gameId = target.id;
                        agentId = reg.data.id;
                        console.log(`[${currentBot.name}] Registered in game ${gameId}`);
                    } else {
                        const err = reg.error || {};
                        console.log(`[${currentBot.name}] Reg failed: ${err.code} - ${err.message}`);
                        
                        if (err.code === 'TOO_MANY_AGENTS_PER_IP') {
                            console.log(`[${currentBot.name}] IP Limit reached for this game. Waiting for next...`);
                            db.prepare("UPDATE bots SET lastAction = ? WHERE id = ?").run("IP Limit Reached (Waiting...)", botId);
                            await new Promise(r => setTimeout(r, 60000));
                            continue;
                        }

                        if (err.code === 'ACCOUNT_ALREADY_IN_GAME' || err.code === 'ONE_AGENT_PER_API_KEY') {
                            // Try to extract game ID from error message if present
                            const gameIdMatch = err.message?.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
                            const extractedGameId = gameIdMatch ? gameIdMatch[0] : null;
                            
                            const retry = await findMe(currentBot.apiKey, currentBot.name, extractedGameId || undefined);
                            if (retry) {
                                gameId = retry.gameId;
                                agentId = retry.agentId;
                            }
                        }
                    }
                }
            }

            if (!agentId) {
                db.prepare("UPDATE bots SET lastAction = ?, gameId = ?, agentId = ? WHERE id = ?").run("Waiting for room availability...", null, null, botId);
                await new Promise(r => setTimeout(r, 15000));
                continue;
            }

            db.prepare("UPDATE bots SET gameId = ?, agentId = ? WHERE id = ?").run(gameId, agentId, botId);

            // 3. Main Game Loop
            while (activeBots.get(botId)) {
                const stateRes = await safeApi(`/games/${gameId}/agents/${agentId}/state`, currentBot.apiKey);
                
                if (!stateRes.success) {
                    // Check if game actually exists or we were kicked
                    const gameCheck = await safeApi(`/games/${gameId}`, currentBot.apiKey);
                    if (!gameCheck.success || gameCheck.data.status === 'finished') {
                        console.log(`[${currentBot.name}] Game ${gameId} ended or not found.`);
                        break;
                    }
                    await new Promise(r => setTimeout(r, 10000));
                    continue;
                }

                const state = stateRes.data;
                
                if (state.gameStatus === 'finished' || !state.self.isAlive) {
                    console.log(`[${currentBot.name}] Game finished or agent died.`);
                    finishedGames.add(gameId);
                    db.prepare("UPDATE bots SET isAlive = 0, lastAction = 'Game Over / Eliminated' WHERE id = ?").run(botId);
                    break;
                }

                db.prepare("UPDATE bots SET hp = ?, ep = ?, isAlive = 1 WHERE id = ?").run(state.self.hp, state.self.ep, botId);

                if (state.gameStatus === 'waiting') {
                    db.prepare("UPDATE bots SET lastAction = 'Waiting for start...' WHERE id = ?").run(botId);
                    await new Promise(r => setTimeout(r, 10000));
                    continue;
                }

                // Auto actions (Free)
                const item = state.visibleItems.find((i: any) => i.regionId === state.self.regionId);
                if (item && state.self.inventory.length < 10) {
                    await safeApi(`/games/${gameId}/agents/${agentId}/action`, currentBot.apiKey, 'POST', { action: { type: 'pickup', itemId: item.item.id } });
                }

                const wpn = state.self.inventory.filter((i: any) => i.category === 'weapon').sort((a: any, b: any) => b.atkBonus - a.atkBonus)[0];
                if (wpn && (!state.self.equippedWeapon || wpn.atkBonus > state.self.equippedWeapon.atkBonus)) {
                    await safeApi(`/games/${gameId}/agents/${agentId}/action`, currentBot.apiKey, 'POST', { action: { type: 'equip', itemId: wpn.id } });
                }

                // Strategy Action
                const strategyFn = (Strategies as any)[currentBot.role] || Strategies.AGENT;
                const act = state.currentRegion.isDeathZone ? { type: 'move', regionId: state.currentRegion.connections[0] } : strategyFn(state);
                
                const thoughts = [
                    `Role ${currentBot.role}: Analyzing terrain for tactical advantage.`,
                    `Role ${currentBot.role}: Scanning for potential threats and loot.`,
                    `Role ${currentBot.role}: Prioritizing survival and resource management.`,
                    `Role ${currentBot.role}: Calculating optimal path to safe zone.`,
                    `Role ${currentBot.role}: Evaluating combat readiness and equipment.`
                ];
                const randomThought = thoughts[Math.floor(Math.random() * thoughts.length)];

                const actionRes = await safeApi(`/games/${gameId}/agents/${agentId}/action`, currentBot.apiKey, 'POST', { 
                    action: act, 
                    thought: { 
                        reasoning: randomThought, 
                        plannedAction: `Executing ${act.type} to maintain survival.` 
                    } 
                });

                if (actionRes.success) {
                    db.prepare("UPDATE bots SET lastAction = ? WHERE id = ?").run(`Action: ${act.type}`, botId);
                } else {
                    db.prepare("UPDATE bots SET lastAction = ? WHERE id = ?").run(`Error: ${actionRes.error?.message || 'Action failed'}`, botId);
                }
                
                await new Promise(r => setTimeout(r, 61000));
            }
            
            // Reset game state in DB after game ends to allow re-registration
            db.prepare("UPDATE bots SET gameId = null WHERE id = ?").run(botId);
            
        } catch (err) {
            console.error(`Error in bot ${botId}:`, err);
            await new Promise(r => setTimeout(r, 10000));
        }
    }
    activeBots.delete(botId);
}

// API Routes
app.get("/api/bots", (req, res) => {
    const bots = db.prepare("SELECT * FROM bots").all();
    res.json(bots);
});

app.post("/api/bots/register", async (req, res) => {
    const { name, role } = req.body;
    try {
        console.log(`[System] Attempting to register account: ${name}`);
        
        // Generate real Ethereum wallet
        const wallet = Wallet.createRandom();
        const wallet_address = wallet.address;
        const privateKey = wallet.privateKey;

        const regRes = await fetch(`${BASE_URL}/accounts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, wallet_address })
        });
        
        const status = regRes.status;
        const json = await regRes.json();
        
        if (json.success) {
            const info = db.prepare("INSERT INTO bots (name, apiKey, role, walletAddress, privateKey) VALUES (?, ?, ?, ?, ?)").run(
                json.data.name, 
                json.data.apiKey, 
                role,
                wallet_address,
                privateKey
            );
            console.log(`[System] Registration successful for ${name} with wallet ${wallet_address}`);
            res.json({ success: true, id: info.lastInsertRowid });
        } else {
            // Detailed error extraction
            let errMsg = "Registration failed";
            if (json.error && json.error.message) errMsg = json.error.message;
            else if (json.message) errMsg = json.message;
            
            if (status === 403) errMsg = "IP Limit Reached (Max 5 accounts per IP)";
            
            console.error(`[System] Registration failed (${status}) for ${name}: ${errMsg}`);
            res.status(status).json({ 
                success: false, 
                message: errMsg,
                raw: json
            });
        }
    } catch (e: any) {
        console.error(`[System] Server error during registration:`, e.message);
        res.status(500).json({ success: false, message: "Internal server error connecting to Molty Royale" });
    }
});

app.post("/api/bots/bulk-register", async (req, res) => {
    const { count = 50 } = req.body;
    const results = [];
    const prefixes = ['Shadow', 'Ghost', 'Silent', 'Dark', 'Swift', 'Iron', 'Steel', 'Void', 'Neon', 'Cyber'];
    const suffixes = ['Hunter', 'Blade', 'Stalker', 'Wraith', 'Reaper', 'Knight', 'Slayer', 'Wolf', 'Raven', 'Storm'];

    for (let i = 0; i < count; i++) {
        const name = `${prefixes[Math.floor(Math.random() * prefixes.length)]} ${suffixes[Math.floor(Math.random() * suffixes.length)]} ${Math.floor(Math.random() * 999)}`;
        const role = ROLES[Math.floor(Math.random() * ROLES.length)];
        
        // Generate real Ethereum wallet
        const wallet = Wallet.createRandom();
        const wallet_address = wallet.address;
        const privateKey = wallet.privateKey;
        
        try {
            const regRes = await fetch(`${BASE_URL}/accounts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, wallet_address })
            });
            const json = await regRes.json();
            if (json.success) {
                db.prepare("INSERT INTO bots (name, apiKey, role, walletAddress, privateKey) VALUES (?, ?, ?, ?, ?)").run(
                    json.data.name, 
                    json.data.apiKey, 
                    role,
                    wallet_address,
                    privateKey
                );
                results.push({ name, success: true, walletAddress: wallet_address });
            } else {
                results.push({ name, success: false, message: json.message });
                if (json.message?.toLowerCase().includes('ip') || json.message?.toLowerCase().includes('limit')) break;
            }
        } catch (e) {
            results.push({ name, success: false, message: "Network error" });
        }
        await new Promise(r => setTimeout(r, 500));
    }
    res.json({ success: true, results });
});

app.post("/api/bots/add", (req, res) => {
    const { name, apiKey, role, walletAddress, privateKey } = req.body;
    try {
        const info = db.prepare("INSERT INTO bots (name, apiKey, role, walletAddress, privateKey) VALUES (?, ?, ?, ?, ?)").run(
            name, 
            apiKey, 
            role, 
            walletAddress || null, 
            privateKey || null
        );
        res.json({ success: true, id: info.lastInsertRowid });
    } catch (e) {
        res.status(400).json({ success: false, message: "API Key already exists or invalid data" });
    }
});

app.post("/api/bots/start-all", (req, res) => {
    const bots = db.prepare("SELECT id FROM bots WHERE status = 'stopped'").all() as any[];
    bots.forEach(b => {
        db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(b.id);
        botLoop(b.id);
    });
    res.json({ success: true, count: bots.length });
});

app.post("/api/bots/stop-all", (req, res) => {
    const bots = db.prepare("SELECT id FROM bots WHERE status = 'running'").all() as any[];
    bots.forEach(b => {
        db.prepare("UPDATE bots SET status = 'stopped', lastAction = 'Stopped' WHERE id = ?").run(b.id);
        activeBots.set(b.id, false);
    });
    res.json({ success: true, count: bots.length });
});

app.post("/api/bots/delete-all", (req, res) => {
    console.log("[System] Deleting all bots...");
    try {
        // Stop all bots first
        const bots = db.prepare("SELECT id FROM bots").all() as any[];
        bots.forEach(b => activeBots.set(b.id, false));
        
        const info = db.prepare("DELETE FROM bots").run();
        console.log(`[System] Deleted all bots. Changes: ${info.changes}`);
        res.json({ success: true });
    } catch (e: any) {
        console.error("[System] Failed to delete all bots:", e.message);
        res.status(500).json({ success: false, message: "Failed to delete all bots" });
    }
});

app.post("/api/bots/:id/start", (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare("UPDATE bots SET status = 'running' WHERE id = ?").run(id);
    botLoop(id);
    res.json({ success: true });
});

app.post("/api/bots/:id/stop", (req, res) => {
    const id = parseInt(req.params.id);
    db.prepare("UPDATE bots SET status = 'stopped', lastAction = 'Stopped' WHERE id = ?").run(id);
    activeBots.set(id, false);
    res.json({ success: true });
});

app.post("/api/bots/:id/set-game", (req, res) => {
    const id = parseInt(req.params.id);
    const { gameId } = req.body;
    db.prepare("UPDATE bots SET gameId = ? WHERE id = ?").run(gameId || null, id);
    res.json({ success: true });
});

app.delete("/api/bots/:id", (req, res) => {
    const id = parseInt(req.params.id);
    console.log(`[System] Deleting bot ID: ${id}`);
    try {
        activeBots.set(id, false);
        const info = db.prepare("DELETE FROM bots WHERE id = ?").run(id);
        console.log(`[System] Deleted bot ${id}. Changes: ${info.changes}`);
        res.json({ success: true });
    } catch (e: any) {
        console.error(`[System] Failed to delete bot ${id}:`, e.message);
        res.status(500).json({ success: false, message: "Failed to delete bot" });
    }
});

async function startServer() {
    const PORT = 3000;

    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        app.use(express.static(path.join(__dirname, "dist")));
    }

    async function updateAccountStats() {
    const bots = db.prepare("SELECT * FROM bots").all() as any[];
    for (const bot of bots) {
        if (!bot.apiKey) continue;
        const res = await safeApi("/accounts/me", bot.apiKey);
        if (res.success) {
            const d = res.data;
            db.prepare("UPDATE bots SET balance = ?, totalWins = ?, totalGames = ? WHERE id = ?")
              .run(d.balance, d.totalWins, d.totalGames, bot.id);
        }
    }
}

// Update stats every 5 minutes
setInterval(updateAccountStats, 5 * 60 * 1000);
// Initial update
updateAccountStats();

app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://0.0.0.0:${PORT}`);
        console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
        
        // Resume running bots
        try {
            const runningBots = db.prepare("SELECT id FROM bots WHERE status = 'running'").all() as any[];
            console.log(`Resuming ${runningBots.length} bots...`);
            runningBots.forEach(b => botLoop(b.id));
        } catch (err) {
            console.error("Failed to resume bots:", err);
        }
    });
}

startServer().catch(err => {
    console.error("Failed to start server:", err);
    process.exit(1);
});
