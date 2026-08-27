import { FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { ApiRequestError } from "../lib/api";
import { Button, Card, Input, Label } from "../components/ui";

export function RegisterPage() {
  const { register, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [businessName, setBusinessName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await register(businessName, email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-50 to-white px-4">
      <Card className="w-full max-w-sm p-8">
        <div className="text-center mb-6">
          <div className="text-2xl font-extrabold text-brand-700">Create your chatbot</div>
          <p className="text-sm text-gray-500 mt-1">Get a unique client ID for your website in seconds</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <Label>Business name</Label>
            <Input required value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="Acme Photography" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" />
          </div>
          <div>
            <Label>Password</Label>
            <Input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</div>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Creating..." : "Create account"}
          </Button>
        </form>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already have an account?{" "}
          <Link to="/login" className="text-brand-600 font-medium">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}
