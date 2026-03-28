import React, { useState, useEffect, useRef } from "react";
import gsap from "gsap";
import { syncAllData } from "@/lib/liveApi";
import { useT } from "@/lib/i18n/LanguageContext";

// ==========================================
// 1. Subcomponente Anímado: ScrambleText
// ==========================================
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

const ScrambleText = ({ text, delay = 0 }: { text: string; delay?: number }) => {
  const [displayText, setDisplayText] = useState("");

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let intervalId: ReturnType<typeof setInterval>;

    // Mostrar todo encriptado desde el frame inicial (respetando espacios)
    // Esto garantiza que el ancho del botón sea el mismo desde el principio
    const initialScrambled = text
      .split("")
      .map((char) =>
        char === " " ? " " : CHARS[Math.floor(Math.random() * CHARS.length)]
      )
      .join("");

    setDisplayText(initialScrambled);

    // Iniciar la decodificación tras el delay especificado
    timeoutId = setTimeout(() => {
      let iteration = 0;

      intervalId = setInterval(() => {
        setDisplayText((prev) => {
          return text
            .split("")
            .map((char, index) => {
              if (char === " ") return " ";
              if (index < iteration) return char; // Deja la letra original ya resuelta
              return CHARS[Math.floor(Math.random() * CHARS.length)]; // Cifra lo faltante
            })
            .join("");
        });

        // Terminar intervalo cuando terminemos la palabra
        if (iteration >= text.length) {
          clearInterval(intervalId);
        }

        // Incremento: Valores menores = animación más duradera
        iteration += 1 / 3;
      }, 30); // 30ms para la sensación de renderizado rápido
    }, delay);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, [text, delay]);

  return <span>{displayText}</span>;
};


export function Navbar() {
  const { t } = useT();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [lastScrollY, setLastScrollY] = useState(0);
  const [isScrolled, setIsScrolled] = useState(false);

  const navItems = [
    { label: t.nav.capabilities, target: "longstrip" },
    { label: t.nav.predictiveEngine, target: "ecosystem" },
    { label: t.nav.simulation3d, target: "simulation" },
    { label: t.nav.team, target: "team" },
  ];

  // Escuchando eventos de Scroll
  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      // Baja y oculta la navbar (salvo en la primera parte de arriba " > 50 ")
      if (currentScrollY > lastScrollY && currentScrollY > 50) {
        setShowHeader(false);
      }
      // Sube y la vuelve a mostrar
      else if (currentScrollY < lastScrollY) {
        setShowHeader(true);
      }

      setIsScrolled(currentScrollY > 50);
      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  // Clases utilitarias reusables para mantener limpieza en el JSX
  const pillClasses = `h-[32px] px-[14px] flex items-center justify-center rounded-[10px] text-[10.5px] font-bold uppercase tracking-[0.16em] transition-colors whitespace-nowrap text-white ${isScrolled
    ? "bg-white/10 hover:bg-white/20 backdrop-blur-md shadow-sm border border-white/10"
    : "bg-[#899192] hover:bg-[#7a8182]"
    }`;

  const logoClasses = `h-[32px] px-[16px] flex items-center justify-center rounded-[10px] text-[18px] font-medium tracking-[0.08em] transition-colors lowercase text-white ${isScrolled
    ? "bg-white/10 hover:bg-white/20 backdrop-blur-md shadow-sm border border-white/10"
    : "bg-[#899192] hover:bg-[#7a8182]"
    }`;

  const plusButtonClasses = `h-[32px] w-[32px] flex items-center justify-center rounded-[10px] transition-colors text-white text-[15px] font-bold pb-[2px] ${isScrolled
    ? "bg-white/10 hover:bg-white/20 backdrop-blur-md shadow-sm border border-white/10"
    : "bg-[#899192] hover:bg-[#7a8182]"
    }`;

  const glassContainerClasses = "flex items-center gap-[2px]";
  const headerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(".gsap-header-capsule", {
        y: -50,
        opacity: 0,
        duration: 0.8,
        stagger: 0.1,
        ease: "power3.out",
        delay: 0.2 // Slight delay so it happens smoothly after initial page load
      });
    }, headerRef);

    return () => ctx.revert();
  }, []);

  return (
    <header
      ref={headerRef}
      className={`fixed top-0 left-0 w-full z-50 p-6 flex justify-between items-start transition-transform duration-300 ease-in-out ${showHeader ? "translate-y-0" : "-translate-y-full"
        }`}
    >
      {/* SECCIÓN IZQUIERDA: Logo y Navegación */}
      <div className={glassContainerClasses}>

        {/* Logo */}
        <a href="/" className={`${logoClasses} gsap-header-capsule`}>
          MangroveShield
        </a>

        {/* Botón MENU / CLOSE */}
        <button
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          className={`${pillClasses} gsap-header-capsule`}
        >
          {isMenuOpen ? "CLOSE" : "MENU"}
        </button>

        {/* Links Desplegables */}
        {isMenuOpen && (
          <nav className="flex items-center gap-1 ml-1" aria-label="Main Navigation">
            {navItems.map((item, index) => (
              <a
                href={`#${item.target}`}
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById(item.target)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  setIsMenuOpen(false);
                }}
                key={item.label}
                className={pillClasses}
              >
                <ScrambleText text={item.label} delay={index * 150} />
              </a>
            ))}
          </nav>
        )}
      </div>

      {/* SECCIÓN DERECHA: Botón Contacto y Añadir */}
      <div className={glassContainerClasses}>
        <button
          className={`${pillClasses} gsap-header-capsule`}
          onClick={async (e) => {
            e.preventDefault();
            const btn = e.currentTarget;
            btn.innerText = "SYNCING...";
            try {
              await syncAllData();
              btn.innerText = "SYNCED";
              setTimeout(() => { btn.innerText = "SYNC"; }, 2000);
              window.location.reload(); // Reload to show new data
            } catch (err) {
              btn.innerText = "ERROR";
              setTimeout(() => { btn.innerText = "SYNC"; }, 2000);
            }
          }}
        >
          SYNC
        </button>
        <button
          className={`${pillClasses} gsap-header-capsule`}
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }}
        >
          CONTACT
        </button>
      </div>
    </header>
  );
}
