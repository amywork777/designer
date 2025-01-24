'use client';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white relative overflow-hidden">
      {/* Gradient Splotches */}
      <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-50 via-blue-50/50 to-transparent rounded-full blur-3xl -translate-x-1/2 -translate-y-1/4 opacity-70" />
      <div className="absolute top-1/3 right-0 w-[700px] h-[700px] bg-gradient-to-bl from-rose-100 via-rose-50/50 to-transparent rounded-full blur-3xl translate-x-1/3 opacity-60" />
      <div className="absolute bottom-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-tr from-blue-50 via-indigo-50/50 to-transparent rounded-full blur-3xl opacity-60" />
      
      {/* Content */}
      <div className="relative container mx-auto px-4 py-16 max-w-3xl">
        {/* Hero Section */}
        <div className="mb-16">
          <h1 className="text-4xl font-bold mb-4">About Taiyaki</h1>
          <p className="text-xl text-gray-600">
            Empowering creators to bring their ideas to life through AI-powered design and manufacturing
          </p>
        </div>

        {/* Mission Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">Our Mission</h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Taiyaki is on a mission to democratize product design and manufacturing. We believe everyone should have the tools to turn their creative ideas into physical reality.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            By combining cutting-edge AI technology with advanced manufacturing capabilities, we're making it easier than ever to go from concept to creation.
          </p>
        </div>

        {/* Features Section */}
        <div className="mb-16">
          <h2 className="text-2xl font-bold mb-6">What We Do</h2>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            We transform ideas into detailed 3D designs using advanced AI technology. Our platform enables rapid manufacturing through our network of production partners, ensuring every product meets high quality standards.
          </p>
          <p className="text-lg text-gray-700 mb-6 leading-relaxed">
            Our team of designers, engineers, and manufacturing experts work together to make product creation accessible to everyone, whether you're a professional designer or just starting out.
          </p>
        </div>

        {/* Logo at the end */}
        <div className="flex justify-center mt-24 mb-16">
          <img 
            src="/images/taiyaki.svg"
            alt="Taiyaki Logo"
            className="w-24 h-24 [filter:grayscale(100%)_opacity(40%)]"
          />
        </div>
      </div>
    </div>
  );
} 