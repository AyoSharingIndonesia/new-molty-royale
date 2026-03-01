import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Square, 
  Trash2, 
  Plus, 
  Shield, 
  Sword, 
  Heart, 
  Zap, 
  Activity,
  UserPlus,
  Settings,
  RefreshCw,
  Skull,
  Copy,
  Download,
  Upload,
  Trophy,
  Coins,
  Check,
  Eye,
  EyeOff,
  Info,
  Target,
  Youtube,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface Bot {
  id: number;
  name: string;
  apiKey: string;
  role: string;
  status: 'running' | 'stopped';
  lastAction: string;
  gameId: string | null;
  hp: number | null;
  ep: number | null;
  isAlive: number;
  balance: number;
  totalWins: number;
  totalGames: number;
  walletAddress?: string;
  privateKey?: string;
}

const ROLES = [
  'ULTIMATE_SURVIVOR', 'AGENT', 'HUNTER', 'FARMER', 'SURVIVOR', 'ASSASSIN', 'LOOTER',
  'SNIPER', 'BERSERKER', 'NINJA', 'WARRIOR', 'GHOST', 'SCAVENGER',
  'MEDIC', 'STALKER', 'PALADIN', 'RAIDER'
];

export default function App() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [newName, setNewName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [newRole, setNewRole] = useState('AGENT');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [showKeyId, setShowKeyId] = useState<number | null>(null);
  const [showWalletKeyId, setShowWalletKeyId] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editingGameBotId, setEditingGameBotId] = useState<number | null>(null);
  const [manualGameId, setManualGameId] = useState('');

  const fetchBots = async (retryCount = 0) => {
    try {
      const res = await fetch('/api/bots');
      if (!res.ok) throw new Error(`Server responded with ${res.status}`);
      const data = await res.json();
      setBots(data);
    } catch (err) {
      console.error('Failed to fetch bots', err);
      // Silent retry for the first few attempts during startup
      if (retryCount < 5) {
        setTimeout(() => fetchBots(retryCount + 1), 2000);
      }
    }
  };

  useEffect(() => {
    fetchBots();
    const interval = setInterval(fetchBots, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleStartAll = async () => {
    await fetch('/api/bots/start-all', { method: 'POST' });
    fetchBots();
  };

  const handleStopAll = async () => {
    await fetch('/api/bots/stop-all', { method: 'POST' });
    fetchBots();
  };

  const handleBulkRegister = async () => {
    if (!confirm('This will attempt to register 5 new agents. Note: Server IP limits may apply. Continue?')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/bots/bulk-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: 5 })
      });
      const data = await res.json();
      alert(`Bulk registration complete. Check logs for details.`);
      fetchBots();
    } catch (err) {
      console.error('Bulk registration failed', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete ALL agents? This cannot be undone.')) return;
    setLoading(true);
    try {
      const res = await fetch('/api/bots/delete-all', { method: 'POST' });
      if (res.ok) {
        await fetchBots();
      } else {
        const data = await res.json();
        alert(`Failed to delete all bots: ${data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to delete all bots', err);
      alert('Network error while deleting bots');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/bots/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, apiKey: newApiKey, role: newRole })
      });
      if (res.ok) {
        setIsAdding(false);
        setNewName('');
        setNewApiKey('');
        fetchBots();
      }
    } catch (err) {
      alert('Failed to add bot');
    } finally {
      setLoading(false);
    }
  };

  const handleRegisterBot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/bots/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName, role: newRole })
      });
      if (res.ok) {
        setIsRegistering(false);
        setNewName('');
        fetchBots();
      } else {
        const data = await res.json();
        alert(data.message || 'Registration failed');
      }
    } catch (err) {
      alert('Failed to register bot');
    } finally {
      setLoading(false);
    }
  };

  const toggleBot = async (bot: Bot) => {
    const action = bot.status === 'running' ? 'stop' : 'start';
    await fetch(`/api/bots/${bot.id}/${action}`, { method: 'POST' });
    fetchBots();
  };

  const deleteBot = async (id: number) => {
    if (confirm('Are you sure you want to delete this bot?')) {
      setLoading(true);
      try {
        const res = await fetch(`/api/bots/${id}`, { method: 'DELETE' });
        if (res.ok) {
          await fetchBots();
        } else {
          const data = await res.json();
          alert(`Failed to delete bot: ${data.message || 'Unknown error'}`);
        }
      } catch (err) {
        console.error('Failed to delete bot', err);
        alert('Network error while deleting bot');
      } finally {
        setLoading(false);
      }
    }
  };

  const setBotGame = async (id: number, gId: string) => {
    try {
      const res = await fetch(`/api/bots/${id}/set-game`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: gId })
      });
      if (res.ok) {
        fetchBots();
        setEditingGameBotId(null);
        setManualGameId('');
      }
    } catch (err) {
      console.error('Failed to set game ID', err);
    }
  };

  const copyToClipboard = (text: string, id: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const exportAllBots = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(bots, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mort_royal_bots_export.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const importedBots = JSON.parse(content);
        
        if (!Array.isArray(importedBots)) {
          alert('Invalid JSON format. Expected an array of bots.');
          return;
        }

        setLoading(true);
        let successCount = 0;
        let failCount = 0;

        for (const bot of importedBots) {
          try {
            const res = await fetch('/api/bots/add', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                name: bot.name, 
                apiKey: bot.apiKey, 
                role: bot.role || 'HUNTER',
                walletAddress: bot.walletAddress,
                privateKey: bot.privateKey
              })
            });
            if (res.ok) successCount++;
            else failCount++;
          } catch (err) {
            failCount++;
          }
        }

        alert(`Import complete!\nSuccess: ${successCount}\nFailed: ${failCount} (likely duplicates)`);
        fetchBots();
      } catch (err) {
        alert('Failed to parse JSON file.');
      } finally {
        setLoading(false);
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'AGENT': return <UserPlus className="w-4 h-4" />;
      case 'HUNTER': return <Sword className="w-4 h-4" />;
      case 'FARMER': return <Shield className="w-4 h-4" />;
      case 'SURVIVOR': return <Heart className="w-4 h-4" />;
      case 'ASSASSIN': return <Activity className="w-4 h-4" />;
      case 'LOOTER': return <Zap className="w-4 h-4" />;
      default: return <Settings className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 font-sans selection:bg-emerald-500/30">
      {/* Hidden File Input */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".json" 
        className="hidden" 
      />

      {/* Header */}
      <header className="border-b border-white/5 bg-black/40 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Activity className="text-black w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">MOLTY ROYALE</h1>
              <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest">Bot Control Center</p>
            </div>
          </div>
          
          <div className="flex gap-3">
            {bots.length > 0 && (
              <>
                <button 
                  onClick={handleStopAll}
                  className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 rounded-lg transition-all text-sm font-medium text-rose-500"
                  title="Stop all running bots"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop All
                </button>
                <button 
                  onClick={handleStartAll}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 rounded-lg transition-all text-sm font-medium text-emerald-500"
                  title="Start all stopped bots"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start All
                </button>
              </>
            )}
            <button 
              onClick={handleImportClick}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium text-zinc-400"
              title="Import bots from JSON"
            >
              <Upload className="w-4 h-4" />
              Import JSON
            </button>
            {bots.length > 0 && (
              <button 
                onClick={exportAllBots}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium text-zinc-400"
                title="Export all bots to JSON"
              >
                <Download className="w-4 h-4" />
                Export All
              </button>
            )}
            <button 
              onClick={() => { setIsAdding(true); setIsRegistering(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg transition-all text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Existing
            </button>
            <button 
              onClick={handleBulkRegister}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-400 text-black rounded-lg transition-all text-sm font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50"
              title="Automatically register 5 new accounts"
            >
              <UserPlus className="w-4 h-4" />
              Bulk Register (5)
            </button>
            <button 
              onClick={handleDeleteAll}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 rounded-lg transition-all text-sm font-bold disabled:opacity-50"
              title="Delete all agents from database"
            >
              <Trash2 className="w-4 h-4" />
              Clear All
            </button>
            <button 
              onClick={() => { setIsRegistering(true); setIsAdding(false); }}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-400 text-black rounded-lg transition-all text-sm font-bold shadow-lg shadow-emerald-500/20"
            >
              <UserPlus className="w-4 h-4" />
              Register New
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-10">
        {/* Role Guide Section */}
        <section className="mb-12 bg-zinc-900/30 border border-white/5 rounded-3xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
              <Info className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Role Strategy Guide</h2>
              <p className="text-sm text-zinc-500">Setiap role memiliki logika pengambilan keputusan yang berbeda.</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
              <h3 className="text-emerald-500 font-bold text-sm mb-2 flex items-center gap-2">
                <Trophy className="w-4 h-4" /> ULTIMATE_SURVIVOR
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Role dengan win-rate tertinggi. Prioritas: Kabur dari Death Zone, Heal otomatis, Looting di Ruins, dan hanya menyerang musuh yang sekarat.
              </p>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
              <h3 className="text-blue-500 font-bold text-sm mb-2 flex items-center gap-2">
                <Target className="w-4 h-4" /> SNIPER
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Mencari dataran tinggi (Hills) untuk bonus vision. Menyerang dari jarak jauh jika memiliki senjata ranged.
              </p>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
              <h3 className="text-rose-500 font-bold text-sm mb-2 flex items-center gap-2">
                <Zap className="w-4 h-4" /> BERSERKER
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Sangat agresif. Akan menyerang Agent atau Monster terdekat tanpa ragu selama EP mencukupi.
              </p>
            </div>
            <div className="bg-black/40 p-4 rounded-2xl border border-white/5">
              <h3 className="text-amber-500 font-bold text-sm mb-2 flex items-center gap-2">
                <Shield className="w-4 h-4" /> NINJA
              </h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ahli stealth. Selalu mencari Forest atau Ruins untuk bersembunyi dan melakukan ambush.
              </p>
            </div>
          </div>
        </section>

        {/* Modals */}
        <AnimatePresence>
          {(isAdding || isRegistering) && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="bg-zinc-900 border border-white/10 p-8 rounded-2xl w-full max-w-md shadow-2xl"
              >
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3">
                  {isAdding ? <Plus className="text-emerald-500" /> : <UserPlus className="text-emerald-500" />}
                  {isAdding ? 'Add Existing Bot' : 'Register New Bot'}
                </h2>
                <form onSubmit={isAdding ? handleAddBot : handleRegisterBot} className="space-y-4">
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">Bot Name</label>
                    <input 
                      type="text" 
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                      placeholder="e.g. ShadowHunter"
                      required
                    />
                  </div>
                  {isAdding && (
                    <div>
                      <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">API Key</label>
                      <input 
                        type="password" 
                        value={newApiKey}
                        onChange={(e) => setNewApiKey(e.target.value)}
                        className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors"
                        placeholder="Your MOLTY ROYALE API Key"
                        required
                      />
                    </div>
                  )}
                  <div>
                    <label className="block text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">Strategy Role</label>
                    <select 
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value)}
                      className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-emerald-500 transition-colors appearance-none"
                    >
                      {ROLES.map(role => <option key={role} value={role}>{role}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-3 pt-4">
                    <button 
                      type="button"
                      onClick={() => { setIsAdding(false); setIsRegistering(false); }}
                      className="flex-1 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-xl transition-colors font-medium"
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit"
                      disabled={loading}
                      className="flex-1 px-4 py-3 bg-emerald-500 hover:bg-emerald-400 text-black rounded-xl transition-colors font-bold disabled:opacity-50"
                    >
                      {loading ? 'Processing...' : (isAdding ? 'Add Bot' : 'Register')}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bot Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {bots.length === 0 ? (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <Skull className="text-zinc-600 w-8 h-8" />
              </div>
              <h3 className="text-xl font-medium text-zinc-400">No bots active</h3>
              <p className="text-zinc-600 mt-2">Register a new bot to start dominating the arena.</p>
            </div>
          ) : (
            bots.map((bot) => (
              <motion.div 
                layout
                key={bot.id}
                className={`group relative bg-zinc-900/50 border ${bot.status === 'running' ? 'border-emerald-500/30 shadow-lg shadow-emerald-500/5' : 'border-white/5'} rounded-2xl p-6 transition-all hover:border-white/20 overflow-hidden`}
              >
                {/* Status Indicator */}
                <div className="absolute top-0 right-0 p-4">
                  <div className={`flex items-center gap-2 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${bot.status === 'running' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${bot.status === 'running' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-600'}`}></span>
                    {bot.status}
                  </div>
                </div>

                <div className="flex items-start gap-4 mb-6">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${bot.status === 'running' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
                    {getRoleIcon(bot.role)}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight">{bot.name}</h3>
                    <p className="text-xs text-zinc-500 font-mono">{bot.role}</p>
                  </div>
                </div>

                <div className="space-y-4 mb-8">
                  {/* API Key Section */}
                  <div className="bg-black/40 rounded-xl p-3 border border-white/5 relative group/key">
                    <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                      <span>API Key</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => setShowKeyId(showKeyId === bot.id ? null : bot.id)}
                          className="hover:text-zinc-300 transition-colors"
                        >
                          {showKeyId === bot.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        </button>
                        <button 
                          onClick={() => copyToClipboard(bot.apiKey, bot.id)}
                          className="hover:text-zinc-300 transition-colors"
                        >
                          {copiedId === bot.id ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] font-mono break-all text-zinc-400">
                      {showKeyId === bot.id ? bot.apiKey : '••••••••••••••••••••••••••••••••'}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="bg-black/40 rounded-xl p-2 border border-white/5 text-center">
                      <div className="flex items-center justify-center gap-1 text-zinc-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">
                        <Coins className="w-2.5 h-2.5 text-amber-400" /> Moltz
                      </div>
                      <div className="text-sm font-mono font-bold text-amber-400">{bot.balance ?? 0}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-2 border border-white/5 text-center">
                      <div className="flex items-center justify-center gap-1 text-zinc-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">
                        <Trophy className="w-2.5 h-2.5 text-yellow-500" /> Wins
                      </div>
                      <div className="text-sm font-mono font-bold text-yellow-500">{bot.totalWins ?? 0}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-2 border border-white/5 text-center">
                      <div className="flex items-center justify-center gap-1 text-zinc-500 text-[9px] uppercase font-bold tracking-widest mb-0.5">
                        <Activity className="w-2.5 h-2.5 text-zinc-400" /> Games
                      </div>
                      <div className="text-sm font-mono font-bold text-zinc-300">{bot.totalGames ?? 0}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                        <Heart className="w-3 h-3 text-rose-500" /> HP
                      </div>
                      <div className="text-xl font-mono font-bold">{bot.hp ?? '--'}</div>
                    </div>
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                      <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                        <Zap className="w-3 h-3 text-amber-500" /> EP
                      </div>
                      <div className="text-xl font-mono font-bold">{bot.ep ?? '--'}</div>
                    </div>
                  </div>

                  <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                    <div className="flex items-center gap-2 text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                      <Activity className="w-3 h-3 text-blue-500" /> Last Action
                    </div>
                    <div className="text-sm font-medium truncate text-zinc-300">
                      {bot.lastAction || 'Initializing...'}
                    </div>
                  </div>

                  {/* Wallet Section */}
                  {bot.walletAddress && (
                    <div className="bg-black/40 rounded-xl p-3 border border-white/5 space-y-2">
                      <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase font-bold tracking-widest">
                        <div className="flex items-center gap-1">
                          <Shield className="w-3 h-3 text-emerald-500" /> Wallet
                        </div>
                        <button 
                          onClick={() => copyToClipboard(bot.walletAddress!, bot.id + 10000)}
                          className="hover:text-zinc-300 transition-colors"
                        >
                          {copiedId === bot.id + 10000 ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </div>
                      <div className="text-[10px] font-mono break-all text-zinc-400">
                        {bot.walletAddress}
                      </div>
                      
                      {bot.privateKey && (
                        <div className="pt-2 border-t border-white/5">
                          <div className="flex items-center justify-between text-zinc-500 text-[10px] uppercase font-bold tracking-widest mb-1">
                            <span>Private Key</span>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setShowWalletKeyId(showWalletKeyId === bot.id ? null : bot.id)}
                                className="hover:text-zinc-300 transition-colors"
                              >
                                {showWalletKeyId === bot.id ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                              <button 
                                onClick={() => copyToClipboard(bot.privateKey!, bot.id + 20000)}
                                className="hover:text-zinc-300 transition-colors"
                              >
                                {copiedId === bot.id + 20000 ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          <div className="text-[10px] font-mono break-all text-rose-400/80">
                            {showWalletKeyId === bot.id ? bot.privateKey : '••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••••'}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {editingGameBotId === bot.id ? (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Enter Game ID..."
                        className="flex-1 bg-transparent border-none outline-none text-xs font-mono text-blue-400 placeholder:text-blue-900"
                        value={manualGameId}
                        onChange={(e) => setManualGameId(e.target.value)}
                        autoFocus
                      />
                      <button 
                        onClick={() => setBotGame(bot.id, manualGameId)}
                        className="text-[10px] font-bold uppercase text-blue-400 hover:text-blue-300"
                      >
                        Save
                      </button>
                      <button 
                        onClick={() => { setEditingGameBotId(null); setManualGameId(''); }}
                        className="text-[10px] font-bold uppercase text-zinc-600 hover:text-zinc-400"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : bot.gameId ? (
                    <div className="flex items-center justify-between text-[10px] font-mono text-zinc-600 uppercase tracking-widest px-1">
                      <span>Game ID</span>
                      <span className="text-zinc-400">{bot.gameId.slice(0, 12)}...</span>
                    </div>
                  ) : null}
                </div>

                <div className="flex gap-2 relative z-50">
                  <button 
                    onClick={() => toggleBot(bot)}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-sm transition-all ${
                      bot.status === 'running' 
                        ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300' 
                        : 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/10'
                    }`}
                  >
                    {bot.status === 'running' ? (
                      <><Square className="w-4 h-4 fill-current" /> Stop</>
                    ) : (
                      <><Play className="w-4 h-4 fill-current" /> Start</>
                    )}
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingGameBotId(bot.id);
                      setManualGameId(bot.gameId || '');
                    }}
                    className="w-12 flex items-center justify-center bg-white/5 hover:bg-blue-500/20 hover:text-blue-500 text-zinc-500 rounded-xl transition-all border border-white/5"
                    title="Set manual Game ID"
                  >
                    <Settings className="w-5 h-5" />
                  </button>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteBot(bot.id);
                    }}
                    disabled={loading}
                    className="w-12 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 hover:text-rose-500 text-zinc-500 rounded-xl transition-all border border-white/5 disabled:opacity-50"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {bot.isAlive === 0 && bot.status === 'running' && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center p-6 text-center pointer-events-none">
                    <div className="bg-zinc-900 border border-rose-500/50 p-4 rounded-xl shadow-2xl pointer-events-auto">
                      <Skull className="text-rose-500 w-10 h-10 mx-auto mb-2" />
                      <h4 className="text-rose-500 font-bold uppercase tracking-widest text-xs">Agent Eliminated</h4>
                      <p className="text-[10px] text-zinc-500 mt-1">Waiting for next game registration...</p>
                    </div>
                  </div>
                )}
              </motion.div>
            ))
          )}
        </div>
      </main>

      {/* Footer Info */}
      <footer className="max-w-7xl mx-auto px-6 py-10 border-t border-white/5 mt-10">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-6 text-xs font-mono text-zinc-600 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
              System Online
            </div>
            <div className="flex items-center gap-2">
              <RefreshCw className="w-3 h-3 animate-spin-slow" />
              Auto-Sync Active
            </div>
          </div>
          <div className="text-[10px] text-zinc-700 font-mono">
            MOLTY ROYALE BOT v2.1.0 // DESIGNED FOR DOMINATION
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="https://youtube.com/@ayosharingindonesia" 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2 bg-rose-600/10 hover:bg-rose-600/20 text-rose-500 border border-rose-600/20 rounded-xl transition-all text-xs font-bold group"
            >
              <Youtube className="w-4 h-4" />
              <span>Support Ayo Sharing Indonesia</span>
              <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </a>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
      `}</style>
    </div>
  );
}
