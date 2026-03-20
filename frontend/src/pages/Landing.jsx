import Navigation from '../components/Navigation';
import Hero from '../components/Hero';
import HederaStrip from '../components/HederaStrip';
import HowItWorks from '../components/HowItWorks';
import Features from '../components/Features';
import Statistics from '../components/Statistics';
import Footer from '../components/Footer';
import CustomCursor from '../components/CustomCursor';

function Landing() {
  return (
    <div className="min-h-screen bg-black overflow-x-hidden">
      <CustomCursor />

      {/* Animated background */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-br from-red-950/15 via-black to-orange-950/15" />
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-red-600/8 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-[400px] h-[400px] bg-orange-600/8 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: '700ms' }} />
      </div>

      <div className="relative z-10">
        <Navigation />
        <Hero />
        <HederaStrip />
        <HowItWorks />
        <Features />
        <Statistics />
        <Footer />
      </div>
    </div>
  );
}

export default Landing;
