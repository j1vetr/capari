import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

const FISH_COUNT = 18;

function FallingFish() {
  const fishItems = Array.from({ length: FISH_COUNT }, (_, i) => {
    const left = (i / FISH_COUNT) * 100 + Math.sin(i * 1.7) * 8;
    const delay = (i * 1.3) % 8;
    const duration = 10 + (i % 5) * 3;
    const size = 18 + (i % 4) * 8;
    const flip = i % 3 === 0;
    const opacity = 0.08 + (i % 4) * 0.04;
    return (
      <div
        key={i}
        className="absolute pointer-events-none"
        style={{
          left: `${left}%`,
          top: `-${size + 20}px`,
          animation: `fishFall ${duration}s linear ${delay}s infinite`,
          opacity,
          transform: flip ? "scaleX(-1)" : "none",
        }}
      >
        <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M48 32C48 32 56 24 56 16C48 20 44 24 44 24C40 16 32 8 16 8C20 16 20 24 16 32C20 40 20 48 16 56C32 56 40 48 44 40C44 40 48 44 56 48C56 40 48 32 48 32Z"
            fill="#3b82f6"
          />
          <circle cx="22" cy="28" r="2.5" fill="#dbeafe" />
          <path
            d="M8 32C8 32 4 24 2 20C2 28 4 32 4 32C4 32 2 36 2 44C4 40 8 32 8 32Z"
            fill="#3b82f6"
          />
        </svg>
      </div>
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes fishFall {
          0% {
            transform: translateY(-80px) rotate(0deg);
          }
          25% {
            transform: translateY(25vh) rotate(5deg);
          }
          50% {
            transform: translateY(50vh) rotate(-3deg);
          }
          75% {
            transform: translateY(75vh) rotate(4deg);
          }
          100% {
            transform: translateY(110vh) rotate(-2deg);
          }
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
