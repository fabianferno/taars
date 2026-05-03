import CTASection from "@/components/Landing/CTASection";
import DigitalTwinSection from "@/components/Landing/DigitalTwinSection";
import FeaturedTaars from "@/components/Landing/FeaturedTaars";
import Features from "@/components/Landing/Features";
import Footer from "@/components/Landing/Footer";
import Hero from "@/components/Landing/Hero";
import HowItWorks from "@/components/Landing/HowItWorks";
import Navbar from "@/components/Landing/Navbar";
import SmoothScroll from "@/components/SmoothScroll";

export default function Home() {
  return (
    <SmoothScroll>
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
    </SmoothScroll>
  );
}
