import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

const fishSvgs = [
  // 1 - Levrek (sea bass) - sleek body
  (color: string) => (
    <svg viewBox="0 0 120 50" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M95 25C95 25 105 15 110 8C105 12 100 16 95 18C88 8 70 2 40 4C25 6 12 14 8 25C12 36 25 44 40 46C70 48 88 42 95 32C100 34 105 38 110 42C105 35 95 25 95 25Z" fill={color} />
      <ellipse cx="25" cy="22" rx="3" ry="3.5" fill="#dbeafe" />
      <circle cx="24" cy="22" r="1.5" fill="#1e3a5f" />
      <path d="M40 12C45 16 48 20 48 25C48 30 45 34 40 38" stroke={color} strokeWidth="0.8" opacity="0.4" />
      <path d="M46 14C50 18 52 21 52 25C52 29 50 32 46 36" stroke={color} strokeWidth="0.6" opacity="0.3" />
      <path d="M8 25C4 22 2 18 1 14" stroke={color} strokeWidth="1.5" opacity="0.6" />
      <path d="M8 25C4 28 2 32 1 36" stroke={color} strokeWidth="1.5" opacity="0.6" />
      <path d="M1 14C2 18 3 22 8 25C3 28 2 32 1 36" fill={color} opacity="0.8" />
    </svg>
  ),
  // 2 - Cipura (sea bream) - round/deep body
  (color: string) => (
    <svg viewBox="0 0 100 65" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M80 32C80 32 90 22 95 12C88 18 84 22 80 24C76 14 62 4 38 4C20 6 10 18 8 32C10 46 20 58 38 60C62 60 76 50 80 40C84 42 88 46 95 52C90 42 80 32 80 32Z" fill={color} />
      <ellipse cx="24" cy="28" rx="3.5" ry="4" fill="#dbeafe" />
      <circle cx="23" cy="28" r="2" fill="#1e3a5f" />
      <path d="M38 10C28 14 22 22 22 32C22 42 28 50 38 54" stroke={color} strokeWidth="0.7" opacity="0.3" />
      <path d="M48 8C52 6 56 4 60 6" stroke={color} strokeWidth="2" opacity="0.5" />
      <path d="M48 56C52 58 56 60 60 58" stroke={color} strokeWidth="2" opacity="0.5" />
      <path d="M8 32L2 24C3 28 4 30 8 32C4 34 3 36 2 40L8 32Z" fill={color} opacity="0.8" />
      <path d="M50 8C46 4 42 2 40 1" stroke={color} strokeWidth="1.8" opacity="0.5" />
      <path d="M50 56C46 60 42 62 40 63" stroke={color} strokeWidth="1.8" opacity="0.5" />
    </svg>
  ),
  // 3 - Hamsi (anchovy) - small, slim
  (color: string) => (
    <svg viewBox="0 0 90 28" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M75 14C75 14 82 8 86 4C82 8 78 11 75 12C72 6 58 2 30 3C16 4 8 9 6 14C8 19 16 24 30 25C58 26 72 22 75 16C78 17 82 20 86 24C82 20 75 14 75 14Z" fill={color} />
      <ellipse cx="16" cy="12" rx="2" ry="2.5" fill="#dbeafe" />
      <circle cx="15.5" cy="12" r="1.2" fill="#1e3a5f" />
      <path d="M28 6C32 9 34 11 34 14C34 17 32 19 28 22" stroke={color} strokeWidth="0.5" opacity="0.3" />
      <path d="M6 14L2 10C3 12 4 13 6 14C4 15 3 16 2 18L6 14Z" fill={color} opacity="0.8" />
      <line x1="22" y1="14" x2="70" y2="14" stroke="#93c5fd" strokeWidth="0.8" opacity="0.3" />
    </svg>
  ),
  // 4 - Lufer (bluefish) - powerful, torpedo body
  (color: string) => (
    <svg viewBox="0 0 110 45" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M90 22C90 22 100 14 106 6C100 12 96 16 90 18C86 10 72 2 42 3C24 5 12 12 8 22C12 32 24 40 42 42C72 42 86 34 90 26C96 28 100 32 106 38C100 30 90 22 90 22Z" fill={color} />
      <ellipse cx="22" cy="20" rx="3" ry="3.5" fill="#dbeafe" />
      <circle cx="21" cy="20" r="1.8" fill="#1e3a5f" />
      <path d="M8 22L3 16C4 19 5 21 8 22C5 23 4 25 3 28L8 22Z" fill={color} opacity="0.8" />
      <path d="M56 5C52 3 48 2 44 3" stroke={color} strokeWidth="2.5" opacity="0.5" />
      <path d="M56 40C52 42 48 43 44 42" stroke={color} strokeWidth="2" opacity="0.4" />
      <path d="M36 8C40 14 42 18 42 22C42 26 40 30 36 36" stroke={color} strokeWidth="0.6" opacity="0.25" />
      <path d="M44 9C47 14 48 18 48 22C48 26 47 30 44 35" stroke={color} strokeWidth="0.5" opacity="0.2" />
      <path d="M14 18C16 16 20 14 26 13" stroke="#93c5fd" strokeWidth="0.6" opacity="0.3" />
    </svg>
  ),
];

