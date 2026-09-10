import { useState, useEffect } from "react";
import { Button } from "./components/ui/button";
import { Card } from "./components/ui/card";
import { ArrowRight, DollarSign, PieChart, TrendingUp, BarChart4 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const LandingPage = () => {
  const [showLoginButton, setShowLoginButton] = useState(false);
  const [animationPhase, setAnimationPhase] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    const timer1 = setTimeout(() => setAnimationPhase(1), 500);
    const timer2 = setTimeout(() => setAnimationPhase(2), 1500);
    const timer3 = setTimeout(() => setAnimationPhase(3), 2500);
    const timer4 = setTimeout(() => setShowLoginButton(true), 3500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  const handleLoginClick = () => {
    navigate("/signin");
  };

  const features = [
    {
      icon: <PieChart className="w-8 h-8" />,
      title: "Visual Analytics",
      description: "See your spending patterns with clean charts and easy-to-understand breakdowns"
    },
    {
      icon: <TrendingUp className="w-8 h-8" />,
      title: "Goal Tracking",
      description: "Set savings goals and track your progress toward financial milestones"
    },
    {
      icon: <BarChart4 className="w-8 h-8" />,
      title: "Category Management",
      description: "Organize expenses by categories to understand where your money goes"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-hero text-foreground overflow-hidden">
      {/* Hero Section */}
      <div className="relative">
        <div 
          className="absolute inset-0 opacity-20"
        />
        
        <div className="relative z-10 container mx-auto px-6 pt-20 pb-32">
          <div className="text-center max-w-4xl mx-auto">
            {/* Main Headline */}
            <div className={`transition-all duration-1000 ${animationPhase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <h1 className="text-6xl md:text-7xl font-bold bg-gradient-primary bg-clip-text text-transparent mb-6">
                Take Control of
                <br />
                Your Finances
              </h1>
            </div>

            {/* Subtitle */}
            <div className={`transition-all duration-1000 delay-300 ${animationPhase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto leading-relaxed">
                The smart budget tracker that helps you save more, spend wisely, and achieve your financial goals with ease.
              </p>
            </div>

            {/* Key Features Preview */}
            <div className={`grid grid-cols-3 gap-8 max-w-lg mx-auto mb-12 transition-all duration-1000 delay-500 ${animationPhase >= 2 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="text-center">
                <PieChart className="w-8 h-8 text-primary mx-auto mb-2" />
                <div className="text-sm text-muted-foreground font-medium">Visual Charts</div>
              </div>
              <div className="text-center">
                <TrendingUp className="w-8 h-8 text-secondary mx-auto mb-2" />
                <div className="text-sm text-muted-foreground font-medium">Goal Tracking</div>
              </div>
              <div className="text-center">
                <BarChart4 className="w-8 h-8 text-primary-glow mx-auto mb-2" />
                <div className="text-sm text-muted-foreground font-medium">Smart Categories</div>
              </div>
            </div>

            {/* CTA Button Animation */}
            <div className="relative">
              {!showLoginButton ? (
                <div className={`transition-all duration-1000 delay-700 ${animationPhase >= 3 ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
                  <Button
                    variant="hero"
                    size="lg"
                    className="text-lg px-12 py-6 rounded-2xl"
                    onClick={() => setShowLoginButton(true)}
                  >
                    Get Started Free
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              ) : (
                <div className="animate-scale-in">
                  <Button
                    variant="glow"
                    size="lg"
                    className="text-lg px-12 py-6 rounded-2xl"
                    onClick={handleLoginClick}
                  >
                    <DollarSign className="mr-2 w-5 h-5" />
                    Login to Dashboard
                    <TrendingUp className="ml-2 w-5 h-5" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="container mx-auto px-6 py-20">
        <div className={`text-center mb-16 transition-all duration-1000 ${animationPhase >= 2 ? 'opacity-100' : 'opacity-0'}`}>
          <h2 className="text-4xl font-bold mb-4">Core Features</h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Simple yet powerful tools to help you manage your personal finances effectively.
          </p>
        </div>

        <div className={`grid md:grid-cols-3 gap-8 transition-all duration-1000 delay-300 ${animationPhase >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="p-8 bg-gradient-card border-border/50 hover:shadow-card transition-all duration-300 hover:scale-105"
            >
              <div className="text-primary mb-4">{feature.icon}</div>
              <h3 className="text-xl font-semibold mb-3 text-card-foreground">{feature.title}</h3>
              <p className="text-muted-foreground leading-relaxed">{feature.description}</p>
            </Card>
          ))}
        </div>
      </div>

      {/* Bottom CTA */}
      <div className="container mx-auto px-6 pb-20">
        <div className={`text-center bg-gradient-card rounded-3xl p-12 border border-border/50 transition-all duration-1000 ${showLoginButton ? 'opacity-100' : 'opacity-50'}`}>
          <BarChart4 className="w-16 h-16 text-primary mx-auto mb-6" />
          <h3 className="text-3xl font-bold mb-4">Ready to Start Budgeting?</h3>
          <p className="text-muted-foreground mb-8 max-w-lg mx-auto">
            A simple, personal budget tracker to help you take control of your spending habits.
          </p>
          {showLoginButton && (
            <Button
              variant="hero"
              size="lg"
              onClick={handleLoginClick}
              className="animate-bounce"
            >
              Start Your Journey
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default LandingPage;
