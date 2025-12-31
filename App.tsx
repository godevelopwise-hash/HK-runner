
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { ContactShadows, Environment, OrbitControls } from '@react-three/drei';
import GameScene from './components/GameScene';
import Player from './components/Player';
import Login from './components/Login';
import { GameStatus, GameSettings, CharacterStyle, Upgrades, ItemType, RegionId, PlayerState, LeaderboardEntry } from './types';
import { REGIONS_DATA } from './constants';
import Synth from './utils/Synth';
import * as THREE from 'three';
import { db, auth, googleProvider } from './firebase';
import { collection, addDoc, getDocs, query, orderBy, limit, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
import { 
    onAuthStateChanged, 
    signInWithPopup, 
    signInWithRedirect,
    getRedirectResult,
    signOut, 
    setPersistence, 
    browserLocalPersistence, 
    User 
} from 'firebase/auth';

// --- Custom Icons ---
const PineappleBunIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg" fill="none">
    <g filter="url(#shadow)">
        <ellipse cx="50" cy="65" rx="42" ry="28" fill="#d97706" stroke="#451a03" strokeWidth="3" />
        <path d="M10 60 Q50 2 90 60" fill="#fbbf24" stroke="#451a03" strokeWidth="3" />
        <path d="M30 35 L70 55" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
        <path d="M70 35 L30 55" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
        <path d="M50 20 L50 60" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
        <path d="M20 50 L80 50" stroke="#b45309" strokeWidth="4" strokeLinecap="round" />
        <ellipse cx="35" cy="30" rx="6" ry="4" fill="#ffffff" fillOpacity="0.6" />
    </g>
    <defs>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
    </defs>
  </svg>
);

const LemonTeaIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="shadow-tea" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
    </defs>
    <g filter="url(#shadow-tea)">
        <path d="M60 5 L50 30" stroke="#fefce8" strokeWidth="5" strokeLinecap="round" />
        <path d="M20 30 L80 30 L70 20 L30 20 Z" fill="#d97706" stroke="#451a03" strokeWidth="3" strokeLinejoin="round" />
        <rect x="20" y="30" width="60" height="65" rx="2" fill="#f59e0b" stroke="#451a03" strokeWidth="3" />
        <circle cx="50" cy="62" r="18" fill="#fde047" stroke="#b45309" strokeWidth="2" />
        <path d="M50 62 L50 46" stroke="#b45309" strokeWidth="1" />
        <path d="M50 62 L64 54" stroke="#b45309" strokeWidth="1" />
        <path d="M50 62 L64 70" stroke="#b45309" strokeWidth="1" />
        <path d="M50 62 L50 78" stroke="#b45309" strokeWidth="1" />
        <path d="M50 62 L36 70" stroke="#b45309" strokeWidth="1" />
        <path d="M50 62 L36 54" stroke="#b45309" strokeWidth="1" />
        <path d="M62 50 Q75 40 68 62 Z" fill="#15803d" stroke="#451a03" strokeWidth="1" />
        <path d="M30 85 L70 85" stroke="#78350f" strokeWidth="3" strokeLinecap="round" />
    </g>
  </svg>
);

const MagnetIcon = ({ className = "w-6 h-6" }: { className?: string }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="shadow-mag" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
        <linearGradient id="mag-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ef4444" />
            <stop offset="100%" stopColor="#b91c1c" />
        </linearGradient>
    </defs>
    <g filter="url(#shadow-mag)">
        <path d="M25 35 L25 65 C25 80 75 80 75 65 L75 35" fill="none" stroke="url(#mag-grad)" strokeWidth="18" strokeLinecap="round" />
        <rect x="16" y="20" width="18" height="15" fill="#d4d4d8" stroke="#404040" strokeWidth="2" />
        <rect x="66" y="20" width="18" height="15" fill="#d4d4d8" stroke="#404040" strokeWidth="2" />
        <path d="M30 70 Q50 80 70 70" fill="none" stroke="#ffffff" strokeWidth="3" opacity="0.4" />
        <path d="M50 15 L45 35 L55 35 L50 55" fill="#fbbf24" stroke="#b45309" strokeWidth="1" />
    </g>
  </svg>
);

const HeartIcon: React.FC<{ className?: string, active?: boolean }> = ({ className = "w-6 h-6", active = true }) => (
  <svg viewBox="0 0 100 100" className={className} xmlns="http://www.w3.org/2000/svg">
    <defs>
        <filter id="shadow-heart" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.3"/>
        </filter>
    </defs>
    <g filter="url(#shadow-heart)">
        <path 
            d="M50 88 L42 80 C18 58 5 44 5 26 C5 12 16 3 29 3 C38 3 45 8 50 15 C55 8 62 3 71 3 C84 3 95 12 95 26 C95 44 82 58 58 80 L50 88 Z" 
            fill={active ? "#ef4444" : "#e5e5e5"} 
            stroke="#1c1917" 
            strokeWidth="5" 
            strokeLinejoin="round"
        />
        {active ? (
            <>
                <path d="M25 25 Q35 15 45 25" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" opacity="0.4" fill="none" />
                <circle cx="20" cy="25" r="3" fill="#ffffff" opacity="0.5" />
            </>
        ) : (
            <path d="M30 40 L50 60 L70 40" stroke="#a3a3a3" strokeWidth="4" strokeLinecap="round" fill="none" />
        )}
    </g>
  </svg>
);





// --- Profanity Filter ---
const PROFANITY_LIST = [
    'fuck', 'shit', 'bitch', 'asshole', 'pussy', 'dick', 'cunt',
    'dllm', 'pk', 'pukgai', 'on9', 'diu', 'dilm', 'tko',
    '屌', '閪', '撚', '𨳒', '𨳊', '𨳍', '仆街', '含撚', '笨柒', '濕鳩'
];

const filterProfanity = (text: string): string => {
    let sanitized = text;
    PROFANITY_LIST.forEach(word => {
        const regex = new RegExp(word, 'gi');
        sanitized = sanitized.replace(regex, '*'.repeat(word.length));
    });
    return sanitized;
};

// --- Wardrobe Scene Component ---
const WardrobeScene = ({ charStyle, upgrades }: { charStyle: CharacterStyle, upgrades: Upgrades }) => {
    const { camera, size } = useThree();
    const isMobile = size.width < 768;

    const { targetPos, cameraPos, playerPos } = useMemo(() => {
        const dist = 5.5; 
        const vFov = 40;
        const visibleHeight = 2 * Math.tan((vFov * Math.PI) / 360) * dist;

        if (isMobile) {
            const yOffset = 0.22 * visibleHeight; 
            const cx = 0;
            const cy = 0.9 - yOffset; 
            const cz = 0;
            return {
                playerPos: new THREE.Vector3(0, 0, 0),
                targetPos: new THREE.Vector3(cx, cy, cz),
                cameraPos: new THREE.Vector3(cx, cy + 1.1, dist + cz)
            };
        } else {
            const containerWidth = Math.min(size.width, 1024);
            const xOffsetPx = containerWidth / 4; 
            const xOffset = (xOffsetPx / size.height) * visibleHeight;
            const yOffsetPx = 40; 
            const yOffset = (yOffsetPx / size.height) * visibleHeight;
            const cx = xOffset; 
            const cy = 0.9 + yOffset;
            
            return {
                playerPos: new THREE.Vector3(0, 0, 0),
                targetPos: new THREE.Vector3(cx, cy, 0),
                cameraPos: new THREE.Vector3(cx, 2.0 + yOffset, dist) 
            };
        }
    }, [isMobile, size.width, size.height]);

    useEffect(() => {
        if (camera instanceof THREE.PerspectiveCamera) {
            camera.fov = 40;
            camera.updateProjectionMatrix();
        }
        camera.position.copy(cameraPos);
        camera.lookAt(targetPos);
        return () => {
             if (camera instanceof THREE.PerspectiveCamera) {
                camera.fov = 55;
                camera.updateProjectionMatrix();
            }
        };
    }, [camera, cameraPos, targetPos]);

    return (
        <>
            <color attach="background" args={['#e0d5c0']} />
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1} castShadow />
            <spotLight position={[-10, 10, -10]} intensity={0.5} />
            <Environment preset="city" />
            <group position={playerPos}>
                <Player 
                    isPreview={true} 
                    state={PlayerState.RUNNING} 
                    setState={() => {}} 
                    gameStatus={GameStatus.MENU} 
                    charStyle={charStyle} 
                />
            </group>
            <ContactShadows position={[playerPos.x, playerPos.y, playerPos.z]} opacity={0.4} scale={10} blur={2} far={4} />
            <OrbitControls enableZoom={false} enableRotate={true} enablePan={false} target={targetPos} />
        </>
    );
};

