import Image from 'next/image';
import Link from 'next/link';

export default function LandingPage() {
  return (
    <div className="bg-background text-on-background font-body-md antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* TopAppBar */}
      <header className="sticky top-0 w-full z-50 shadow-sm bg-surface/90 dark:bg-surface-dim/90 backdrop-blur-md">
        <div className="max-w-container-max mx-auto px-gutter h-20 flex items-center justify-between">
          <Link href="/landing" className="flex items-center">
            <Image 
              alt="Anti-Gravity Logo" 
              className="h-10 w-auto object-contain" 
              src="/logo1.png" 
              width={150} 
              height={40} 
            />
          </Link>
          <nav className="hidden md:flex gap-md">
            <Link className="font-body-md text-body-md font-bold dark:text-gray-200 hover:text-primary transition-colors hover:bg-secondary-container/20 dark:hover:bg-secondary-fixed-dim/10 rounded-lg py-xs px-sm transition-all text-primary" href="#">Services</Link>
            <Link className="font-body-md text-body-md font-bold dark:text-gray-200 hover:text-primary transition-colors hover:bg-secondary-container/20 dark:hover:bg-secondary-fixed-dim/10 rounded-lg py-xs px-sm transition-all text-primary" href="#">Booking</Link>
            <Link className="font-body-md text-body-md font-bold dark:text-gray-200 hover:text-primary transition-colors hover:bg-secondary-container/20 dark:hover:bg-secondary-fixed-dim/10 rounded-lg py-xs px-sm transition-all text-primary" href="#">Reviews</Link>
            <Link className="font-body-md text-body-md font-bold dark:text-gray-200 hover:text-primary transition-colors hover:bg-secondary-container/20 dark:hover:bg-secondary-fixed-dim/10 rounded-lg py-xs px-sm transition-all text-primary" href="#">About</Link>
          </nav>
          <div className="flex items-center gap-sm">
            <Link className="hidden sm:block font-label-md text-label-md font-bold hover:text-primary transition-colors px-md py-sm text-primary" href="/login">Login</Link>
            <Link className="bg-brand-blue-deep text-white font-label-md text-label-md px-md py-sm rounded-lg hover:bg-primary shadow-ambient-low hover:shadow-ambient-med transition-all" href="/booking">Quick Booking</Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative w-full overflow-hidden bg-surface-container-lowest">
        <div className="absolute inset-0 z-0">
          <Image 
            alt="Bright clean living room" 
            className="w-full h-full object-cover opacity-90" 
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBTNHuTj0DVT4IPL57Ih7OmSmU26MqVPeYqOuy1OGI5Le7Y8Af2gY1XF2wzPTyFDCpR0rpID6S6RHpx0nRsrmwhboW3gg3Dnn-OytVqhS_ECxNWUGJK5_S7CPcFN7zDiETseZrWnxMQTbpig_AspD1jiGu4YJmTHFl67vXnaGYTK2rsbWtVuBHTU6pcZNtytLM1YHl0kxS7RlNjwVx1ptlMvDmQRP0Kk5ijcuFe2pZveZ5LdtIroVVYqLeNbzKeVw4N9BeOqd1A5fQ3" 
            fill
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-r from-surface/95 via-surface/80 to-transparent"></div>
        </div>
        <div className="relative z-10 max-w-container-max mx-auto px-gutter pt-xl pb-xl md:pt-32 md:pb-32 flex flex-col items-start justify-center min-h-[716px]">
          <div className="max-w-2xl">
            <span className="inline-block bg-secondary-container text-primary font-label-md text-label-md px-sm py-xs rounded-full mb-md shadow-ambient-low">Weightless Professionalism</span>
            <h1 className="text-hero text-slate-dark mb-md">Weightless Clean, Gravity-Defying Results.</h1>
            <p className="font-body-lg text-body-lg text-on-surface-variant mb-lg max-w-xl">Experience an innovative, weightless clean for your home and office. Trust our reliable professionals to elevate your space to pristine condition.</p>
            <div className="flex flex-wrap gap-md">
              <Link className="bg-brand-blue-deep text-white font-label-md text-label-md px-lg py-sm rounded-lg shadow-ambient-low hover:shadow-ambient-med hover:-translate-y-0.5 transition-all flex items-center gap-base" href="/booking">
                Book a Clean Now
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </Link>
              <Link className="bg-surface-container-low text-primary font-label-md text-label-md px-lg py-sm rounded-lg border border-outline-variant hover:border-primary hover:bg-surface transition-all flex items-center gap-base" href="/services">
                View Services
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-container-max mx-auto px-gutter relative z-20 -mt-lg mb-2xl">
        <div className="bg-surface rounded-xl shadow-ambient-med p-lg grid grid-cols-1 md:grid-cols-3 gap-md divide-y md:divide-y-0 md:divide-x divide-outline-variant/30">
          <div className="flex flex-col items-center justify-center text-center p-sm">
            <span className="font-h2 text-h2 text-primary mb-xs">5,000+</span>
            <span className="font-body-md text-body-md text-on-surface-variant">Happy Customers</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-sm">
            <span className="font-h2 text-h2 text-primary mb-xs">10+</span>
            <span className="font-body-md text-body-md text-on-surface-variant">Years Experience</span>
          </div>
          <div className="flex flex-col items-center justify-center text-center p-sm">
            <span className="font-h2 text-h2 text-primary mb-xs">100%</span>
            <span className="font-body-md text-body-md text-on-surface-variant">Satisfaction Guarantee</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-2xl max-w-container-max mx-auto px-gutter">
        <div className="text-center mb-lg">
          <h2 className="font-h2 text-h2 text-slate-dark mb-sm">Why Choose Anti-Gravity?</h2>
          <p className="font-body-lg text-body-lg text-on-surface-variant max-w-2xl mx-auto">We combine top-tier professionalism with an airy, minimalist approach to bring you peace of mind.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-lg">
          <div className="flex flex-col items-center text-center bg-surface-container-low rounded-xl p-lg shadow-ambient-low hover:shadow-ambient-med transition-all">
            <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center text-primary mb-md">
              <span className="material-symbols-outlined text-[32px] icon-fill">eco</span>
            </div>
            <h3 className="font-h3 text-h3 text-slate-dark mb-sm">Eco-Friendly Products</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">Safe for your family, pets, and the environment without compromising on cleaning power.</p>
          </div>
          <div className="flex flex-col items-center text-center bg-surface-container-low rounded-xl p-lg shadow-ambient-low hover:shadow-ambient-med transition-all">
            <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center text-primary mb-md">
              <span className="material-symbols-outlined text-[32px] icon-fill">group</span>
            </div>
            <h3 className="font-h3 text-h3 text-slate-dark mb-sm">Professional Team</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">Vetted, highly trained, and dedicated experts who respect your space and privacy.</p>
          </div>
          <div className="flex flex-col items-center text-center bg-surface-container-low rounded-xl p-lg shadow-ambient-low hover:shadow-ambient-med transition-all">
            <div className="w-16 h-16 bg-secondary-container rounded-full flex items-center justify-center text-primary mb-md">
              <span className="material-symbols-outlined text-[32px] icon-fill">verified</span>
            </div>
            <h3 className="font-h3 text-h3 text-slate-dark mb-sm">100% Satisfaction</h3>
            <p className="font-body-md text-body-md text-on-surface-variant">If you're not completely satisfied with our service, we'll return to make it right.</p>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-2xl bg-surface-container">
        <div className="max-w-container-max mx-auto px-gutter">
          <div className="flex flex-col md:flex-row justify-between items-end mb-lg">
            <div className="max-w-xl">
              <h2 className="font-h2 text-h2 text-slate-dark mb-sm">Our Core Services</h2>
              <p className="font-body-lg text-body-lg text-on-surface-variant">Tailored cleaning solutions designed to elevate your environment.</p>
            </div>
            <Link className="hidden md:flex items-center gap-xs font-label-md text-label-md text-primary hover:text-primary-container transition-colors" href="/services">
              Explore all services
              <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
            {/* Service Card 1 */}
            <div className="group relative bg-surface rounded-xl overflow-hidden shadow-ambient-low hover:shadow-ambient-med transition-all cursor-pointer border border-outline-variant/20">
              <div className="h-48 overflow-hidden relative">
                <Image 
                  alt="Residential Cleaning" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDMv9iqHLll60z-jgE3a6yP8RdLO6KHbi5R-DNunBBt_jFsyIWE-iWjMRzD_452Orrf-7qlCKA7oLgsXKKGM-i3ygpul0kbKfy_CX6bl3lC9-REAYwzDaNw4s5RqdpHxGhX6uha6un7IdRg3BW9ebug7Wvm2yTM_X3B9WMUnWR4JsYnte7VjVxoLYqGSJ0Ms8zQWBwGDU3Cg9LHX9IM7dcEzvhBUyWO-jBKjMuj9bYxWFa3blvulySPEUWfDBje_7ZsElrvU2ETe9X-" 
                  fill 
                />
              </div>
              <div className="p-md">
                <h3 className="font-h3 text-h3 text-slate-dark mb-xs">Residential Cleaning</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-md">Comprehensive home cleaning to keep your personal sanctuary spotless and serene.</p>
                <span className="inline-flex items-center gap-xs font-label-md text-label-md text-primary group-hover:text-primary-container transition-colors">
                  Book Service <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </span>
              </div>
            </div>
            
            {/* Service Card 2 */}
            <div className="group relative bg-surface rounded-xl overflow-hidden shadow-ambient-low hover:shadow-ambient-med transition-all cursor-pointer border border-outline-variant/20">
              <div className="h-48 overflow-hidden relative">
                <Image 
                  alt="Commercial Cleaning" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuDbChSvXRboP3MFWRxArhA3-8GgLU7xaS83nclJeUtgdiBL48EDkNrW6fIVDbBYdrf6RPkwLC_ppGmYpxzpG8zyRJadiDcsmETOaAKzrWA9PHQ65P6z7usmNgOzLOwaBHF3D6hToZ9lOuLz5ltCNwIiZxZIyImXByKhUuWCrjuIAsYorM9ZAcsZ5zB6pHwivQxwYaueaToh-EmZZQUVHobLGPtPejTjY39A9vxPG0WxN1Dg2qNa1NBRVacyzuWqmTEuPsVb8_ex-XZy" 
                  fill 
                />
              </div>
              <div className="p-md">
                <h3 className="font-h3 text-h3 text-slate-dark mb-xs">Commercial Cleaning</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-md">Professional office cleaning services to maintain a healthy, productive workspace.</p>
                <span className="inline-flex items-center gap-xs font-label-md text-label-md text-primary group-hover:text-primary-container transition-colors">
                  Book Service <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </span>
              </div>
            </div>

            {/* Service Card 3 */}
            <div className="group relative bg-surface rounded-xl overflow-hidden shadow-ambient-low hover:shadow-ambient-med transition-all cursor-pointer border border-outline-variant/20">
              <div className="h-48 overflow-hidden relative">
                <Image 
                  alt="Move-in Cleaning" 
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuAcbfkZo_Bj5wPZHZdTW4ASJSKwff0hKUV2g3RPJl0hIp6KL_pb3mcjMpn1e2LsYIq5ZbKmXwq5zkENLtfNmWlw1-yWK75G1VjGeFn5sm5NW1NNOTJ8n7QzVfS0x6aIg3O-Xq-T5PpsImkFr3YC4D1TuSDwMpGNdwOnxWZwWLZOCoOY2jhNKngvr8D2Fp3Ey1Dw-nLEnA1U7oFNkWADWzPsv6DHj5mHTy33o96igg-nDFZavJO_HhTmox6giNKP74Weyi0xNkxX7iGy" 
                  fill 
                />
              </div>
              <div className="p-md">
                <h3 className="font-h3 text-h3 text-slate-dark mb-xs">Move-in Cleaning</h3>
                <p className="font-body-md text-body-md text-on-surface-variant mb-md">Deep cleaning for empty spaces, ensuring a fresh start in your new home.</p>
                <span className="inline-flex items-center gap-xs font-label-md text-label-md text-primary group-hover:text-primary-container transition-colors">
                  Book Service <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full py-xl dark:bg-surface-container-lowest border-t border-outline-variant/30 bg-surface-container">
        <div className="max-w-container-max mx-auto px-gutter grid grid-cols-1 md:grid-cols-4 gap-lg">
          <div className="col-span-1 md:col-span-1 flex flex-col gap-sm">
            <Image 
              alt="Anti-Gravity Logo" 
              className="h-10 w-auto object-contain mb-2" 
              src="/logo1.png" 
              width={150} 
              height={40} 
            />
            <p className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant mt-sm">Weightless Professionalism. We bring innovative relief and satisfaction to your space.</p>
          </div>
          <div className="col-span-1 md:col-span-3 grid grid-cols-2 md:grid-cols-3 gap-lg">
            <div className="flex flex-col gap-sm">
              <h4 className="font-label-md text-label-md text-on-surface font-bold mb-xs">Company</h4>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">About Us</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Careers</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Contact Us</Link>
            </div>
            <div className="flex flex-col gap-sm">
              <h4 className="font-label-md text-label-md text-on-surface font-bold mb-xs">Support</h4>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">FAQ</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Booking Guide</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Terms of Service</Link>
            </div>
            <div className="flex flex-col gap-sm col-span-2 md:col-span-1">
              <h4 className="font-label-md text-label-md text-on-surface font-bold mb-xs">Legal</h4>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Privacy Policy</Link>
              <Link className="font-body-md text-body-md text-on-surface-variant dark:text-outline-variant hover:text-primary dark:hover:text-primary-fixed transition-colors opacity-80 hover:opacity-100" href="#">Cookie Policy</Link>
            </div>
          </div>
        </div>
        <div className="max-w-container-max mx-auto px-gutter mt-lg pt-lg border-t border-outline-variant/20 flex flex-col md:flex-row justify-between items-center gap-sm">
          <p className="font-caption text-caption text-on-surface-variant dark:text-outline-variant">© 2026 Anti-Gravity Cleaning Services. All rights reserved.</p>
          <div className="flex gap-md">
            <Link className="text-on-surface-variant hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined text-[20px]">language</span></Link>
            <Link className="text-on-surface-variant hover:text-primary transition-colors" href="#"><span className="material-symbols-outlined text-[20px]">share</span></Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
