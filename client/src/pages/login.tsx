import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Lock, Eye, EyeOff } from "lucide-react";

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
      setError("Şifre giriniz");
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
        setError(data.message || "Giriş başarısız");
      }
    } catch {
      setError("Bağlantı hatası");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-sky-50 via-white to-emerald-50 dark:from-background dark:via-background dark:to-background p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="w-48 h-48 mb-2">
            <img src="/logo.png" alt="Çapari Balık Dağıtım" className="w-full h-full object-contain" />
          </div>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="flex items-center gap-2 mb-2">
                <Lock className="w-4 h-4 text-gray-400 dark:text-muted-foreground" />
                <Label className="text-xs font-semibold text-gray-500 dark:text-muted-foreground uppercase tracking-wider">
                  Giriş Şifresi
                </Label>
              </div>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Şifrenizi giriniz"
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
                {loading ? "Giriş yapılıyor..." : "Giriş Yap"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-[11px] text-gray-400 dark:text-muted-foreground mt-6">
          Çapari Balık Dağıtım Cari Takip Sistemi
        </p>
      </div>
    </div>
  );
}
