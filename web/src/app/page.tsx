import CTASection from "@/components/Landing/CTASection";
import DigitalTwinSection from "@/components/Landing/DigitalTwinSection";
import FeaturedTaars from "@/components/Landing/FeaturedTaars";
import Features from "@/components/Landing/Features";
import Footer from "@/components/Landing/Footer";
import Hero from "@/components/Landing/Hero";
import HowItWorks from "@/components/Landing/HowItWorks";
import Navbar from "@/components/Landing/Navbar";
import Ribbons from "@/components/Ribbons";
import SmoothScroll from "@/components/SmoothScroll";

export default function Home() {
  return (
    <SmoothScroll>
      {/* Page-wide interactive ribbons overlay */}
      <div className="fixed inset-0 z-[1] pointer-events-none">
        <div className="absolute inset-0 pointer-events-auto">
          <Ribbons
            baseThickness={30}
            colors={["#ea580c"]}
            speedMultiplier={0.5}
            maxAge={500}
            enableFade={false}
            enableShaderEffect={false}
          />
        </div>
      </div>

      <div className="relative z-10">
        <Navbar />
        <main>
          <Hero />
          <DigitalTwinSection />
          <FeaturedTaars />
          <HowItWorks />
          <Features />
          <CTASection />
        </main>
        <Footer />
      </div>
    </SmoothScroll>
  );
}