const ShopItem = ({ name, desc, cost, owned, active, onBuy, onToggle, special }: { name: string, desc: string, cost: number, owned: boolean, active?: boolean, onBuy: () => void, onToggle?: () => void, special?: boolean }) => (
    <div className={`p-4 border-4 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.15)] flex flex-col justify-between ${owned ? (active === false ? 'bg-gray-200' : 'bg-green-100') : special ? 'bg-yellow-50' : 'bg-white'}`}>
        <div>
            <h3 className="font-bold text-xl mb-1 flex items-center gap-2">
                {name} 
                {special && <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">HOT</span>}
                {owned && !special && (
                    <span className={`text-xs px-1.5 py-0.5 rounded border-2 ${active !== false ? 'bg-green-500 text-white border-green-700' : 'bg-stone-400 text-white border-stone-600'}`}>
                        {active !== false ? 'ACTIVE' : 'OFF'}
                    </span>
                )}
            </h3>
            <p className="text-sm text-stone-600 font-medium mb-4">{desc}</p>
        </div>
        <div className="flex justify-between items-center">
            <span className="font-bold text-lg flex items-center gap-2"><PineappleBunIcon className="w-5 h-5" /> {cost}</span>
            <button 
                onClick={owned ? (onToggle || undefined) : onBuy} 
                disabled={owned && !onToggle}
                className={`px-4 py-1 font-bold border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] active:translate-y-0.5 active:shadow-none transition-all ${
                    !owned ? 'bg-stone-900 text-white hover:bg-stone-700' :
                    onToggle ? (active !== false ? 'bg-green-500 text-white hover:bg-green-600' : 'bg-stone-400 text-white hover:bg-stone-500') :
                    'bg-green-500 text-white cursor-default'
                }`}
            >
                {!owned ? 'BUY' : (onToggle ? (active !== false ? 'ENABLED' : 'DISABLED') : 'OWNED')}
            </button>
        </div>
    </div>
);

const ColorPicker = ({ label, current, colors, onSelect }: { label: string, current: string, colors: string[], onSelect: (c: string) => void }) => (
    <div>
        <h4 className="font-bold text-lg mb-2">{label}</h4>
        <div className="flex flex-wrap gap-3">
            {colors.map(c => (
                <button 
                    key={c} 
                    onClick={() => onSelect(c)}
                    className={`w-12 h-12 md:w-10 md:h-10 rounded-full border-4 shadow-sm transition-transform hover:scale-110 ${current === c ? 'border-stone-900 scale-110 ring-2 ring-stone-400' : 'border-stone-200'}`}
                    style={{ backgroundColor: c }}
                />
            ))}
        </div>
    </div>
);

const App: React.FC = () => {
  console.log("HK Runner Version 0.2 - Smart Merge & Logout Fix");
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [gameId, setGameId] = useState(0); 
  const [highScore, setHighScore] = useState(() => parseInt(localStorage.getItem('hk_runner_highscore') || '0'));
  
  const [totalBuns, setTotalBuns] = useState(() => parseInt(localStorage.getItem('hk_runner_buns') || '100'));
  
  const [currentRegion, setCurrentRegion] = useState<RegionId>(RegionId.SHAM_SHUI_PO);
  const regionInfo = REGIONS_DATA[currentRegion];

  const [settings, setSettings] = useState<GameSettings>(() => {
      const saved = localStorage.getItem('hk_runner_settings');
      return saved ? JSON.parse(saved) : { quality: 'high', volume: true };
  });

  const [charStyle, setCharStyle] = useState<CharacterStyle>(() => {
      const saved = localStorage.getItem('hk_runner_charstyle');
      return saved ? JSON.parse(saved) : { skin: "#e0ac69", shirt: "#f0f0f0", shorts: "#1e3a8a", outfit: 'casual' };
  });

  const [upgrades, setUpgrades] = useState<Upgrades>(() => {
      const saved = localStorage.getItem('hk_runner_upgrades');
      return saved ? JSON.parse(saved) : { extraLife: false, doubleBuns: false, jetStart: false, strongMagnet: false, skinPanda: false, skinIron: false, skinDestruction: false };
  });

  const [activeFlags, setActiveFlags] = useState<Record<string, boolean>>(() => {
      const saved = localStorage.getItem('hk_runner_active_flags');
      return saved ? JSON.parse(saved) : {};
  });

  const effectiveUpgrades: Upgrades = useMemo(() => ({
      ...upgrades,
      extraLife: upgrades.extraLife && (activeFlags.extraLife ?? true),
      doubleBuns: upgrades.doubleBuns && (activeFlags.doubleBuns ?? true),
      jetStart: upgrades.jetStart && (activeFlags.jetStart ?? true),
      strongMagnet: upgrades.strongMagnet && (activeFlags.strongMagnet ?? true),
  }), [upgrades, activeFlags]);

  const [finalScore, setFinalScore] = useState(0); 
  const scoreDisplayRef = useRef<HTMLSpanElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const lemonTeaBarRef = useRef<HTMLDivElement>(null);
  const magnetBarRef = useRef<HTMLDivElement>(null);
  const lemonTeaTimerRef = useRef<HTMLSpanElement>(null);
  const magnetTimerRef = useRef<HTMLSpanElement>(null);
  const endTriggeredRef = useRef(false);

  const [lives, setLives] = useState(2);
  const [runBuns, setRunBuns] = useState(0);
  const [destroyedCount, setDestroyedCount] = useState(0); 
  
  const [activeItem, setActiveItem] = useState<'lemontea' | 'magnet' | 'both' | null>(null);
  const [initialBoost, setInitialBoost] = useState(false);
  const [newUnlock, setNewUnlock] = useState<string | null>(null); 

  const [isEndlessMode, setIsEndlessMode] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [showLeaderboardInput, setShowLeaderboardInput] = useState(false);
  const [playerName, setPlayerName] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
     const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
         setUser(currentUser);
         setAuthLoading(false);
         if (currentUser) {
             if (currentUser.displayName) {
                 setPlayerName(filterProfanity(currentUser.displayName).substring(0, 20));
             }
             
             // Smart Merge Logic
             try {
                const userRef = doc(db, 'users', currentUser.uid);
                const docSnap = await getDoc(userRef);
                
                let cloudData: any = {};
                if (docSnap.exists()) {
                    cloudData = docSnap.data();
                }

                // 1. High Score: Max
                const mergedHighScore = Math.max(highScore, cloudData.highScore || 0);

                // 2. Total Buns: Max (Benefit of the doubt)
                const mergedTotalBuns = Math.max(totalBuns, cloudData.totalBuns || 0);

                // 3. Upgrades: Union (OR logic)
                const mergedUpgrades = { ...upgrades };
                if (cloudData.upgrades) {
                    (Object.keys(cloudData.upgrades) as Array<keyof Upgrades>).forEach(key => {
                        if (cloudData.upgrades[key]) {
                            mergedUpgrades[key] = true;
                        }
                    });
                }
                // Also merge local improvements? 
                // We already initialized mergedUpgrades with local `upgrades`.
                // So if local has it, it stays true. If cloud has it, it becomes true.

                // 4. Character Style: 
                // If cloud has data, we generally prefer it, UNLESS we want to keep local changes?
                // Let's keep local style if it's different from default? 
                // Standardization: Use Cloud style if available, otherwise keep local.
                // Or maybe just keep Cloud style to avoid confusion "Where is my panda suit?"
                const mergedCharStyle = cloudData.charStyle || charStyle;

                // 5. Active Flags: Union-ish? Or just Cloud?
                // Let's use Cloud flags if available, merging is complex for "active" state.
                const mergedActiveFlags = cloudData.activeFlags || activeFlags;

                // Update Local State
                setHighScore(mergedHighScore);
                localStorage.setItem('hk_runner_highscore', mergedHighScore.toString());

                setTotalBuns(mergedTotalBuns);
                localStorage.setItem('hk_runner_buns', mergedTotalBuns.toString());

                setUpgrades(mergedUpgrades);
                localStorage.setItem('hk_runner_upgrades', JSON.stringify(mergedUpgrades));

                setCharStyle(mergedCharStyle);
                localStorage.setItem('hk_runner_charstyle', JSON.stringify(mergedCharStyle));

                setActiveFlags(mergedActiveFlags);
                localStorage.setItem('hk_runner_active_flags', JSON.stringify(mergedActiveFlags));

                // Sync Merged Result BACK to Cloud
                await setDoc(userRef, {
                    highScore: mergedHighScore,
                    totalBuns: mergedTotalBuns,
                    upgrades: mergedUpgrades,
                    charStyle: mergedCharStyle,
                    activeFlags: mergedActiveFlags,
                    lastUpdated: serverTimestamp()
                }, { merge: true });

             } catch (err) {
                 console.error("Failed to sync cloud progress:", err);
             }
         }
     });
     return () => unsubscribe();
  }, [highScore, totalBuns, upgrades, charStyle, activeFlags]); // Dependencies added to ensure we have latest local state when auth changes

  const [showEmailLogin, setShowEmailLogin] = useState(false);

  // Auto-sync TO cloud
  const saveUserDataToCloud = async (force: boolean = false, overrides: any = {}) => {
      if (!user) return;
      try {
          const userRef = doc(db, 'users', user.uid);
          const dataToSave = {
              highScore: overrides.highScore ?? highScore,
              totalBuns: overrides.totalBuns ?? totalBuns,
              upgrades: overrides.upgrades ?? upgrades,
              charStyle: overrides.charStyle ?? charStyle,
              activeFlags: overrides.activeFlags ?? activeFlags,
              lastUpdated: serverTimestamp()
          };
          await setDoc(userRef, dataToSave, { merge: true });
          if(force) console.log("Force saved to cloud:", user.uid);
      } catch (err) {
          console.error("Cloud sync failed:", err);
      }
  };

  // Auto-sync TO cloud
  useEffect(() => {
     if (!user || authLoading) return;
     const timeoutId = setTimeout(() => {
         saveUserDataToCloud();
     }, 3000);
     return () => clearTimeout(timeoutId);
  }, [user, authLoading, highScore, totalBuns, upgrades, charStyle, activeFlags]);

  useEffect(() => {
      setPersistence(auth, browserLocalPersistence).catch(e => console.error("Persistence error:", e));
      // Handle Redirect Results
      getRedirectResult(auth)
        .then((result) => {
            if (result) console.log("Redirect Login Success:", result.user.displayName);
        })
        .catch((err) => {
            console.error("Redirect Error:", err);
            setLoginError(err.message);
        });
  }, []);

  const loginWithGoogle = async () => {
      if (isLoggingIn) return;
      setIsLoggingIn(true);
      setLoginError(null);
      console.log("Starting Google Login (Popup)...");
      try {
          const result = await signInWithPopup(auth, googleProvider);
          console.log("Popup Login Success:", result.user.displayName);
      } catch (error: any) {
          console.error("Login failed:", error);
          if (error.code === 'auth/popup-closed-by-user') {
              // User closed the popup
          } else if (error.code === 'auth/cancelled-popup-request') {
              // Another popup was opened
          } else {
              setLoginError(error.message || "Unknown error");
              // Fallback to alert if needed, but we show it on UI now
          }
      } finally {
          setIsLoggingIn(false);
      }
  };

  const loginWithGoogleRedirect = async () => {
      setIsLoggingIn(true);
      setLoginError(null);
      console.log("Starting Google Login (Redirect)...");
      try {
          await signInWithRedirect(auth, googleProvider);
      } catch (error: any) {
          console.error("Redirect failed:", error);
          setLoginError(error.message);
          setIsLoggingIn(false);
      }
  };

  const logout = async () => {
      try {
          if (user) {
              await saveUserDataToCloud(true); // Force save before logout
          }
          await signOut(auth);
          
          // 1. Clear Local Storage (Game Progress)
          localStorage.removeItem('hk_runner_highscore');
          localStorage.removeItem('hk_runner_buns');
          localStorage.removeItem('hk_runner_upgrades');
          localStorage.removeItem('hk_runner_charstyle');
          localStorage.removeItem('hk_runner_active_flags');
          // Note: We keep 'hk_runner_settings' (volume/quality) as that's device preference

          // 2. Reset State to Defaults (Guest Mode)
          setHighScore(0);
          setTotalBuns(100); 
          setUpgrades({ extraLife: false, doubleBuns: false, jetStart: false, strongMagnet: false, skinPanda: false, skinIron: false, skinDestruction: false });
          setCharStyle({ skin: "#e0ac69", shirt: "#f0f0f0", shorts: "#1e3a8a", outfit: 'casual' });
          setActiveFlags({});
          
          setPlayerName("");
          setUser(null); // Ensure UI updates immediately
          
          // Optional: Show a "Logged Out" confirmation? Current UI doesn't have toast yet.
          console.log("Logged out and cleaned up local progress.");
      } catch (error) {
          console.error("Logout failed:", error);
      }
  };

  const fetchLeaderboard = useCallback(async () => {
      try {
          const q = query(collection(db, 'leaderboard'), orderBy('score', 'desc'), limit(10));
          const querySnapshot = await getDocs(q);
          const entries: LeaderboardEntry[] = [];
           querySnapshot.forEach((doc) => {
               const data = doc.data();
               // 嘗試標準化日期顯示
               let displayDate = data.date;
               if (data.timestamp && data.timestamp.toDate) {
                   const dateObj = data.timestamp.toDate();
                   displayDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;
               }
               
               entries.push({
                   ...data,
                   date: displayDate
               } as LeaderboardEntry);
           });
           setLeaderboard(entries);
       } catch (error) {
           console.error("Error fetching leaderboard: ", error);
           // Fallback to local storage if firestore fails
           const saved = localStorage.getItem('hk_runner_leaderboard');
           if (saved) setLeaderboard(JSON.parse(saved));
       }
   }, []);

  useEffect(() => {
     fetchLeaderboard();
  }, [fetchLeaderboard]);


  useEffect(() => {
    Synth.init();
    Synth.setVolume(settings.volume);
  }, []);

  useEffect(() => {
    Synth.setVolume(settings.volume);
  }, [settings.volume]);

  useEffect(() => {
    Synth.updateBGM(status);
  }, [status]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key.toLowerCase() === 'p' || e.key === 'Escape') {
            if (status === GameStatus.PLAYING) {
                setStatus(GameStatus.PAUSED);
            } else if (status === GameStatus.PAUSED) {
                setStatus(GameStatus.PLAYING);
            }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  const startGame = () => {
    endTriggeredRef.current = false;
    setGameId(prev => prev + 1); 
    setFinalScore(0); 
    if (scoreDisplayRef.current) scoreDisplayRef.current.innerText = "0"; 
    setRunBuns(0);
    setDestroyedCount(0);
    setCurrentRegion(RegionId.SHAM_SHUI_PO);
    
    let initialLives = 2;
    if (effectiveUpgrades.extraLife) initialLives += 1;
    if (charStyle.outfit === 'destruction') initialLives += 1;
    setLives(initialLives);

    setInitialBoost(effectiveUpgrades.jetStart);
    setStatus(GameStatus.PLAYING);
    setActiveItem(null);
    setNewUnlock(null);
    setIsEndlessMode(false);
    setShowLeaderboardInput(false);
    setPlayerName("");
  };

  const startEndlessMode = () => {
      endTriggeredRef.current = false; // Reset end trigger for endless mode
      setIsEndlessMode(true);
      setStatus(GameStatus.PLAYING);
  };

  const submitLeaderboardScore = async () => {
      if (!playerName.trim() || isSubmitting) return;
      setIsSubmitting(true);
      
      const sanitizedName = filterProfanity(playerName.trim()).substring(0, 20);
      localStorage.setItem('hk_runner_lastname', sanitizedName);
      const scoreValue = Math.floor(finalScore);
          const now = new Date();
          const formattedDate = `${now.getDate().toString().padStart(2, '0')}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getFullYear()}`;
          
          const newEntry: LeaderboardEntry = {
              name: sanitizedName,
              score: scoreValue,
              date: formattedDate,
          outfit: charStyle.outfit
      };

      try {
          // 提交到 Firestore
          const entryWithPhoto = {
              ...newEntry,
              photoURL: user?.photoURL ?? null,
              uid: user?.uid ?? null, // Bind UID (ensure not undefined)
              timestamp: serverTimestamp()
          };
          // 提交到 Firestore
          await addDoc(collection(db, 'leaderboard'), entryWithPhoto);
          
          // 提交後重新讀取
          await fetchLeaderboard();
      } catch (error) {
          console.error("Error adding score: ", error);
          // 失敗時還是存一下 local 以防萬一
          const newLocal = [...leaderboard, newEntry]
              .sort((a, b) => b.score - a.score)
              .slice(0, 10);
          localStorage.setItem('hk_runner_leaderboard', JSON.stringify(newLocal));
          setLeaderboard(newLocal);
      } finally {
          setIsSubmitting(false);
          setShowLeaderboardInput(false);
      }
  };

  const calculateFinalRewards = () => {
      let finalBuns = runBuns;
      if (charStyle.outfit === 'destruction') {
          finalBuns += destroyedCount * 2;
      }
      return finalBuns;
  };

  const processEndGame = (isWin: boolean, endScore: number) => {
      const overrides: any = {};
      
      if (endScore > highScore) {
        setHighScore(endScore);
        localStorage.setItem('hk_runner_highscore', Math.floor(endScore).toString());
        overrides.highScore = endScore;
      }

      setFinalScore(endScore);

      if (destroyedCount > 100 && !upgrades.skinDestruction) {
          const newUpgrades = { ...upgrades, skinDestruction: true };
          setUpgrades(newUpgrades);
          localStorage.setItem('hk_runner_upgrades', JSON.stringify(newUpgrades));
          setNewUnlock("破壞之王套裝 DESTRUCTION KING OUTFIT");
          overrides.upgrades = newUpgrades;
      }

      const rewards = calculateFinalRewards();
      const winBonus = isWin ? 1000 : 0;
      const newTotal = totalBuns + rewards + winBonus;
      
      localStorage.setItem('hk_runner_buns', newTotal.toString());
      setTotalBuns(newTotal);
      overrides.totalBuns = newTotal;
      
      saveUserDataToCloud(true, overrides);
      setStatus(isWin ? GameStatus.VICTORY : GameStatus.GAMEOVER);
  };

  const handleGameOver = (endScore: number) => {
    if (status !== GameStatus.PLAYING || endTriggeredRef.current) return;
    endTriggeredRef.current = true;
    processEndGame(false, endScore);
    if (user) {
        // Restore player name from user profile or email
        const savedName = localStorage.getItem('hk_runner_lastname');
        const nameToUse = savedName || user.displayName || (user.email ? user.email.split('@')[0] : "");
        setPlayerName(filterProfanity(nameToUse).substring(0, 20));
        setShowLeaderboardInput(true);
    }
  };

  const handleWin = (endScore: number) => {
    if (status !== GameStatus.PLAYING || endTriggeredRef.current) return;
    endTriggeredRef.current = true;
    processEndGame(true, endScore);
    if (user) {
        // Restore player name from user profile or email
        const savedName = localStorage.getItem('hk_runner_lastname');
        const nameToUse = savedName || user.displayName || (user.email ? user.email.split('@')[0] : "");
        setPlayerName(filterProfanity(nameToUse).substring(0, 20));
        setShowLeaderboardInput(true);
    }
  };

  const handlePlayerHit = (currentScore: number) => {
      if (lives > 1) {
          setLives(l => l - 1);
      } else {
          setLives(0);
          handleGameOver(currentScore);
      }
  };

  const handleCoinCollected = (type: ItemType) => {
      if (type === 'bun') {
          let amount = effectiveUpgrades.doubleBuns ? 2 : 1;
          if (charStyle.outfit === 'panda') {
              amount += 1; 
          }
          setRunBuns(p => p + amount);
      }
  };
  
  const handleObstacleDestroyed = () => {
      setDestroyedCount(prev => prev + 1);
  };

  const updateScoreUI = useCallback((currentScore: number) => {
      if (scoreDisplayRef.current) {
          scoreDisplayRef.current.innerText = Math.floor(currentScore).toString();
      }
      if (progressBarRef.current) {
          const percentage = Math.min(100, (currentScore / 10000) * 100);
          progressBarRef.current.style.width = `${percentage}%`;
      }
  }, []);

  const updatePowerUpUI = useCallback((status: { lemontea?: { progress: number; seconds: number }; magnet?: { progress: number; seconds: number } }) => {
      if (lemonTeaBarRef.current && status.lemontea) {
          lemonTeaBarRef.current.style.width = `${status.lemontea.progress * 100}%`;
          if (lemonTeaTimerRef.current) {
              lemonTeaTimerRef.current.innerText = `${status.lemontea.seconds.toFixed(1)}s`;
          }
      }
      if (magnetBarRef.current && status.magnet) {
          magnetBarRef.current.style.width = `${status.magnet.progress * 100}%`;
          if (magnetTimerRef.current) {
              magnetTimerRef.current.innerText = `${status.magnet.seconds.toFixed(1)}s`;
          }
      }
  }, []);

  const buyUpgrade = (key: keyof Upgrades, cost: number) => {
      if (upgrades[key]) return;
      if (totalBuns >= cost) {
          const newBuns = totalBuns - cost;
          setTotalBuns(newBuns);
          localStorage.setItem('hk_runner_buns', newBuns.toString());
          
          const newUpgrades = { ...upgrades, [key]: true };
          setUpgrades(newUpgrades);
          localStorage.setItem('hk_runner_upgrades', JSON.stringify(newUpgrades));
          
          const newFlags = { ...activeFlags, [key]: true };
          setActiveFlags(newFlags);
          localStorage.setItem('hk_runner_active_flags', JSON.stringify(newFlags));

          saveUserDataToCloud(true, { totalBuns: newBuns, upgrades: newUpgrades, activeFlags: newFlags });
          Synth.playCoin();
      }
  };

  const toggleUpgrade = (key: keyof Upgrades) => {
      if (!upgrades[key]) return;
      const current = activeFlags[key] ?? true;
      const newFlags = { ...activeFlags, [key]: !current };
      setActiveFlags(newFlags);
      localStorage.setItem('hk_runner_active_flags', JSON.stringify(newFlags));
      
      saveUserDataToCloud(true, { activeFlags: newFlags });
      Synth.playCoin();
  };

  const changeStyle = (part: keyof CharacterStyle, value: string) => {
      const newStyle = { ...charStyle, [part]: value };
      setCharStyle(newStyle);
      localStorage.setItem('hk_runner_charstyle', JSON.stringify(newStyle));
      
      saveUserDataToCloud(true, { charStyle: newStyle });
  };

  const handleRegionChange = (region: RegionId) => {
      setCurrentRegion(region);
  };

  return (
    <div className="relative w-full h-full bg-[#e0d5c0] text-stone-900 font-sans overflow-hidden touch-none select-none">
      


      {/* Auth Loading Spinner (Optional) */}
      {authLoading && (
        <div className="fixed inset-0 z-[110] bg-stone-900 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-yellow-400 border-t-stone-900 rounded-full animate-spin"></div>
        </div>
      )}

      <div className="absolute inset-0 z-0">
        <Canvas 
            shadows 
            camera={{ position: [0, 5, 12], fov: 55 }} 
            dpr={[1, 1.5]}
            gl={{
                powerPreference: "high-performance",
                antialias: false,
                stencil: false,
                depth: true,
                alpha: false,
            }}
        >
            {status === GameStatus.CUSTOMIZE ? (
                <WardrobeScene charStyle={charStyle} upgrades={effectiveUpgrades} />
            ) : (
                <GameScene 
                    gameId={gameId}
                    status={status} 
                    settings={settings} 
                    charStyle={charStyle} 
                    upgrades={effectiveUpgrades}
                    initialBoost={initialBoost}
                    onGameOver={handleGameOver}
                    onWin={handleWin}
                    onHit={handlePlayerHit}
                    lives={lives}
                    onCoinCollected={handleCoinCollected} 
                    updateScoreUI={updateScoreUI}
                    updatePowerUpUI={updatePowerUpUI}
                    setActiveItemType={setActiveItem}
                    onRegionChange={handleRegionChange}
                    onObstacleDestroyed={handleObstacleDestroyed} 
                    isEndlessMode={isEndlessMode}
                />
            )}
        </Canvas>
      </div>

      {status === GameStatus.MENU && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[2px] p-4 pointer-events-none">
          
          {/* Container for Landscape/Portrait handling - Added global scale for landscape */}
          <div className="flex flex-col landscape:flex-row items-center justify-center gap-6 landscape:gap-16 w-full max-w-md landscape:max-w-4xl transition-all duration-300 landscape:scale-[0.85]">
            
            {/* Title Card */}
            <div className="relative pointer-events-auto transform -rotate-1 hover:rotate-0 transition-transform duration-300 group cursor-default shrink-0">
                
                {/* Outer White Border + Shadow */}
                <div className="relative bg-[#1a1a1a] p-1 shadow-[8px_8px_0px_rgba(0,0,0,0.5)] border-2 border-white/90">
                    
                    {/* Yellow Corner Accents */}
                    <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-yellow-400 z-20"></div>
                    <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-yellow-400 z-20"></div>
                    <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-yellow-400 z-20"></div>
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-yellow-400 z-20"></div>

                    {/* Inner Content Area */}
                    <div className="border border-dashed border-stone-500 bg-[#221f1f] px-8 py-8 md:px-12 md:py-10 flex flex-col items-center relative overflow-hidden">
                        
                        {/* Background Texture/Gradient */}
                        <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-red-900/10 pointer-events-none"></div>

                        {/* Main Title - Layered Effect */}
                        <div className="relative z-10 mb-6">
                            {/* Shadow Layer - FIXED: Removed scale, used offset */}
                            <h1 className="text-6xl md:text-8xl font-black italic tracking-tighter text-[#991b1b] absolute top-2 left-2 opacity-80 select-none blur-[0.5px] whitespace-nowrap">
                                HK RUNNER
                            </h1>
                            {/* Main Layer */}
                            <h1 className="relative text-6xl md:text-8xl font-black italic tracking-tighter text-stone-100 drop-shadow-2xl z-10 mix-blend-normal whitespace-nowrap">
                                HK RUNNER
                            </h1>
                        </div>

                        {/* Subtitle Badge - Skewed Box */}
                        <div className="relative z-10 transform -rotate-1 mt-2">
                             {/* Red Shadow Box */}
                             <div className="absolute inset-0 bg-[#b91c1c] transform translate-x-1.5 translate-y-1.5 skew-x-[-10deg]"></div>
                             {/* White Main Box */}
                             <div className="relative bg-white border-2 border-stone-800 px-6 py-2 transform skew-x-[-10deg] shadow-lg">
                                <span className="block transform skew-x-[10deg] text-xl md:text-2xl font-black tracking-[0.2em] italic text-stone-900 text-center min-w-[160px]">
                                    街頭生存指南
                                </span>
                             </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Buttons Section */}
            <div className="flex flex-col gap-3 w-full max-w-[280px] pointer-events-auto">
                <button onClick={startGame} className="w-full py-4 bg-[#b91c1c] hover:bg-[#991b1b] text-white font-black text-xl md:text-2xl shadow-[4px_4px_0px_rgba(0,0,0,0.5)] border-2 border-[#7f1d1d] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider group">
                    開始狂奔 <span className="text-sm block font-normal opacity-80 group-hover:opacity-100">START</span>
                </button>
                
                <div className="grid grid-cols-2 gap-3 w-full">
                    <button onClick={() => setStatus(GameStatus.CUSTOMIZE)} className="py-3 bg-[#1c1917] hover:bg-stone-800 text-stone-200 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.5)] border border-stone-600 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-1">
                        <span className="text-2xl">👕</span> 
                        <span className="text-sm">換衫</span>
                    </button>
                    <button onClick={() => setStatus(GameStatus.SHOP)} className="py-3 bg-[#1c1917] hover:bg-stone-800 text-stone-200 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.5)] border border-stone-600 active:translate-y-1 active:shadow-none transition-all flex flex-col items-center justify-center gap-1">
                        <span className="text-2xl">🛒</span> 
                        <span className="text-sm">商店</span>
                    </button>
                    {user ? (
                        <div className="col-span-2 flex flex-col gap-2">
                             <div className="bg-stone-800/80 p-2 border border-stone-600 flex items-center justify-between">
                                <div className="flex items-center gap-2 truncate">
                                    {user.photoURL && <img src={user.photoURL} className="w-6 h-6 rounded-full border border-white" alt="avatar" />}
                                    <span className="text-white text-xs font-bold truncate">{user.displayName}</span>
                                </div>
                                <button onClick={() => { logout(); setIsGuest(false); }} className="text-[10px] text-stone-400 hover:text-white underline">LOGOUT</button>
                             </div>
                             <button onClick={() => setStatus(GameStatus.MANUAL)} className="py-3 bg-stone-200 hover:bg-white text-stone-900 border-2 border-stone-900 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all">
                                📖 遊戲說明書
                             </button>
                             <button onClick={() => { setStatus(GameStatus.LEADERBOARD); fetchLeaderboard(); }} className="py-3 bg-yellow-400 hover:bg-yellow-300 text-stone-900 border-2 border-stone-900 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all">
                                🏆 全球排行榜
                             </button>
                        </div>
                    ) : (
                        <>
                             <button onClick={loginWithGoogle} className="col-span-2 py-3 bg-white hover:bg-stone-100 text-stone-900 border-2 border-stone-900 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2">
                                <svg className="w-5 h-5" viewBox="0 0 24 24">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/><path d="M1 1h22v22H1z" fill="none"/>
                                </svg>
                                GOOGLE LOGIN
                             </button>

                             <button onClick={() => setShowEmailLogin(true)} className="col-span-2 py-3 bg-stone-800 hover:bg-stone-700 text-white border-2 border-stone-600 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all flex items-center justify-center gap-2">
                                ✉️ EMAIL LOGIN
                             </button>

                             <button onClick={() => setStatus(GameStatus.MANUAL)} className="col-span-2 py-3 bg-stone-200 hover:bg-white text-stone-900 border-2 border-stone-900 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all">
                                📖 遊戲說明書
                             </button>
                             <button onClick={() => { setStatus(GameStatus.LEADERBOARD); fetchLeaderboard(); }} className="col-span-2 py-3 bg-yellow-400 hover:bg-yellow-300 text-stone-900 border-2 border-stone-900 font-bold text-lg shadow-[3px_3px_0px_rgba(0,0,0,0.3)] active:translate-y-1 active:shadow-none transition-all">
                                🏆 全球排行榜
                             </button>
                        </>
                    )}
                </div>
            </div>

          </div>
          
          {/* Footer Credits */}

          
          {/* Footer Credits - Changed to relative positioning to avoid overlap */}
          <div className="w-full text-center pointer-events-auto mt-4 shrink-0">
              <p className="text-stone-300/80 text-[10px] md:text-xs font-mono tracking-widest uppercase">© 2025 GoDevelopWise. All rights reserved.</p>
              <p className="text-stone-300/80 text-[10px] md:text-xs font-mono tracking-widest uppercase mt-1">Game design & code by Garfield Wong</p>
          </div>
        </div>
      )}

      {showEmailLogin && (
        <Login onClose={() => setShowEmailLogin(false)} />
      )}

      {status === GameStatus.LEADERBOARD && (
        <div className="absolute inset-0 z-30 bg-[#e0d5c0] flex flex-col items-center p-4 md:p-8 overflow-y-auto">
            <div className="w-full max-w-3xl mt-4 md:mt-8 pb-24">
                <div className="flex justify-between items-center mb-6 border-b-4 border-stone-900 pb-4">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">排行榜 LEADERBOARD</h2>
                </div>
                
                <div className="bg-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mb-20">
                    <h3 className="text-2xl font-black mb-4 border-b-2 border-stone-200 pb-2 text-yellow-600">🏆 全球 TOP 10</h3>
                    <div className="space-y-3">
                        {leaderboard.length > 0 ? (
                            leaderboard.map((entry, idx) => {
                                const isTop1 = idx === 0;
                                const isTop2 = idx === 1;
                                const isTop3 = idx === 2;
                                
                                return (
                                <div key={idx} className={`flex justify-between items-center p-3 border-2 rounded ${
                                    isTop1 ? 'bg-yellow-100 border-yellow-500 shadow-[4px_4px_0px_0px_rgba(234,179,8,0.3)] scale-[1.02]' :
                                    isTop2 ? 'bg-slate-100 border-slate-400 shadow-[2px_2px_0px_0px_rgba(148,163,184,0.3)]' :
                                    isTop3 ? 'bg-orange-50 border-orange-300 shadow-[2px_2px_0px_0px_rgba(253,186,116,0.3)]' :
                                    'bg-stone-50 border-stone-200'
                                }`}>
                                    <div className="flex items-center gap-4">
                                        <div className="flex items-center justify-center w-8 h-8">
                                            {isTop1 ? <span className="text-3xl">🥇</span> :
                                             isTop2 ? <span className="text-3xl">🥈</span> :
                                             isTop3 ? <span className="text-3xl">🥉</span> :
                                             <span className="font-black text-stone-400 text-lg">#{idx + 1}</span>
                                            }
                                        </div>
                                        
                                        <div className="flex items-center gap-2">
                                            {entry.photoURL && (
                                                <img src={entry.photoURL} alt={entry.name} className={`w-10 h-10 rounded-full border-2 ${isTop1 ? 'border-yellow-500' : 'border-stone-300'}`} />
                                            )}
                                            <div className="flex flex-col">
                                                <span className={`font-bold text-lg ${isTop1 ? 'text-yellow-700' : 'text-stone-900'}`}>{entry.name}</span>
                                                <span className="text-[10px] text-stone-500 font-mono uppercase">{entry.date}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-baseline gap-1">
                                        <span className={`text-2xl font-black ${isTop1 ? 'text-yellow-600' : 'text-stone-900'}`}>{entry.score}</span>
                                        <span className="text-xs font-bold text-stone-500">m</span>
                                    </div>
                                </div>
                                );
                            })
                        ) : (
                            <div className="text-center py-10 text-stone-400 font-bold italic">抓取排行榜資料中...</div>
                        )}
                    </div>
                </div>

                {/* My Rank Footer */}
                {user && (
                    <div className="fixed bottom-0 left-0 w-full p-4 pointer-events-none z-50 flex justify-center">
                         <div className="w-full max-w-3xl bg-stone-900 text-white p-4 border-t-4 border-yellow-500 shadow-[0_-4px_10px_rgba(0,0,0,0.3)] pointer-events-auto flex justify-between items-center rounded-t-xl">
                            <div className="flex items-center gap-4">
                                <div className="bg-yellow-500 text-stone-900 font-black px-3 py-1 rounded">MY RANK</div>
                                <div className="flex items-center gap-2">
                                     {user.photoURL && <img src={user.photoURL} className="w-8 h-8 rounded-full border border-white" />}
                                     <div className="flex flex-col">
                                        <span className="font-bold text-sm text-stone-300">YOUR BEST</span>
                                        <span className="font-black text-xl leading-none">{highScore > 0 ? highScore : "---"}</span>
                                     </div>
                                </div>
                            </div>
                            <div className="text-right">
                                {leaderboard.find(e => e.name === playerName) ? (
                                    <div className="text-yellow-400 font-black text-2xl">
                                        #{leaderboard.findIndex(e => e.name === playerName) + 1}
                                    </div>
                                ) : (
                                    <div className="text-stone-500 font-bold text-sm">NOT IN TOP 10</div>
                                )}
                            </div>
                         </div>
                    </div>
                )}
            </div>
            
            <div className="fixed top-4 right-4 z-50">
                <button onClick={() => setStatus(GameStatus.MENU)} className="w-12 h-12 bg-stone-900 text-white font-bold rounded-full shadow-lg flex items-center justify-center hover:bg-stone-800 active:scale-95 transition-all">
                    ✕
                </button>
            </div>
        </div>
      )}

      {status === GameStatus.MANUAL && (
        <div className="absolute inset-0 z-30 bg-[#e0d5c0] flex flex-col items-center p-4 md:p-8 overflow-y-auto touch-pan-y">
            <div className="w-full max-w-3xl mt-4 md:mt-8 pb-24">
                <div className="flex justify-between items-center mb-6 border-b-4 border-stone-900 pb-4">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">說明書 MANUAL</h2>
                </div>
                
                <div className="space-y-6">
                    <div className="bg-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                         <h3 className="text-2xl font-black mb-4 border-b-2 border-stone-200 pb-2">🎮 操作控制 CONTROLS</h3>
                         <ul className="space-y-3 font-bold text-stone-700">
                             <li className="flex items-center gap-3"><span className="bg-stone-900 text-white px-2 py-0.5 rounded text-sm min-w-[140px] text-center">⬅️ ➡️ / SWIPE</span> 左右切換跑道 Change Lane</li>
                             <li className="flex items-center gap-3"><span className="bg-stone-900 text-white px-2 py-0.5 rounded text-sm min-w-[140px] text-center">⬆️ / SWIPE UP</span> 跳躍 Jump (可避開矮障礙物)</li>
                             <li className="flex items-center gap-3"><span className="bg-stone-900 text-white px-2 py-0.5 rounded text-sm min-w-[140px] text-center">⬇️ / SWIPE DOWN</span> 滑鏟 Slide (可鑽過高架/招牌)</li>
                             <li className="flex items-center gap-3"><span className="bg-stone-900 text-white px-2 py-0.5 rounded text-sm min-w-[140px] text-center">P / ESC</span> 暫停遊戲 Pause Game</li>
                         </ul>
                    </div>

                    <div className="bg-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                         <h3 className="text-2xl font-black mb-4 border-b-2 border-stone-200 pb-2">🗺️ 地區 REGIONS</h3>
                         <p className="font-bold text-stone-600 mb-4 italic">生存不易,識路好緊要</p>
                         <div className="grid grid-cols-1 gap-3">
                            {Object.values(REGIONS_DATA).map((r) => (
                                <div key={r.id} className="bg-stone-50 border-2 border-stone-200 p-3 flex flex-col md:flex-row md:items-center justify-between gap-2">
                                    <div>
                                        <div className="font-black text-lg">{r.name}</div>
                                        <div className="text-sm font-bold text-stone-500">{r.description}</div>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                         {r.props.hasNeon && <span className="text-xs font-bold bg-pink-100 text-pink-700 px-2 py-0.5 rounded border border-pink-200">霓虹 NEON</span>}
                                         {r.props.hasStalls && <span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded border border-amber-200">排檔 STALLS</span>}
                                         {r.id === 'CENTRAL' && <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200">商業 CBD</span>}
                                         {r.id === 'THE_PEAK' && <span className="text-xs font-bold bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">自然 NATURE</span>}
                                    </div>
                                </div>
                            ))}
                         </div>
                    </div>
                    
                    <div className="bg-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                         <h3 className="text-2xl font-black mb-4 border-b-2 border-stone-200 pb-2">⚡ 道具 POWER-UPS</h3>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             <div className="flex flex-col items-center text-center p-3 bg-yellow-50 border-2 border-yellow-200">
                                 <div className="mb-2"><PineappleBunIcon className="w-16 h-16 drop-shadow-md" /></div>
                                 <div className="font-black text-lg">菠蘿包</div>
                                 <div className="text-xs font-bold text-stone-500 uppercase">Currency</div>
                                 <p className="text-xs mt-1 text-stone-600">收集用來購買升級與服裝</p>
                             </div>
                             <div className="flex flex-col items-center text-center p-3 bg-yellow-100 border-2 border-yellow-400">
                                 <div className="mb-2"><LemonTeaIcon className="w-16 h-16 drop-shadow-md" /></div>
                                 <div className="font-black text-lg">檸檬茶</div>
                                 <div className="text-xs font-bold text-stone-500 uppercase">Super Speed</div>
                                 <p className="text-xs mt-1 text-stone-600">喝下即刻無敵加速衝刺！</p>
                             </div>
                             <div className="flex flex-col items-center text-center p-3 bg-blue-50 border-2 border-blue-300">
                                 <div className="mb-2"><MagnetIcon className="w-16 h-16 drop-shadow-md" /></div>
                                 <div className="font-black text-lg">磁石</div>
                                 <div className="text-xs font-bold text-stone-500 uppercase">Magnet</div>
                                 <p className="text-xs mt-1 text-stone-600">自動吸取附近的菠蘿包</p>
                             </div>
                         </div>
                    </div>
                    
                    <div className="bg-white p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)]">
                         <h3 className="text-2xl font-black mb-4 border-b-2 border-stone-200 pb-2 flex items-center gap-2">🕹️ 隱藏要素 SECRETS</h3>
                         <div className="flex items-start gap-4">
                            <div className="text-4xl">👽</div>
                            <div>
                                <p className="font-bold text-stone-700 mb-2">聽說如果在一局遊戲中大肆破壞超過 100 個障礙物（撞飛它們！），就能獲得傳說中的「破壞之王」裝備...</p>
                                <p className="text-sm text-stone-500 italic border-l-4 border-stone-300 pl-2">提示：這套裝備看起來很像那位來自 M78 星雲的巨人，穿上後破壞障礙物還能賺取額外麵包，你會記得你吃過多少片麵包嗎！</p>
                            </div>
                         </div>
                    </div>
                </div>
            </div>
            
            <div className="fixed bottom-0 left-0 w-full p-4 bg-gradient-to-t from-[#e0d5c0] to-transparent pointer-events-none flex justify-center z-40">
                <button onClick={() => setStatus(GameStatus.MENU)} className="w-full max-w-3xl py-4 bg-stone-900 text-white font-bold text-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all pointer-events-auto">
                    明白 UNDERSTOOD
                </button>
            </div>
        </div>
      )}

      {status === GameStatus.SHOP && (
        <div className="absolute inset-0 z-30 bg-[#e0d5c0] flex flex-col items-center p-6 overflow-y-auto touch-pan-y">
            <div className="w-full max-w-3xl mt-10">
                <div className="flex justify-between items-center mb-8 border-b-4 border-stone-900 pb-4">
                    <h2 className="text-5xl font-black italic tracking-tighter">士多 STORE</h2>
                    <div className="text-2xl font-bold flex items-center gap-2 bg-white px-4 py-2 border-2 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)]">
                        <PineappleBunIcon className="w-8 h-8" /> <span>{totalBuns}</span>
                    </div>
                </div>
                
                <h3 className="text-2xl font-black mb-4">能力升級 UPGRADES</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    <ShopItem 
                        name="鐵布衫 Iron Body" desc="生命值 +1 (Start with 3 Lives)" cost={100} 
                        owned={upgrades.extraLife} active={effectiveUpgrades.extraLife}
                        onBuy={() => buyUpgrade('extraLife', 100)} onToggle={() => toggleUpgrade('extraLife')} 
                    />
                    <ShopItem 
                        name="雙倍福利 Double Buns" desc="所有收集品價值 x2" cost={250} 
                        owned={upgrades.doubleBuns} active={effectiveUpgrades.doubleBuns}
                        onBuy={() => buyUpgrade('doubleBuns', 250)} onToggle={() => toggleUpgrade('doubleBuns')} 
                    />
                    <ShopItem 
                        name="火箭起步 Jet Start" desc="開局極速衝刺 + 無敵" cost={500} 
                        owned={upgrades.jetStart} active={effectiveUpgrades.jetStart}
                        onBuy={() => buyUpgrade('jetStart', 500)} onToggle={() => toggleUpgrade('jetStart')} 
                    />
                    <ShopItem 
                        name="強力磁石 Super Magnet" desc="增加磁鐵吸引範圍 50%" cost={350} 
                        owned={upgrades.strongMagnet} active={effectiveUpgrades.strongMagnet}
                        onBuy={() => buyUpgrade('strongMagnet', 350)} onToggle={() => toggleUpgrade('strongMagnet')} 
                    />
                </div>

                <h3 className="text-2xl font-black mb-4">限定服裝 SPECIAL OUTFITS</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                     <ShopItem name="功夫熊貓 Panda Master" desc="招財進寶：麵包收益增加 (Buns +1)" cost={800} owned={upgrades.skinPanda} onBuy={() => buyUpgrade('skinPanda', 800)} special />
                     <ShopItem name="鐵甲英雄 Iron Hero" desc="高科技：道具時間 +3秒" cost={1200} owned={upgrades.skinIron} onBuy={() => buyUpgrade('skinIron', 1200)} special />
                </div>

                <button onClick={() => setStatus(GameStatus.MENU)} className="w-full py-4 bg-stone-900 text-white font-bold text-2xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all">
                    返回主頁 BACK
                </button>
            </div>
        </div>
      )}

      {status === GameStatus.CUSTOMIZE && (
          <div className="absolute inset-0 z-30 flex flex-col items-center overflow-hidden pointer-events-none">
            <div className="w-full max-w-5xl flex flex-col h-full pointer-events-auto">
                <div className="flex shrink-0 justify-between items-center p-4 md:p-0 md:mt-6 md:mb-4 md:border-b-4 md:pb-2 border-stone-900 bg-[#e0d5c0] z-10">
                    <h2 className="text-4xl md:text-5xl font-black italic tracking-tighter">更衣室 WARDROBE</h2>
                </div>

                <div className="flex flex-col md:flex-row gap-0 md:gap-6 flex-1 min-h-0 overflow-hidden md:p-6 md:pt-0">
                    <div className="w-full h-[45vh] md:h-auto md:w-1/2 bg-transparent border-y-4 md:border-4 border-stone-900 shadow-none md:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] relative shrink-0">
                    </div>

                    <div className="w-full md:w-1/2 flex flex-col gap-4 overflow-y-auto touch-pan-y p-4 md:p-0 bg-[#e0d5c0]">
                        <div className="bg-white p-4 md:p-6 border-4 border-stone-900 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] md:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)]">
                             <div className="space-y-6">
                                <div>
                                    <h4 className="font-bold text-lg mb-2">套裝 OUTFIT</h4>
                                    <div className="grid grid-cols-2 gap-2">
                                        <button onClick={() => changeStyle('outfit', 'casual')} className={`py-2 font-bold border-2 ${charStyle.outfit === 'casual' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-900 border-stone-300'}`}>街坊裝</button>
                                        <button onClick={() => changeStyle('outfit', 'panda')} disabled={!upgrades.skinPanda} className={`py-2 font-bold border-2 relative ${charStyle.outfit === 'panda' ? 'bg-stone-900 text-white border-stone-900' : upgrades.skinPanda ? 'bg-white text-stone-900 border-stone-300' : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                                            熊貓 {!upgrades.skinPanda && <span className="absolute -top-2 -right-2 text-[10px] bg-red-600 text-white px-1 rounded">LOCKED</span>}
                                        </button>
                                        <button onClick={() => changeStyle('outfit', 'iron')} disabled={!upgrades.skinIron} className={`py-2 font-bold border-2 relative ${charStyle.outfit === 'iron' ? 'bg-stone-900 text-white border-stone-900' : upgrades.skinIron ? 'bg-white text-stone-900 border-stone-300' : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                                            鐵甲 {!upgrades.skinIron && <span className="absolute -top-2 -right-2 text-[10px] bg-red-600 text-white px-1 rounded">LOCKED</span>}
                                        </button>
                                        <button onClick={() => changeStyle('outfit', 'destruction')} disabled={!upgrades.skinDestruction} className={`py-2 font-bold border-2 relative ${charStyle.outfit === 'destruction' ? 'bg-stone-900 text-white border-stone-900' : upgrades.skinDestruction ? 'bg-white text-stone-900 border-stone-300' : 'bg-stone-100 text-stone-400 border-stone-200'}`}>
                                            破壞之王 {!upgrades.skinDestruction && <span className="absolute -top-2 -right-2 text-[10px] bg-red-600 text-white px-1 rounded">SECRET</span>}
                                        </button>
                                    </div>
                                    <p className="text-xs text-stone-500 mt-2 h-8">
                                        {charStyle.outfit === 'panda' ? "效果：獲得更多麵包獎勵 (+1)" : 
                                         charStyle.outfit === 'iron' ? "效果：道具時間+3秒 & 噴射飛行模式" : 
                                         charStyle.outfit === 'destruction' ? "效果：生命值+1 & 怪獸剋星！破壞障礙物換取麵包 (1x2)" : "標準外觀，可自由配色"}
                                    </p>
                                </div>
                                {charStyle.outfit === 'casual' && (
                                    <>
                                        <ColorPicker label="上衣 SHIRT" current={charStyle.shirt} colors={['#f0f0f0', '#ef4444', '#3b82f6', '#22c55e', '#1c1917', '#facc15', '#a855f7']} onSelect={(c) => changeStyle('shirt', c)} />
                                        <ColorPicker label="短褲 SHORTS" current={charStyle.shorts} colors={['#1e3a8a', '#1c1917', '#78350f', '#9ca3af', '#047857', '#be123c']} onSelect={(c) => changeStyle('shorts', c)} />
                                        <ColorPicker label="膚色 SKIN" current={charStyle.skin} colors={['#e0ac69', '#f5d0a9', '#8d5524', '#c68642', '#5d4037']} onSelect={(c) => changeStyle('skin', c)} />
                                    </>
                                )}
                             </div>
                        </div>
                        <button onClick={() => setStatus(GameStatus.MENU)} className="w-full py-4 md:py-4 bg-stone-900 text-white font-bold text-xl md:text-2xl shadow-[4px_4px_0px_0px_rgba(0,0,0,0.2)] md:shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] hover:opacity-90 active:translate-y-1 active:shadow-none transition-all mt-auto md:mt-auto shrink-0 mb-4 md:mb-0">返回主頁 BACK</button>
                    </div>
                </div>
            </div>
          </div>
      )}

      {(status === GameStatus.PLAYING || status === GameStatus.PAUSED) && (
        <div className="absolute inset-0 z-10 pointer-events-none flex flex-col justify-between">
          <div className="w-full p-2 pt-4 flex justify-between items-start relative">
            
            {/* Left: Pause Button */}
            <div className="pointer-events-auto z-30">
                 <button onClick={() => setStatus(status === GameStatus.PLAYING ? GameStatus.PAUSED : GameStatus.PLAYING)} className="w-10 h-10 bg-white border-2 border-stone-900 shadow-[2px_2px_0px_0px_rgba(0,0,0,0.2)] flex items-center justify-center hover:bg-stone-100 active:translate-y-1 active:shadow-none transition-all">
                     {status === GameStatus.PAUSED ? <div className="w-0 h-0 border-t-[6px] border-t-transparent border-l-[10px] border-l-stone-900 border-b-[6px] border-b-transparent ml-1"></div> : <div className="flex gap-1"><div className="w-1.5 h-4 bg-stone-900"></div><div className="w-1.5 h-4 bg-stone-900"></div></div>}
                  </button>
            </div>

            {/* Center: Score & Progress */}
            <div className="absolute left-1/2 -translate-x-1/2 top-4 flex flex-col items-center w-full max-w-[260px] z-20 pointer-events-none">
                 <div className="text-6xl font-black italic text-stone-900 drop-shadow-sm leading-none flex items-baseline" style={{ WebkitTextStroke: '1px #ffffff', paintOrder: 'stroke fill' }}>
                    <span ref={scoreDisplayRef}>0</span>
                    <span className="text-xl not-italic ml-0.5 text-stone-700 font-bold">m</span>
                 </div>

                 <div className="w-full relative mt-1 flex flex-col gap-1">
                     <div className="flex justify-between items-end px-1 gap-2">
                         <span className="text-[10px] font-bold text-stone-500 tracking-tighter shrink-0">START</span>
                         <div className="bg-white border border-stone-900 px-1.5 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,0.1)] text-[10px] font-bold leading-none truncate min-w-0">
                            {regionInfo?.name || "HONG KONG"}
                         </div>
                     </div>
                     <div className="w-full h-3 bg-stone-200 border-2 border-stone-900 rounded-full overflow-hidden relative">
                         <div 
                             ref={progressBarRef}
                             className="h-full bg-yellow-400 border-r-2 border-stone-900 transition-all duration-200 ease-linear relative" 
                             style={{ width: '0%' }}
                         >
                            <div className="absolute inset-0 w-full h-full opacity-30 bg-[image:repeating-linear-gradient(45deg,#000_0,#000_2px,transparent_2px,transparent_6px)]"></div>
                         </div>
                     </div>
                 </div>

                 <div className="flex items-center gap-3 mt-2 bg-white/90 backdrop-blur-sm border-2 border-stone-900 px-3 py-1 rounded shadow-sm">
                      <div className="flex items-center gap-1.5">
                         <PineappleBunIcon className="w-5 h-5 drop-shadow-sm" />
                         <span className="text-lg font-black leading-none pt-0.5 text-stone-800">{runBuns}</span>
                      </div>
                      <div className="w-0.5 h-4 bg-stone-300"></div>
                      <div className="flex items-center gap-1.5">
                         <span className="text-lg drop-shadow-sm">💥</span>
                         <span className="text-lg font-black leading-none pt-0.5 text-stone-600">{destroyedCount}</span>
                      </div>
                 </div>
            </div>

            {/* Right: Lives */}
            <div className="flex gap-0.5 z-30">
                {[...Array(2 + (effectiveUpgrades.extraLife ? 1 : 0) + (charStyle.outfit === 'destruction' ? 1 : 0))].map((_, i) => (
                    <HeartIcon 
                        key={i} 
                        className={`w-8 h-8 transition-all duration-300 transform ${i < lives ? 'scale-100 drop-shadow-sm' : 'scale-75 opacity-40 grayscale'}`} 
                        active={i < lives} 
                    />
                ))}
            </div>
          </div>
          
          <div className="flex flex-col items-center w-full pb-8 md:pb-12 px-4 pointer-events-none">
              {activeItem && status === GameStatus.PLAYING && (
                <div className="flex flex-col gap-2 w-full max-w-[280px] items-center">
                    {/* Lemon Tea Bar */}
                    {(activeItem === 'lemontea' || activeItem === 'both') && (
                        <div className="w-full h-10 bg-stone-900/80 backdrop-blur rounded-full border-2 border-stone-900 relative overflow-hidden flex items-center shadow-lg animate-bounce-slight">
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                                <LemonTeaIcon className="w-8 h-8 drop-shadow-md z-20" />
                            </div>
                            <div className="absolute inset-y-1 left-10 right-1 bg-stone-700/50 rounded-full overflow-hidden">
                                <div 
                                    ref={lemonTeaBarRef}
                                    className="h-full absolute left-0 top-0 bg-yellow-400" 
                                    style={{ width: '100%' }} 
                                />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-between px-4 pl-12">
                                <span className="text-xs font-black uppercase text-white drop-shadow-md tracking-wider">SUPER SPEED</span>
                                <span ref={lemonTeaTimerRef} className="text-xs font-bold font-mono text-white drop-shadow-md">0.0s</span>
                            </div>
                        </div>
                    )}

                    {/* Magnet Bar */}
                    {(activeItem === 'magnet' || activeItem === 'both') && (
                        <div className="w-full h-10 bg-stone-900/80 backdrop-blur rounded-full border-2 border-stone-900 relative overflow-hidden flex items-center shadow-lg animate-bounce-slight">
                            <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10">
                                <MagnetIcon className="w-8 h-8 drop-shadow-md z-10" />
                            </div>
                            <div className="absolute inset-y-1 left-10 right-1 bg-stone-700/50 rounded-full overflow-hidden">
                                <div 
                                    ref={magnetBarRef}
                                    className="h-full absolute left-0 top-0 bg-blue-500" 
                                    style={{ width: '100%' }} 
                                />
                            </div>
                            <div className="absolute inset-0 flex items-center justify-between px-4 pl-12">
                                <span className="text-xs font-black uppercase text-white drop-shadow-md tracking-wider">MAGNET</span>
                                <span ref={magnetTimerRef} className="text-xs font-bold font-mono text-white drop-shadow-md">0.0s</span>
                            </div>
                        </div>
                    )}
                </div>
              )}
          </div>
        </div>
      )}

      {status === GameStatus.PAUSED && (
        <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-900/60 backdrop-blur-md p-6">
            <h2 className="text-6xl font-black text-white italic tracking-tighter mb-8 drop-shadow-lg">暫停 PAUSED</h2>
            <div className="flex flex-col gap-4 w-full max-w-xs pointer-events-auto">
                <button onClick={() => setStatus(GameStatus.PLAYING)} className="w-full py-4 bg-white text-stone-900 font-bold text-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:bg-gray-100 active:scale-95 transition-all">繼續遊戲 RESUME</button>
                <button onClick={() => setStatus(GameStatus.MENU)} className="w-full py-4 bg-red-700 text-white font-bold text-xl shadow-[6px_6px_0px_0px_rgba(0,0,0,0.3)] hover:opacity-90 active:scale-95 transition-all">主畫面 MAIN MENU</button>
            </div>
        </div>
      )}

      {(status === GameStatus.VICTORY || status === GameStatus.GAMEOVER) && (
        <div className={`absolute inset-0 z-40 overflow-y-auto touch-auto select-auto ${status === GameStatus.VICTORY ? 'bg-yellow-500/90' : 'bg-red-900/95'} text-white`}>
            <div className="min-h-full flex flex-col items-center justify-center p-6 landscape:p-4 lg:landscape:p-6 text-center animate-fade-in">
                {showLeaderboardInput ? (
                     <div className="w-full max-w-md bg-stone-900 border-4 border-white p-6 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.2)]">
                         <h2 className="text-4xl font-black mb-4 italic text-yellow-500">極限紀錄 NEW RECORD</h2>
                         <p className="text-xl font-bold mb-4 text-white">跑程 DISTANCE: <span className="text-yellow-400">{Math.floor(finalScore)}m</span></p>
                         
                         <input 
                             type="text" 
                              value={playerName}
                              onChange={(e) => setPlayerName(filterProfanity(e.target.value).substring(0, 20))}
                             placeholder="ENTER YOUR NAME"
                             onPointerDown={(e) => e.stopPropagation()}
                             className="w-full bg-stone-800 text-white border-2 border-stone-600 p-3 mb-4 text-center font-bold text-xl uppercase placeholder:text-stone-600 focus:outline-none focus:border-yellow-500 select-text touch-auto pointer-events-auto"
                             maxLength={20}
                         />
                         
                         <button 
                             onClick={submitLeaderboardScore}
                             disabled={!playerName.trim()}
                             className="w-full py-3 bg-yellow-500 text-stone-900 font-bold text-xl hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                             提交 SUBMIT
                         </button>
                     </div>
                ) : (
                /* Content Container with Layout Switching */
                <div className="flex flex-col landscape:flex-row lg:landscape:flex-col items-center justify-center gap-8 landscape:gap-8 lg:landscape:gap-12 w-full max-w-5xl">
                    
                    {/* Left / Top Section: Titles & Info */}
                    <div className="flex flex-col items-center shrink-0">
                         {status === GameStatus.VICTORY ? <div className="mb-4 text-8xl landscape:text-6xl lg:landscape:text-8xl">🏆</div> : null}
                         <h2 className="text-6xl landscape:text-5xl lg:landscape:text-8xl md:text-8xl font-black mb-2 uppercase tracking-tighter text-white drop-shadow-[0_4px_0_rgba(0,0,0,0.2)]">
                             {status === GameStatus.VICTORY ? "任務完成" : "被抓咗! WASTED"}
                         </h2>
                         <h3 className="text-2xl landscape:text-xl lg:landscape:text-4xl md:text-4xl font-bold mb-6 text-stone-100">
                             {status === GameStatus.VICTORY ? "MISSION COMPLETE" : `跑程: ${Math.floor(finalScore)}m`}
                         </h3>

                         {isEndlessMode && !showLeaderboardInput && leaderboard.length > 0 && (
                             <div className="mb-6 w-full max-w-md bg-black/30 p-4 rounded-lg backdrop-blur-sm border-2 border-white/20">
                                 <h4 className="text-xl font-bold mb-2 text-yellow-400 border-b border-white/20 pb-1">🏆 排行榜 TOP 10 LEADERBOARD</h4>
                                 <div className="space-y-1 text-sm md:text-base max-h-[200px] overflow-y-auto">
                                     {leaderboard.map((entry, idx) => (
                                         <div key={idx} className={`flex justify-between items-center px-2 py-1 ${entry.score === Math.floor(finalScore) && entry.name === playerName ? 'bg-yellow-500/30 text-yellow-200' : 'text-stone-200'}`}>
                                             <div className="flex items-center gap-2">
                                                 <span className="font-mono opacity-50 w-4">{idx + 1}.</span>
                                                 <span className="font-bold truncate max-w-[120px]">{entry.name}</span>
                                             </div>
                                             <span className="font-mono">{entry.score}m</span>
                                         </div>
                                     ))}
                                 </div>
                             </div>
                         )}
                         
                         {newUnlock && (
                             <div className="mb-6 bg-yellow-300 text-stone-900 px-6 py-3 border-4 border-stone-900 rotate-2 animate-pulse shadow-lg landscape:px-4 landscape:py-2 landscape:text-sm lg:landscape:text-xl">
                                 <div className="font-black text-xl landscape:text-lg lg:landscape:text-xl">✨ NEW UNLOCK ✨</div>
                                 <div className="font-bold">{newUnlock}</div>
                             </div>
                         )}
                    </div>

                    {/* Right / Bottom Section: Stats & Actions */}
                    <div className="flex flex-col items-center w-full max-w-sm shrink-0 landscape:max-w-xs lg:landscape:max-w-sm">
                         <div className="bg-white text-stone-900 p-6 landscape:p-4 lg:landscape:p-6 border-4 border-stone-900 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] mb-6 rotate-1 w-full">
                             <div className="flex justify-between items-center text-xl landscape:text-base lg:landscape:text-xl font-bold border-b-2 border-dashed border-stone-300 pb-2 mb-2">
                                <span>收集麵包 Loot</span>
                                <span className="flex items-center gap-2"><PineappleBunIcon className="w-6 h-6 landscape:w-5 landscape:h-5 lg:landscape:w-6 lg:landscape:h-6" /> {runBuns}</span>
                             </div>
                             <div className="flex justify-between items-center text-xl landscape:text-base lg:landscape:text-xl font-bold border-b-2 border-dashed border-stone-300 pb-2 mb-2">
                                <span>破壞障礙 Smashed</span>
                                <span>💥 {destroyedCount}</span>
                             </div>
                             {charStyle.outfit === 'destruction' && destroyedCount > 0 && (
                                 <div className="flex justify-between items-center text-lg landscape:text-sm lg:landscape:text-lg font-bold text-orange-600 border-b-2 border-dashed border-stone-300 pb-2 mb-2">
                                    <span>破壞獎勵 Bonus</span>
                                    <span>+{destroyedCount * 2}</span>
                                 </div>
                             )}
                             {status === GameStatus.VICTORY && (
                                 <div className="flex justify-between items-center text-lg landscape:text-sm lg:landscape:text-lg font-bold text-green-600 pb-2 mb-2">
                                    <span>勝利獎勵 Bonus</span>
                                    <span>+1000</span>
                                 </div>
                             )}
                             <div className="flex justify-between items-center text-2xl landscape:text-xl lg:landscape:text-2xl font-black bg-stone-100 p-2 mt-2">
                                <span>總計 TOTAL</span>
                                <span className="flex items-center gap-2"><PineappleBunIcon className="w-8 h-8 landscape:w-6 landscape:h-6 lg:landscape:w-8 lg:landscape:h-8" /> {calculateFinalRewards() + (status === GameStatus.VICTORY ? 1000 : 0)}</span>
                             </div>
                         </div>

                         <div className="flex flex-col gap-4 w-full">
                              {status === GameStatus.VICTORY && !isEndlessMode ? (
                                  <button onClick={startEndlessMode} className="w-full py-5 landscape:py-3 lg:landscape:py-5 bg-red-600 text-white font-black text-2xl landscape:text-xl lg:landscape:text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,0.4)] hover:bg-red-500 hover:scale-105 transition-all active:scale-95 border-4 border-red-800 animate-pulse">
                                      🔥 極限挑戰 LIMIT CHALLENGE
                                  </button>
                              ) : (
                                  <button onClick={startGame} className="w-full py-5 landscape:py-3 lg:landscape:py-5 bg-stone-900 text-white font-bold text-2xl landscape:text-xl lg:landscape:text-2xl shadow-[8px_8px_0px_0px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform active:scale-95">
                                      {isEndlessMode ? "再玩一次 PLAY AGAIN" : "再次挑戰 REPLAY"}
                                  </button>
                              )}
                              
                              <button onClick={() => setStatus(GameStatus.MENU)} className="w-full py-4 landscape:py-3 lg:landscape:py-4 bg-white text-stone-900 font-bold text-xl landscape:text-lg lg:landscape:text-xl border-4 border-stone-900 shadow-[6px_6px_0px_0px_rgba(0,0,0,0.2)] hover:bg-gray-50 transition-colors active:translate-y-1 active:shadow-none">返回主頁 MAIN MENU</button>
                          </div>
                    </div>
                </div>
                )}
            </div>
        </div>
      )}
    </div>
  );
};

export default App;