const FISH_COLORS = ["#3b82f6", "#2563eb", "#1d4ed8", "#60a5fa", "#0ea5e9", "#0284c7"];
const FISH_COUNT = 14;

function FallingFish() {
  const fishItems = Array.from({ length: FISH_COUNT }, (_, i) => {
    const left = ((i * 7.3) % 100);
    const delay = (i * 1.7) % 12;
    const duration = 12 + (i % 5) * 4;
    const size = 36 + (i % 4) * 14;
    const flip = i % 2 === 0;
    const opacity = 0.12 + (i % 3) * 0.06;
    const fishType = i % fishSvgs.length;
    const color = FISH_COLORS[i % FISH_COLORS.length];
    const sway = i % 3 === 0 ? "fishFallLeft" : i % 3 === 1 ? "fishFallRight" : "fishFallStraight";

    return (
      <div
        key={i}
        className="absolute pointer-events-none"
        style={{
          left: `${left}%`,
          top: `-${size + 30}px`,
          width: size,
          animation: `${sway} ${duration}s ease-in-out ${delay}s infinite`,
          opacity,
          transform: flip ? "scaleX(-1)" : "none",
        }}
      >
        {fishSvgs[fishType](color)}
      </div>
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes fishFallStraight {
          0% { transform: translateY(-80px) translateX(0px) rotate(0deg); }
          25% { transform: translateY(25vh) translateX(8px) rotate(3deg); }
          50% { transform: translateY(50vh) translateX(-5px) rotate(-2deg); }
          75% { transform: translateY(75vh) translateX(6px) rotate(2deg); }
          100% { transform: translateY(110vh) translateX(0px) rotate(0deg); }
        }
        @keyframes fishFallLeft {
          0% { transform: translateY(-80px) translateX(0px) rotate(-5deg); }
          25% { transform: translateY(25vh) translateX(-15px) rotate(-8deg); }
          50% { transform: translateY(50vh) translateX(-25px) rotate(-3deg); }
          75% { transform: translateY(75vh) translateX(-10px) rotate(-6deg); }
          100% { transform: translateY(110vh) translateX(-20px) rotate(-4deg); }
        }
        @keyframes fishFallRight {
          0% { transform: translateY(-80px) translateX(0px) rotate(5deg); }
          25% { transform: translateY(25vh) translateX(15px) rotate(8deg); }
          50% { transform: translateY(50vh) translateX(25px) rotate(3deg); }
          75% { transform: translateY(75vh) translateX(10px) rotate(6deg); }
          100% { transform: translateY(110vh) translateX(20px) rotate(4deg); }
        }
      `}</style>
      {fishItems}
    </div>
  );
}

interface LoginProps {
  onSuccess: () => void;
}

export default function Login({ onSuccess }: LoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Sifre giriniz");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        credentials: "include",
      });
      if (res.ok) {
        onSuccess();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.message || "Giris basarisiz");
      }
    } catch {
      setError("Baglanti hatasi");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-sky-100 via-sky-50 to-white dark:from-sky-950 dark:via-background dark:to-background p-4 relative">
      <FallingFish />

      <div className="w-full max-w-sm relative z-10">
        <div className="flex flex-col items-center mb-8">
          <div className="w-48 h-48 mb-2">
            <img src="/logo.png" alt="Capari Balik Dagitim" className="w-full h-full object-contain" />
          </div>
        </div>

        <Card className="backdrop-blur-sm bg-white/90 dark:bg-card/90">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                  Giris Sifresi
                </Label>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Sifrenizi giriniz"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="h-12 text-base pr-12"
                  autoFocus
                  data-testid="input-login-password"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                  data-testid="button-toggle-password"
                >
                  {showPassword ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </Button>
              </div>
              {error && (
                <p className="text-sm text-red-500 dark:text-destructive-foreground font-medium" data-testid="text-login-error">
                  {error}
                </p>
              )}
              <Button
                type="submit"
                disabled={loading}
                className="h-12 font-semibold text-base"
                data-testid="button-login-submit"
              >
                {loading ? "Giris yapiliyor..." : "Giris Yap"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-gray-400 dark:text-muted-foreground mt-6">
          Capari Balik Dagitim Cari Takip Sistemi
        </p>
      </div>
    </div>
  );
}
