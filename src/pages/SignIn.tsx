import { DollarSign } from "lucide-react";
import FieldSet from "../components/FieldSet";
import { Card } from "../components/ui/card";

export default function SignIn() {
  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-6">
      <Card className="w-full max-w-md p-8 bg-gradient-card border-border/50">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-primary rounded-2xl mb-4">
            <DollarSign className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-card-foreground">Welcome Back</h1>
          <p className="text-muted-foreground mt-2">Sign in to your budget tracker</p>
        </div>
        <FieldSet></FieldSet>
      </Card>
    </div>
  );
}
