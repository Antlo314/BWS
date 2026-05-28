'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User, 
  GoogleAuthProvider 
} from 'firebase/auth';
import { 
  collection, 
  getDocs, 
  doc, 
  updateDoc, 
  query, 
  orderBy,
  limit
} from 'firebase/firestore';
import { auth, db, googleProvider } from '@/lib/firebase';
import { 
  Lock, 
  Users, 
  Coins, 
  ShieldAlert, 
  Activity, 
  ArrowLeft,
  ArrowRight,
  LogOut,
  RefreshCw,
  Search,
  Check,
  Edit2
} from 'lucide-react';
import Link from 'next/link';

interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  bio?: string;
  organization?: string;
  balance: number;
  spending: number;
  classesMastered?: number;
  role: string;
  createdAt: string;
}

interface ActivityLog {
  id: string;
  timestamp: string;
  source: string;
  tradeType: string;
  value: string;
  message: string;
  status: string;
}

export default function LoginAdminPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  
  // Search & Edit states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newBalance, setNewBalance] = useState<string>('');
  const [updatingBalance, setUpdatingBalance] = useState<boolean>(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth State Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Authorize if user is the admin email
        const adminEmail = 'iamwhoiambook@gmail.com';
        if (user.email === adminEmail) {
          setIsAdmin(true);
          await loadDashboardData();
        } else {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
        setUsers([]);
        setActivities([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Fetch data
  const loadDashboardData = async () => {
    setRefreshing(true);
    try {
      // 1. Fetch user profiles
      const profilesSnapshot = await getDocs(collection(db, 'profiles'));
      const profilesList: UserProfile[] = [];
      profilesSnapshot.forEach((doc) => {
        const data = doc.data();
        profilesList.push({
          uid: doc.id,
          displayName: data.displayName || 'Unnamed User',
          email: data.email || '',
          bio: data.bio || '',
          organization: data.organization || '',
          balance: typeof data.balance === 'number' ? data.balance : 0,
          spending: typeof data.spending === 'number' ? data.spending : 0,
          role: data.role || 'user',
          createdAt: data.createdAt || new Date().toISOString()
        });
      });
      setUsers(profilesList);

      // 2. Fetch recent trades/activities
      const tradesQuery = query(collection(db, 'trades'), orderBy('timestamp', 'desc'), limit(15));
      const tradesSnapshot = await getDocs(tradesQuery);
      const tradesList: ActivityLog[] = [];
      tradesSnapshot.forEach((doc) => {
        const data = doc.data();
        tradesList.push({
          id: doc.id,
          timestamp: data.timestamp || '',
          source: data.source || 'Unknown',
          tradeType: data.tradeType || 'Action',
          value: data.value || '0 BWSX',
          message: data.message || '',
          status: data.status || 'CONFIRMED'
        });
      });
      setActivities(tradesList);
    } catch (error) {
      console.error('Failed to load dashboard data: ', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignIn = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error('Google Sign-In Error: ', error);
      let userFriendlyMsg = error?.message || String(error);
      if (error?.code === 'auth/unauthorized-domain') {
        userFriendlyMsg = "Domain Unauthorized: Please add 'bws-coral.vercel.app' to your Firebase Console Authorized Domains list (Auth > Settings > Authorized Domains).";
      } else if (error?.code === 'auth/popup-blocked') {
        userFriendlyMsg = "Popup Blocked: Please enable popups or login in a full browser window.";
      }
      setAuthError(userFriendlyMsg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Sign-Out Error: ', error);
    }
  };

  // Update user balance directly from backsite
  const handleUpdateBalance = async (uid: string) => {
    if (!newBalance || isNaN(Number(newBalance))) return;
    setUpdatingBalance(true);
    try {
      const userRef = doc(db, 'profiles', uid);
      await updateDoc(userRef, {
        balance: Number(newBalance)
      });
      // Update local state
      setUsers(prev => prev.map(u => u.uid === uid ? { ...u, balance: Number(newBalance) } : u));
      setEditingUserId(null);
      setNewBalance('');
    } catch (error) {
      console.error('Failed to update balance: ', error);
    } finally {
      setUpdatingBalance(false);
    }
  };

  // Filtered Users List
  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      u.role !== 'admin' && 
      u.email !== 'iamwhoiambook@gmail.com' &&
      (u.displayName.toLowerCase().includes(searchQuery.toLowerCase()) || 
       u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
       u.uid.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [users, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const regularUsers = users.filter(u => u.role !== 'admin' && u.email !== 'iamwhoiambook@gmail.com');
    const totalUsers = regularUsers.length;
    const totalBWSX = regularUsers.reduce((sum, u) => sum + (u.balance || 0), 0);
    const totalSpending = regularUsers.reduce((sum, u) => sum + (u.spending || 0), 0);
    return { totalUsers, totalBWSX, totalSpending };
  }, [users]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#09090b] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="w-8 h-8 text-[#eab308] animate-spin" />
          <p className="text-[10px] font-mono uppercase tracking-[0.25em] text-zinc-500">Securing admin terminal credentials...</p>
        </div>
      </div>
    );
  }

  // Case 1: Not logged in
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased relative flex flex-col justify-between overflow-hidden">
        {/* Obsidian & Gold Ambient Background */}
        <div className="absolute top-0 right-0 w-[450px] h-[450px] bg-gradient-to-br from-[#eab308]/5 via-[#ca8a04]/2 to-transparent blur-[120px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-[#ca8a04]/3 via-transparent to-transparent blur-[120px] rounded-full pointer-events-none" />

        {/* Back Link */}
        <header className="p-6">
          <Link href="/" className="inline-flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Landing Page</span>
          </Link>
        </header>

        {/* Login Container */}
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950/85 border border-[#ca8a04]/40 rounded-3xl p-8 shadow-[0_0_50px_rgba(234,179,8,0.05)] relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#ca8a04] to-transparent" />
            
            <div className="text-center space-y-6">
              <div className="w-12 h-12 mx-auto bg-gradient-to-br from-zinc-950 via-[#ca8a04] to-zinc-900 rounded-xl border border-[#eab308]/40 flex items-center justify-center shadow-lg">
                <Lock className="w-5 h-5 text-[#eab308]" />
              </div>
              
              <div className="space-y-2">
                <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-[0.25em] block">Cooperative Portal</span>
                <h2 className="text-2xl font-black text-white uppercase tracking-tight font-mono">BWS BACKSITE</h2>
                <p className="text-[10px] text-zinc-400 max-w-xs mx-auto leading-relaxed">
                  Authentication is restricted to verified administrators. Log in below using the admin Google credentials.
                </p>
              </div>

              <button
                onClick={handleSignIn}
                disabled={authLoading}
                className="w-full py-3 px-4 rounded bg-gradient-to-r from-[#ca8a04] to-[#eab308] hover:from-[#f59e0b] hover:to-[#ca8a04] text-black text-[10px] font-mono font-bold uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(202,138,4,0.15)] flex items-center justify-center gap-2 cursor-pointer"
              >
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <ArrowRight className="w-4 h-4" />
                    Sign In with Google
                  </>
                )}
              </button>

              {authError && (
                <div className="p-3 bg-red-500/10 border border-red-500/25 rounded-lg text-left text-red-400 text-[9px] font-mono leading-relaxed mt-4">
                  <p className="font-bold uppercase mb-1">Authorization Fault:</p>
                  <p className="font-sans font-light text-zinc-350">{authError}</p>
                </div>
              )}
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-[8px] font-mono uppercase text-zinc-600 tracking-[0.2em]">
          Powered by Lumen Labs • Authorized Access Only
        </footer>
      </div>
    );
  }

  // Case 2: Logged in but not admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased relative flex flex-col justify-between overflow-hidden">
        <header className="p-6 flex justify-between items-center">
          <Link href="/" className="inline-flex items-center space-x-2 text-zinc-500 hover:text-white transition-colors text-[10px] font-mono uppercase tracking-widest">
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Landing Page</span>
          </Link>
          <span className="text-[9px] font-mono bg-red-500/10 border border-red-500/25 px-2 py-1 rounded text-red-400 uppercase font-black">
            Access Denied
          </span>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-zinc-950/85 border border-red-500/30 rounded-3xl p-8 text-center space-y-6">
            <div className="w-12 h-12 mx-auto bg-red-950/20 border border-red-500/30 rounded-xl flex items-center justify-center">
              <ShieldAlert className="w-6 h-6 text-red-400" />
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold uppercase tracking-tight text-white font-mono">Unauthorized Account</h3>
              <p className="text-[10px] text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Logged in as <strong className="text-white">{currentUser.email}</strong>. This account does not possess BWS Administrator status. 
              </p>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                onClick={handleSignOut}
                className="w-full py-2.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300 hover:bg-zinc-855 hover:text-white text-[10px] font-mono uppercase tracking-widest font-bold flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" /> Sign Out
              </button>
            </div>
          </div>
        </main>

        <footer className="py-6 text-center text-[8px] font-mono uppercase text-zinc-650 tracking-[0.2em]">
          Powered by Lumen Labs • Security Level Restricted
        </footer>
      </div>
    );
  }

  // Case 3: Admin dashboard
  return (
    <div className="min-h-screen bg-[#09090b] text-[#f4f4f5] font-sans antialiased relative flex flex-col justify-between overflow-x-hidden">
      {/* Background gradients */}
      <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-gradient-to-br from-[#eab308]/6 via-[#ca8a04]/3 to-transparent blur-[140px] rounded-full pointer-events-none z-0" />
      <div className="absolute bottom-[20%] left-[-150px] w-[500px] h-[500px] bg-[#ca8a04]/3 blur-[120px] rounded-full pointer-events-none z-0" />

      {/* Main Admin Header */}
      <header className="h-20 border-b border-zinc-900 bg-[#09090b]/90 backdrop-blur-md sticky top-0 z-50 px-6 sm:px-12 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="w-10 h-10 bg-gradient-to-br from-zinc-950 via-[#ca8a04] to-zinc-900 rounded-lg border border-[#eab308]/40 flex items-center justify-center shadow-lg">
            <span className="font-mono text-[#eab308] font-black text-xs">BWS</span>
          </div>
          <div>
            <span className="text-sm font-extrabold tracking-widest uppercase text-white font-mono flex items-center gap-1.5">
              BWS SYSTEM BACKSITE <span className="text-[#ca8a04] font-light">CONSOLE</span>
            </span>
            <p className="text-[7.5px] text-zinc-500 font-mono tracking-[0.25em] mt-0.5 uppercase">Admin Role: {currentUser.email}</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <Link href="/" className="px-3 py-1.5 rounded border border-zinc-800 bg-zinc-950/80 text-[9px] font-mono uppercase tracking-widest text-zinc-400 hover:text-white transition-all">
            Return to Site
          </Link>
          <button
            onClick={loadDashboardData}
            disabled={refreshing}
            className="p-2 rounded bg-zinc-950 border border-zinc-900 text-zinc-400 hover:text-white transition-colors cursor-pointer"
            title="Reload Network Ledger Data"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-[#eab308]' : ''}`} />
          </button>
          <button
            onClick={handleSignOut}
            className="px-3 py-1.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-450 hover:text-red-400 text-[9px] font-mono uppercase tracking-widest font-black flex items-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-3 h-3" /> Exit
          </button>
        </div>
      </header>

      {/* Main Dashboard Space */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 sm:px-12 py-8 space-y-8 z-10 relative">
        
        {/* Top Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-widest block">Total Registered Stewardship Users</span>
              <p className="text-3xl font-black font-mono text-white leading-none">{stats.totalUsers}</p>
            </div>
            <span className="p-3 rounded-lg bg-[#ca8a04]/10 border border-[#ca8a04]/20 text-[#eab308]">
              <Users className="w-5 h-5" />
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-widest block">Total Seeded BWSX Balance</span>
              <p className="text-3xl font-black font-mono text-[#eab308] leading-none">{stats.totalBWSX.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <span className="p-3 rounded-lg bg-[#ca8a04]/10 border border-[#ca8a04]/20 text-[#eab308]">
              <Coins className="w-5 h-5 animate-pulse" />
            </span>
          </div>

          <div className="bg-zinc-950/80 border border-zinc-900 rounded-xl p-5 flex items-center justify-between">
            <div className="space-y-1.5">
              <span className="text-[9px] font-mono uppercase text-zinc-500 tracking-widest block">Cumulative Network Spend (BWSX)</span>
              <p className="text-3xl font-black font-mono text-white leading-none">{stats.totalSpending.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
            </div>
            <span className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-400">
              <Activity className="w-5 h-5" />
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* USER MANAGEMENT SECTION */}
          <div className="lg:col-span-8 bg-zinc-950/80 border border-zinc-900 rounded-xl p-6 space-y-6 text-left">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-4">
              <div className="space-y-1">
                <h3 className="text-sm font-mono uppercase font-black text-[#eab308] tracking-widest">Cooperative Registry Members</h3>
                <p className="text-[9px] text-zinc-500 font-mono uppercase">Manage users, adjust credit levels, inspect parameters</p>
              </div>

              {/* Search Registry */}
              <div className="relative max-w-xs w-full">
                <Search className="w-3.5 h-3.5 text-zinc-650 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="SEARCH BY NAME, EMAIL, UID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-1.5 bg-black border border-zinc-850 rounded text-[9px] font-mono tracking-widest text-zinc-350 focus:outline-none focus:border-[#ca8a04] placeholder:text-zinc-700 uppercase"
                />
              </div>
            </div>

            {/* Registry List Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left font-mono text-[9px]">
                <thead>
                  <tr className="border-b border-zinc-900 text-zinc-500 uppercase tracking-widest">
                    <th className="pb-3 font-semibold">User Details</th>
                    <th className="pb-3 font-semibold">Seeded Credits</th>
                    <th className="pb-3 font-semibold">Spending</th>
                    <th className="pb-3 font-semibold text-center">Security Role</th>
                    <th className="pb-3 font-semibold text-right">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/60">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((member) => (
                      <tr key={member.uid} className="hover:bg-zinc-900/20 transition-colors">
                        <td className="py-4 pr-3">
                          <span className="font-bold text-white uppercase text-[10px] block leading-none">{member.displayName}</span>
                          <span className="text-[8px] text-[#eab308] block mt-1 leading-none">{member.email}</span>
                          <span className="text-[6.5px] text-zinc-650 block mt-0.5 select-all leading-none">{member.uid}</span>
                        </td>
                        <td className="py-4 text-[10px]">
                          {editingUserId === member.uid ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="text"
                                value={newBalance}
                                onChange={(e) => setNewBalance(e.target.value)}
                                className="w-16 px-1.5 py-0.5 bg-black border border-[#ca8a04] rounded text-white text-[9px] focus:outline-none font-bold"
                                placeholder={member.balance.toString()}
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateBalance(member.uid)}
                                disabled={updatingBalance}
                                className="p-1 bg-[#ca8a04] hover:bg-[#eab308] text-black rounded cursor-pointer"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => setEditingUserId(null)}
                                className="text-[8px] text-zinc-550 hover:text-white uppercase ml-1"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span className="text-white font-bold">{member.balance.toLocaleString()} BWSX</span>
                              <button
                                onClick={() => {
                                  setEditingUserId(member.uid);
                                  setNewBalance(member.balance.toString());
                                }}
                                className="p-1 text-zinc-600 hover:text-white transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            </div>
                          )}
                        </td>
                        <td className="py-4 text-zinc-400">{member.spending.toLocaleString()} BWSX</td>
                        <td className="py-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                            member.role === 'admin' 
                              ? 'bg-[#ca8a04]/10 border border-[#ca8a04]/30 text-[#eab308]' 
                              : 'bg-zinc-900 border border-zinc-850 text-zinc-500'
                          }`}>
                            {member.role}
                          </span>
                        </td>
                        <td className="py-4 text-right text-zinc-550 text-[8px]">
                          {new Date(member.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-600 font-light">
                        No matches located in the Cooperative Registry directory database replica.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* REALTIME SYSTEM ACTIVITY LOG */}
          <div className="lg:col-span-4 bg-zinc-950/80 border border-zinc-900 rounded-xl p-6 space-y-6 text-left flex flex-col">
            <div className="border-b border-zinc-900 pb-4 space-y-1">
              <h3 className="text-sm font-mono uppercase font-black text-[#eab308] tracking-widest flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-[#eab308] animate-pulse" /> Network Ledger Log
              </h3>
              <p className="text-[9px] text-zinc-500 font-mono uppercase">15 most recent ecosystem transactions</p>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 max-h-[480px] pr-2">
              {activities.length > 0 ? (
                activities.map((act) => (
                  <div key={act.id} className="border-b border-zinc-900/60 pb-3 last:border-b-0 space-y-1">
                    <div className="flex justify-between items-center text-[8.5px] font-mono">
                      <span className="text-[#eab308] font-bold uppercase truncate max-w-[120px]">{act.source}</span>
                      <span className={`font-mono font-bold ${
                        act.value.startsWith('-') ? 'text-red-400' : 'text-emerald-400'
                      }`}>{act.value}</span>
                    </div>
                    <p className="text-[8.5px] text-zinc-350 leading-relaxed font-light font-sans">{act.message}</p>
                    <div className="flex justify-between text-[7px] text-zinc-600 font-mono">
                      <span>{act.tradeType}</span>
                      <span>{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-center text-zinc-650 py-8 font-light">No logged activities present.</p>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-zinc-900 bg-black/40 py-10 px-6 sm:px-12 text-center text-zinc-550">
        <div className="max-w-7xl w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-left font-mono">
            <span className="text-[10px] uppercase text-white font-bold tracking-widest block leading-none">BWS SYSTEM BACKSITE ALLIANCE</span>
            <span className="text-[8px] text-zinc-600 block mt-1.5 uppercase">Lumen Labs Administration Network Portal</span>
          </div>

          <div className="text-[8px] uppercase tracking-[0.2em] font-mono text-left sm:text-right space-y-1">
            <p>ACCESS NODE: SECURED TERMINAL</p>
            <p>Admin session active. Enterprise-grade database locks engaged.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
