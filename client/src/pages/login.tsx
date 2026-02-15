import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

const FISH_IMAGES = ["/images/fish1.png", "/images/fish2.png", "/images/fish3.png", "/images/fish4.png"];
const FISH_COUNT = 12;

function FallingFish() {
  const fishItems = Array.from({ length: FISH_COUNT }, (_, i) => {
    const left = ((i * 8.5) % 95);
    const delay = (i * 1.9) % 14;
    const duration = 14 + (i % 4) * 4;
    const size = 50 + (i % 4) * 20;
    const flip = i % 2 === 0;
    const fishImg = FISH_IMAGES[i % FISH_IMAGES.length];
    const sway = i % 3 === 0 ? "fishFallLeft" : i % 3 === 1 ? "fishFallRight" : "fishFallStraight";

    return (
      <div
        key={i}
        className="absolute pointer-events-none"
        style={{
          left: `${left}%`,
          top: `-${size + 40}px`,
          width: size,
          height: size * 0.6,
          animation: `${sway} ${duration}s ease-in-out ${delay}s infinite`,
          opacity: 0.5,
          filter: "brightness(1.1) saturate(0.7) sepia(0.2) hue-rotate(190deg)",
        }}
      >
        <img
          src={fishImg}
          alt=""
          className="w-full h-full object-contain"
          style={{ transform: flip ? "scaleX(-1)" : "none" }}
          draggable={false}
        />
      </div>
    );
  });

  return (
    <div className="absolute inset-0 overflow-hidden">
      <style>{`
        @keyframes fishFallStraight {
          0% { transform: translateY(-80px) translateX(0px) rotate(0deg); }
          25% { transform: translateY(25vh) translateX(10px) rotate(3deg); }
          50% { transform: translateY(50vh) translateX(-8px) rotate(-2deg); }
          75% { transform: translateY(75vh) translateX(6px) rotate(2deg); }
          100% { transform: translateY(110vh) translateX(0px) rotate(0deg); }
        }
        @keyframes fishFallLeft {
          0% { transform: translateY(-80px) translateX(0px) rotate(-3deg); }
          25% { transform: translateY(25vh) translateX(-20px) rotate(-6deg); }
          50% { transform: translateY(50vh) translateX(-30px) rotate(-2deg); }
          75% { transform: translateY(75vh) translateX(-15px) rotate(-5deg); }
          100% { transform: translateY(110vh) translateX(-25px) rotate(-3deg); }
        }
        @keyframes fishFallRight {
          0% { transform: translateY(-80px) translateX(0px) rotate(3deg); }
          25% { transform: translateY(25vh) translateX(20px) rotate(6deg); }
          50% { transform: translateY(50vh) translateX(30px) rotate(2deg); }
          75% { transform: translateY(75vh) translateX(15px) rotate(5deg); }
          100% { transform: translateY(110vh) translateX(25px) rotate(3deg); }
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
